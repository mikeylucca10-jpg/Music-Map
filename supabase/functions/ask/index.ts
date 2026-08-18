// Supabase Edge Function: the Ask feature's LLM proxy.
//
// Routed through the Perplexity Router API rather than calling a model
// provider directly, so the model can be swapped by changing one env var
// instead of swapping SDKs. Router docs: https://docs.perplexity.ai/docs/gateway/quickstart
//
// Exists so the API key stays server-side. An EXPO_PUBLIC_ key would ship
// inside the client bundle, and unlike the Ticketmaster key an LLM key is
// directly billable — anyone who extracted it could spend against the account
// with no cap.
//
// Deploy:
//   supabase functions deploy ask
//   supabase secrets set PERPLEXITY_API_KEY=...
//   supabase secrets set PERPLEXITY_MODEL=<slug from GET /router/v1/models>
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Anthropic-compatible Router endpoint.
 *
 * Deliberately ends at /router, not /router/v1: the Anthropic SDK appends
 * /v1/messages itself, so including the version here would produce
 * /router/v1/v1/messages. The OpenAI-compatible base URL is the other one
 * (https://api.perplexity.ai/router/v1) — they are not interchangeable.
 *
 * The Messages schema is used rather than Chat Completions because this
 * function already spoke it. Both schemas accept every Router model, so the
 * choice costs nothing in model availability and avoids rewriting the request
 * and response handling for no gain.
 */
const ROUTER_BASE_URL = 'https://api.perplexity.ai/router';

/**
 * Router model ids are `creator/model-name` slugs, and GET /router/v1/models
 * is both the catalogue and the allowlist — an unlisted slug fails with a 400.
 *
 * Read from the environment so swapping models is a secret change and not a
 * deploy of new code, which is the reason for routing through the gateway at
 * all. The default is a slug taken verbatim from the Router quickstart; it has
 * NOT been verified against the live catalogue from here, because no
 * PERPLEXITY_API_KEY with Router access was available: the key on hand returns
 * 403 restricted_api_key on every Router endpoint (the same key returns 200 on
 * POST /search, so the key is valid and the Router tier specifically is not
 * enabled). Confirm this slug against GET /router/v1/models once Router access
 * is on, or set PERPLEXITY_MODEL to something the catalogue actually lists.
 */
const MODEL = Deno.env.get('PERPLEXITY_MODEL') ?? 'perplexity/kimi-k3';

/**
 * Per-million-token rates used only to report each call's cost back to the
 * client, which the UI shows so spend is visible rather than discovered on an
 * invoice.
 *
 * Configurable because they are a property of the selected model, and the
 * model is now an env var — a hardcoded pair would silently misreport the
 * moment PERPLEXITY_MODEL changes. Both default to 0, which reports $0.0000
 * rather than a confident wrong number. Set them from
 * https://docs.perplexity.ai/docs/getting-started/pricing for the chosen model.
 */
const INPUT_COST_PER_MTOK = Number(Deno.env.get('PERPLEXITY_INPUT_COST_PER_MTOK') ?? '0');
const OUTPUT_COST_PER_MTOK = Number(Deno.env.get('PERPLEXITY_OUTPUT_COST_PER_MTOK') ?? '0');

// A reply is a few sentences. This is the hard ceiling on the billable half of
// each request — the single most effective cost control here.
const MAX_TOKENS = 700;

// Per-user daily cap, enforced in Postgres (see the ask_usage migration).
const DAILY_REQUEST_LIMIT = 40;

// Sending the whole listing would grow with the fetched window; this bounds
// the input side of the bill and stays well inside the context window.
const MAX_CONCERTS = 60;

/**
 * The Router does not support structured outputs: `output_config` is not an
 * accepted parameter, and unrecognised top-level fields are rejected with a
 * 400. This function previously relied on output_config.format to force
 * {reply, concertIds}, which is the layer that stops the model inventing shows
 * that do not exist.
 *
 * Tools are supported, so the same guarantee is kept by declaring one tool and
 * requiring it: the model must call it, and its input_schema is the shape the
 * old json_schema described. Dropping to free-form text and parsing prose
 * would lose the guarantee entirely, which the project notes explicitly forbid.
 */
const RECOMMEND_TOOL = {
  name: 'recommend_shows',
  description:
    'Return the recommended shows and the reply to show the user. Must be called exactly once.',
  input_schema: {
    type: 'object' as const,
    properties: {
      reply: {
        type: 'string',
        description: 'A few sentences, in a normal speaking voice, saying why each show fits.',
      },
      concertIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Ids of recommended shows, copied exactly from the supplied list, best fit first.',
      },
    },
    required: ['reply', 'concertIds'],
  },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type IncomingConcert = {
  id: string;
  name: string;
  artist?: string;
  venueName: string;
  startDateTime: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const apiKey = Deno.env.get('PERPLEXITY_API_KEY');
  if (!apiKey) {
    return json({ error: 'The Ask feature isn’t configured yet.' }, 503);
  }

  // Require a signed-in user. Without this the endpoint is an open, billable
  // proxy — anyone could point a script at it and spend the account's credit.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sign in to use Ask.' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) return json({ error: 'Sign in to use Ask.' }, 401);
  const userId = userData.user.id;

  let payload: { question?: string; concerts?: IncomingConcert[] };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Malformed request.' }, 400);
  }

  const question = (payload.question ?? '').trim();
  if (!question) return json({ error: 'Ask a question first.' }, 400);
  if (question.length > 500) return json({ error: 'That question is too long.' }, 400);

  const concerts = (payload.concerts ?? []).slice(0, MAX_CONCERTS);
  if (concerts.length === 0) {
    return json({ error: 'No shows are loaded to search through right now.' }, 400);
  }

  // Atomic increment-and-check, so two concurrent requests can't both slip
  // past the limit. Returns the post-increment count for today.
  const { data: usageCount, error: usageError } = await supabase.rpc('increment_ask_usage', {
    p_user_id: userId,
  });
  if (usageError) {
    return json({ error: 'Couldn’t verify your usage limit. Try again.' }, 500);
  }
  if (typeof usageCount === 'number' && usageCount > DAILY_REQUEST_LIMIT) {
    return json(
      { error: `You’ve hit today’s limit of ${DAILY_REQUEST_LIMIT} questions. Try again tomorrow.` },
      429,
    );
  }

  // The model picks from this catalogue by id and never invents a show. The
  // app then renders only ids it can match against its own list, so a
  // hallucinated id silently renders nothing rather than a fake concert.
  const catalogue = concerts
    .map(
      (c) =>
        `${c.id} | ${c.name}${c.artist && c.artist !== c.name ? ` (${c.artist})` : ''} | ${c.venueName} | ${c.startDateTime}`,
    )
    .join('\n');

  // baseURL points the Anthropic SDK at the Router. The SDK's default
  // x-api-key header is accepted by the Router alongside Authorization: Bearer,
  // and no anthropic-version header is required, so no custom headers here.
  const anthropic = new Anthropic({ apiKey, baseURL: ROUTER_BASE_URL });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        'You help someone find electronic music events from a fixed list of real shows.',
        '',
        'Rules:',
        '- Only ever recommend shows from the list below. Never invent an event, artist, venue, or date.',
        '- Return the id of each show you recommend, exactly as written.',
        '- If nothing in the list genuinely fits, say so plainly and return no ids. Do not stretch to fill space.',
        '- Recommend at most 5 shows, best fit first.',
        '- Keep the reply to a few sentences, in a normal speaking voice. Say why each show fits.',
        '- Do not list the ids in your reply text; they are returned separately.',
        '- Answer only by calling the recommend_shows tool.',
        '',
        'Shows (id | name | venue | starts):',
        catalogue,
      ].join('\n'),
      messages: [{ role: 'user', content: question }],
      // Replaces output_config, which the Router rejects. tool_choice forces
      // the call, so the response shape is guaranteed rather than hoped for.
      tools: [RECOMMEND_TOOL],
      tool_choice: { type: 'tool', name: RECOMMEND_TOOL.name },
    });

    if (response.stop_reason === 'refusal') {
      return json({ error: 'That question can’t be answered here. Try rephrasing.' }, 400);
    }

    // The grounding layer: read the forced tool call, not the prose. A model
    // answering in free text cannot smuggle an invented show through here,
    // because nothing outside this block is read.
    const toolUse = response.content.find(
      (block) => block.type === 'tool_use' && block.name === RECOMMEND_TOOL.name,
    );
    if (!toolUse || toolUse.type !== 'tool_use') {
      return json({ error: 'No answer came back. Try again.' }, 502);
    }

    const parsed = toolUse.input as { reply?: string; concertIds?: string[] };

    // Usage field names follow the Messages schema on the Router exactly as
    // they do on Anthropic's own API, so this is unchanged.
    const { input_tokens: inputTokens, output_tokens: outputTokens } = response.usage;
    const costUsd =
      (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK +
      (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK;

    return json({
      reply: typeof parsed?.reply === 'string' ? parsed.reply : '',
      concertIds: Array.isArray(parsed?.concertIds) ? parsed.concertIds : [],
      usage: {
        inputTokens,
        outputTokens,
        costUsd,
        requestsToday: usageCount,
        dailyLimit: DAILY_REQUEST_LIMIT,
      },
    });
  } catch (error) {

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Anthropic request failed:', message);
    return json({ error: 'Couldn’t reach the assistant. Try again in a moment.' }, 502);
  }
});
