// Supabase Edge Function: the alert engine's sender.
//
// Reads whoever alerts_due() says is owed a notification, sends one push per
// person through Expo, and records what went out. This is the half that makes
// following mean anything -- until it runs, pending_alerts simply fills up.
//
// Deploy:
//   supabase functions deploy send-alerts --no-verify-jwt
//
// Schedule (SQL editor, after the migration is applied and this is deployed):
//   select cron.schedule(
//     'send-alerts', '0 * * * *',
//     $$ select net.http_post(
//          url := 'https://<project>.supabase.co/functions/v1/send-alerts',
//          headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.poll_secret'))
//        ) $$
//   );
//
// Hourly, not continuously. Every rule about *whether* to send lives in
// alerts_due(), so this can run often and harmlessly -- it simply finds nobody
// due most of the time. Hourly is frequent enough that an announcement reaches
// people the same day, and quiet hours are enforced in SQL rather than by
// choosing a clever cron time, which would be wrong for anyone outside the one
// timezone that time was picked for.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Expo accepts at most 100 messages per request. Chunking is not an
 * optimisation here: a 101st message in one call is rejected outright.
 */
const MAX_PER_REQUEST = 100;

type DueRow = {
  user_id: string;
  concert_ids: string[];
  concert_names: string[];
  alert_count: number;
  tokens: string[];
};

/**
 * What the notification actually says.
 *
 * One show is named outright, because the name is the entire reason to open
 * the app. Several are counted instead and the soonest named, since a title
 * listing four acts is truncated by the OS anyway and reads as noise on a lock
 * screen.
 */
function composeMessage(row: DueRow) {
  const [first] = row.concert_names;
  if (row.alert_count === 1) {
    return { title: 'New show announced', body: `${first} just went on sale.` };
  }
  return {
    title: `${row.alert_count} new shows`,
    body: `${first} and ${row.alert_count - 1} more from artists and venues you follow.`,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pollSecret = Deno.env.get('POLL_SECRET');

  if (!supabaseUrl || !serviceKey || !pollSecret) {
    return json({ error: 'Server is missing configuration.' }, 500);
  }

  // Deployed with --no-verify-jwt so cron can reach it, which makes this check
  // the only thing between the internet and a job that can push to every user.
  if ((req.headers.get('Authorization') ?? '') !== `Bearer ${pollSecret}`) {
    return json({ error: 'Not authorised.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: due, error } = await supabase.rpc('alerts_due');
  if (error) return json({ error: error.message }, 500);

  const rows = (due ?? []) as DueRow[];
  if (rows.length === 0) return json({ ranAt: new Date().toISOString(), sent: 0 });

  // One message per token, but the *decision* was made per user -- so a person
  // with two devices still counts as one notification against their weekly cap.
  const messages = rows.flatMap((row) => {
    const { title, body } = composeMessage(row);
    return row.tokens.map((token) => ({
      to: token,
      title,
      body,
      sound: 'default',
      // Read by the app when a notification is opened, so the tap can land on
      // the show itself rather than dumping someone on the home screen.
      data: { concertIds: row.concert_ids },
    }));
  });

  let delivered = 0;
  const disabledTokens: string[] = [];
  const failures: string[] = [];

  for (let start = 0; start < messages.length; start += MAX_PER_REQUEST) {
    const chunk = messages.slice(start, start + MAX_PER_REQUEST);
    let tickets: { status?: string; details?: { error?: string } }[] = [];

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (!response.ok) {
        failures.push(`expo ${response.status}`);
        continue;
      }
      tickets = (await response.json())?.data ?? [];
    } catch (sendError) {
      failures.push(String(sendError).slice(0, 80));
      continue;
    }

    tickets.forEach((ticket, index) => {
      if (ticket?.status === 'ok') {
        delivered++;
        return;
      }
      // A token Expo says is dead must never be sent to again — the app was
      // uninstalled or permission was revoked.
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        disabledTokens.push(chunk[index].to);
      }
    });
  }

  for (const token of disabledTokens) {
    await supabase.rpc('disable_push_token', { p_token: token });
  }

  // Marked only after Expo accepted the push, and only for users who had at
  // least one token succeed. Someone whose only device is dead keeps their
  // alerts queued rather than having them silently marked delivered.
  const deliveredUsers = rows.filter((row) =>
    row.tokens.some((token) => !disabledTokens.includes(token)),
  );
  for (const row of deliveredUsers) {
    await supabase.rpc('mark_alerts_sent', {
      p_user_id: row.user_id,
      p_concert_ids: row.concert_ids,
    });
  }

  return json({
    ranAt: new Date().toISOString(),
    usersDue: rows.length,
    messages: messages.length,
    delivered,
    tokensDisabled: disabledTokens.length,
    failures,
  });
});
