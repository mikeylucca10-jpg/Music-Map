import { supabase } from '@/lib/supabase';

export type FollowKind = 'artist' | 'venue';

export type Follow = {
  kind: FollowKind;
  /** Normalised for matching — see followKey. */
  key: string;
  /** Original casing, for display. */
  name: string;
};

/**
 * Ticketmaster does not attach a stable artist id to every event, and a second
 * source would supply different ids again, so the name is the only key that
 * works across sources. Normalising here — rather than relying on whatever
 * casing and spacing a given listing used — is what makes "Black Coffee" and
 * "black coffee " the same follow.
 */
export function followKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const TABLE: Record<FollowKind, { table: string; keyCol: string; nameCol: string }> = {
  artist: { table: 'followed_artists', keyCol: 'artist_key', nameCol: 'artist_name' },
  venue: { table: 'followed_venues', keyCol: 'venue_key', nameCol: 'venue_name' },
};

export async function fetchFollows(userId: string): Promise<Follow[]> {
  const [artists, venues] = await Promise.all([
    supabase.from('followed_artists').select('artist_key, artist_name').eq('user_id', userId),
    supabase.from('followed_venues').select('venue_key, venue_name').eq('user_id', userId),
  ]);
  if (artists.error) throw new Error(artists.error.message);
  if (venues.error) throw new Error(venues.error.message);

  return [
    ...(artists.data ?? []).map((row) => ({
      kind: 'artist' as const,
      key: row.artist_key,
      name: row.artist_name,
    })),
    ...(venues.data ?? []).map((row) => ({
      kind: 'venue' as const,
      key: row.venue_key,
      name: row.venue_name,
    })),
  ];
}

/**
 * @param artistId the source's stable id, when the caller has one. Stored
 *   alongside the name rather than instead of it: an id makes matching exact
 *   where both sides have one, and the name still has to work for the ~20% of
 *   events with no attraction attached, and for a second source whose ids will
 *   never equal Ticketmaster's.
 */
export async function addFollow(
  userId: string,
  kind: FollowKind,
  name: string,
  artistId?: string,
): Promise<void> {
  const { table, keyCol, nameCol } = TABLE[kind];
  const { error } = await supabase
    .from(table)
    // upsert rather than insert: following something already followed should be
    // a no-op, not a primary-key violation surfaced as an error to the user.
    .upsert({
      user_id: userId,
      [keyCol]: followKey(name),
      [nameCol]: name,
      ...(kind === 'artist' && artistId ? { artist_id: artistId } : {}),
    });
  if (error) throw new Error(error.message);
}

export async function removeFollow(userId: string, kind: FollowKind, name: string): Promise<void> {
  const { table, keyCol } = TABLE[kind];
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('user_id', userId)
    .eq(keyCol, followKey(name));
  if (error) throw new Error(error.message);
}

/**
 * Follow several things at once.
 *
 * A picker where someone taps six artists should be one request, not six. Six
 * sequential round trips is both slow and partially-failable — you would end up
 * with four follows and an error, and no obvious way to tell which four.
 *
 * Artists and venues still go to their own tables, so this is at most two
 * requests regardless of how many things were selected.
 */
export async function addFollows(
  userId: string,
  items: { kind: FollowKind; name: string }[],
): Promise<void> {
  const byKind = { artist: [] as string[], venue: [] as string[] };
  for (const item of items) byKind[item.kind].push(item.name);

  await Promise.all(
    (Object.keys(byKind) as FollowKind[])
      .filter((kind) => byKind[kind].length > 0)
      .map(async (kind) => {
        const { table, keyCol, nameCol } = TABLE[kind];
        const rows = byKind[kind].map((name) => ({
          user_id: userId,
          [keyCol]: followKey(name),
          [nameCol]: name,
        }));
        const { error } = await supabase.from(table).upsert(rows);
        if (error) throw new Error(error.message);
      }),
  );
}
