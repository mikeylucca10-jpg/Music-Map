import { classifyFetchError } from '@/lib/errors';

describe('classifyFetchError', () => {
  it('recognises the offline message from every platform', () => {
    // These strings are not a documented contract anywhere — they are what
    // each runtime actually throws when a fetch never reaches a server.
    const messages = [
      'Network request failed', // React Native
      'Failed to fetch', // Chrome / RN Web
      'NetworkError when attempting to fetch resource.', // Firefox
    ];
    for (const message of messages) {
      expect(classifyFetchError(new Error(message)).kind).toBe('offline');
    }
  });

  it('keeps offline retryable, since reconnecting is the fix', () => {
    expect(classifyFetchError(new Error('Network request failed')).retryable).toBe(true);
  });

  it('treats a server that answered badly as a failure, not offline', () => {
    // A reachable server returning 503 is a different situation from no
    // connection, and the two need different copy.
    const result = classifyFetchError(new Error('Ticketmaster request failed (503)'));
    expect(result.kind).toBe('failed');
    expect(result.retryable).toBe(true);
  });

  it('marks a missing API key as config and refuses to offer a retry', () => {
    // The whole point of the third case: retrying cannot conjure a key, so
    // offering the button just reproduces the same error.
    const result = classifyFetchError(
      new Error('Missing EXPO_PUBLIC_TICKETMASTER_API_KEY. Get a free key at developer.ticketmaster.com'),
    );
    expect(result.kind).toBe('config');
    expect(result.retryable).toBe(false);
  });

  it('surfaces the original message for config errors', () => {
    // This one is actionable by whoever runs the app, so it must not be
    // replaced with generic copy the way the other two are.
    const message = 'Missing EXPO_PUBLIC_TICKETMASTER_API_KEY. Add it to .env.local.';
    expect(classifyFetchError(new Error(message)).body).toBe(message);
  });

  it('falls back to failed rather than offline for anything unrecognised', () => {
    // Safer default: "failed" still offers a retry, whereas wrongly claiming
    // the user is offline sends them to check a connection that is fine.
    expect(classifyFetchError(new Error('something entirely unexpected')).kind).toBe('failed');
    expect(classifyFetchError(undefined).kind).toBe('failed');
    expect(classifyFetchError('a bare string').kind).toBe('failed');
  });

  it('never returns empty copy for any input', () => {
    for (const input of [new Error('Network request failed'), new Error('boom'), null, 42]) {
      const result = classifyFetchError(input);
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.body.length).toBeGreaterThan(0);
    }
  });
});

// Added when concerts moved behind an Edge Function. The client-side config
// failure changed shape from "Missing ..._API_KEY" to "Missing
// EXPO_PUBLIC_SUPABASE_URL", which mentions no key at all and would otherwise
// be treated as a retryable server failure.
describe('classifyFetchError on env-var config failures', () => {
  it('recognises a missing SUPABASE_URL as config, not a failed request', () => {
    const result = classifyFetchError(
      new Error(
        'Missing EXPO_PUBLIC_SUPABASE_URL. Concerts are fetched through a Supabase Edge Function — copy .env.example to .env.local and fill it in.',
      ),
    );
    expect(result.kind).toBe('config');
    expect(result.retryable).toBe(false);
  });

  it('recognises the server-side key message the Edge Function returns', () => {
    const result = classifyFetchError(
      new Error('Missing TICKETMASTER_API_KEY. Set it with: supabase secrets set'),
    );
    expect(result.kind).toBe('config');
    expect(result.retryable).toBe(false);
  });

  it('does not mistake ordinary prose for a config error', () => {
    // "missing" alone must not trigger it — only a missing NAMED variable.
    expect(classifyFetchError(new Error('The response was missing a body')).kind).toBe('failed');
    expect(classifyFetchError(new Error('missing data')).kind).toBe('failed');
  });
});
