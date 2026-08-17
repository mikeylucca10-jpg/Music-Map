/**
 * Why a fetch failed, to the extent it can be known without a connectivity API.
 *
 * `offline`  — the request never reached a server.
 * `failed`   — a server answered, badly (5xx, 4xx, malformed body).
 * `config`   — the app is missing something it needs, e.g. an API key. Retrying
 *              cannot help, so the UI must not offer a retry that will re-fail.
 *
 * Deliberately derived from the thrown error rather than
 * @react-native-community/netinfo. A connectivity library would add a
 * dependency and a native module to distinguish cases this already separates —
 * and it would still be wrong in the case that matters most, where the device
 * has a connection but cannot reach this particular host.
 */
export type FetchErrorKind = 'offline' | 'failed' | 'config';

export type ClassifiedError = {
  kind: FetchErrorKind;
  /** Shown as the heading. States what happened, not what the user did wrong. */
  title: string;
  /** Shown underneath. Says what to do next, or why there is nothing to do. */
  body: string;
  /** False when retrying cannot possibly succeed. */
  retryable: boolean;
};

/**
 * A failed `fetch` rejects with a TypeError whose message varies by platform:
 * React Native says "Network request failed", Chrome "Failed to fetch", Firefox
 * "NetworkError when attempting to fetch resource". None is a documented
 * contract, so this matches loosely and treats anything unrecognised as a
 * server-side failure — the safer default, since it still offers a retry.
 */
const OFFLINE_PATTERN = /network request failed|failed to fetch|networkerror|network error/i;

export function classifyFetchError(error: unknown): ClassifiedError {
  const message = error instanceof Error ? error.message : String(error ?? '');

  // Thrown by the services themselves when an env var is absent. Retrying is
  // pointless until the app is reconfigured, so the UI should not invite it.
  //
  // The SCREAMING_SNAKE branch matters as much as the "api key" one: since
  // concerts moved behind an Edge Function, the client-side failure is
  // "Missing EXPO_PUBLIC_SUPABASE_URL", which contains no mention of a key and
  // would otherwise be classified as a retryable server failure.
  if (
    /missing [A-Z][A-Z0-9_]{5,}|missing .*api[_ ]?key|isn't configured|is not configured/i.test(
      message,
    )
  ) {
    return {
      kind: 'config',
      title: 'Shows aren’t set up yet',
      body: message,
      retryable: false,
    };
  }

  if (OFFLINE_PATTERN.test(message)) {
    return {
      kind: 'offline',
      title: 'You’re offline',
      body: 'Any shows below were saved from your last visit. They’ll refresh once you reconnect.',
      retryable: true,
    };
  }

  return {
    kind: 'failed',
    title: 'Couldn’t load shows',
    body: 'The listings service didn’t respond properly. This is usually temporary.',
    retryable: true,
  };
}
