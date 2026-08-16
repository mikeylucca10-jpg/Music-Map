// Supabase Edge Function: the Ask feature's LLM proxy.
//
// Exists so the Anthropic API key stays server-side. An EXPO_PUBLIC_ key would
// ship inside the client bundle, and unlike the Ticketmaster key an LLM key is
// directly billable — anyone who extracted it could spend against the account
// with no cap.
//
// Deploy:
//   supabase functions deploy ask
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Haiku 4.5 deliberately: this task is "pick matching shows from a list I gave
// you and say why" — constrained selection, not hard reasoning — and cost is
// the binding constraint here. Swap this one line for 'claude-sonnet-5' or
// 'claude-opus-5' if answers aren't good enough; nothing else needs to change.
const MODEL = 'claude-haiku-4-5';

// Published per-million-token rates for the model above, used only to report
// the cost of each call back to the client. Update if MODEL changes.
const INPUT_COST_PER_MTOK = 1.0;
const OUTPUT_COST_PER_MTOK = 5.0;

// A reply is a few sentences. This is the hard ceiling on the billable half of
// each request — the single most effective cost control here.
const MAX_TOKENS = 700;

// Per-user daily cap, enforced in Postgres (see the ask_usage migration).
const DAILY_REQUEST_LIMIT = 40;

// Sending the whole listing would grow with the fetched window; this bounds
// the input side of the bill and stays well inside the context window.
const MAX_CONCERTS = 60;

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

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
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

  const anthropic = new Anthropic({ apiKey });

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
        '',
        'Shows (id | name | venue | starts):',
        catalogue,
      ].join('\n'),
      messages: [{ role: 'user', content: question }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              reply: { type: 'string' },
              concertIds: { type: 'array', items: { type: 'string' } },
            },
            required: ['reply', 'concertIds'],
            additionalProperties: false,
          },
        },
      },
    });

    if (response.stop_reason === 'refusal') {
      return json({ error: 'That question can’t be answered here. Try rephrasing.' }, 400);
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return json({ error: 'No answer came back. Try again.' }, 502);
    }

    let parsed: { reply?: string; concertIds?: string[] };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return json({ error: 'The answer came back malformed. Try again.' }, 502);
    }

    const { input_tokens: inputTokens, output_tokens: outputTokens } = response.usage;
    const costUsd =
      (inputTokens / 1_000_000) * INPUT_COST_PER_MTOK +
      (outputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK;

    return json({
      reply: parsed.reply ?? '',
      concertIds: Array.isArray(parsed.concertIds) ? parsed.concertIds : [],
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
