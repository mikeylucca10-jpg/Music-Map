import { useCallback, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { Concert } from '@/types/concert';

export type AskUsage = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  requestsToday: number;
  dailyLimit: number;
};

export type AskExchange = {
  id: string;
  question: string;
  reply: string;
  concerts: Concert[];
};

// Only the fields the model needs to choose between shows. Deliberately not the
// whole Concert — every extra field is input tokens on a billed request.
function toPayload(concert: Concert) {
  return {
    id: concert.id,
    name: concert.name,
    artist: concert.artist,
    venueName: concert.venueName,
    startDateTime: concert.startDateTime,
  };
}

async function readErrorMessage(error: unknown): Promise<string | null> {
  // supabase-js puts the non-2xx response on error.context; the Edge Function
  // returns a human-readable { error } body worth surfacing verbatim.
  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } })?.context;
  if (!context?.json) return null;
  try {
    const body = await context.json();
    return body?.error ?? null;
  } catch {
    return null;
  }
}

// Single-turn by design: each question is answered against the current listing
// with no conversation history replayed. Multi-turn would grow the input on
// every message, and "find me shows like X" doesn't need it.
export function useAsk(concerts: Concert[]) {
  const [exchanges, setExchanges] = useState<AskExchange[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUsage, setLastUsage] = useState<AskUsage | null>(null);

  const ask = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isLoading) return;

      setIsLoading(true);
      setError(null);

      try {
        const { data, error: invokeError } = await supabase.functions.invoke('ask', {
          body: { question: trimmed, concerts: concerts.map(toPayload) },
        });

        if (invokeError) {
          setError((await readErrorMessage(invokeError)) ?? 'Couldn’t get an answer. Try again.');
          return;
        }

        // Ground the answer in real data: keep only ids that match a concert
        // actually in the current listing, so an invented id renders nothing.
        const returnedIds: string[] = Array.isArray(data?.concertIds) ? data.concertIds : [];
        const matched = returnedIds
          .map((id) => concerts.find((concert) => concert.id === id))
          .filter((concert): concert is Concert => concert !== undefined);

        setExchanges((current) => [
          ...current,
          {
            id: `${Date.now()}`,
            question: trimmed,
            reply: typeof data?.reply === 'string' ? data.reply : '',
            concerts: matched,
          },
        ]);
        if (data?.usage) setLastUsage(data.usage as AskUsage);
      } catch {
        setError('Couldn’t reach the assistant. Check your connection and try again.');
      } finally {
        setIsLoading(false);
      }
    },
    [concerts, isLoading],
  );

  return { exchanges, ask, isLoading, error, lastUsage };
}
