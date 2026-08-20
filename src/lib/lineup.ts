import { ConcertSummary } from '@/types/concert';

/**
 * Normalise to space-separated words for "does the title already say this".
 *
 * Punctuation collapses to a space rather than being deleted, and that
 * distinction is load-bearing. Deleting it entirely turns the comparison into a
 * raw substring test, which produces false positives for short names: an act
 * called "B" matches the title "Big Night" because "bignight" contains a "b",
 * and a real act like Nero would silently vanish from a bill whose title
 * mentions Sonero. Collapsing to words lets the caller match on whole tokens
 * instead.
 *
 * Accents fold for the same reason they do in search — promoters and
 * attraction records disagree about them constantly.
 */
function loose(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Whether `title` contains `act` as a run of whole words.
 *
 * Padding both sides with spaces is what makes the boundaries real: " b " is
 * not found in " big night ", while " secret chiefs 3 " is found in
 * " igorrr w secret chiefs 3 ". It also survives the punctuation mismatch this
 * function exists for, since "F.Silvestris" and "F. Silvestris" both normalise
 * to "f silvestris".
 */
function containsWords(title: string, act: string) {
  return ` ${title} `.includes(` ${act} `);
}

/**
 * The acts playing alongside the headliner, minus anything the title already
 * names.
 *
 * Support acts matter more in electronic music than the "opener" framing
 * suggests: a three-name bill is often three peers, and the act someone
 * actually wants to see is frequently not the one listed first. Measured
 * against the live NYC feed, 8 of 50 kept shows carry two or more acts —
 * Steve Aoki with Nostalgix and Henry Fong, Odd Mob with San Pacho and Coco
 * Prosecco, Krewella with Nervo. Hiding those loses the reason to go.
 *
 * The title filter is the part that earns its place. Promoters put the full
 * bill in the event name about half the time ("Igorrr w/ Secret Chiefs 3",
 * "F.Silvestris, Angel Grace, Wishbone"), so printing the lineup unconditionally
 * would render the same names twice on the same card. Only the acts the title
 * has not already mentioned are returned, which means the extra line appears
 * exactly when it adds something.
 *
 * Returns an empty array rather than null so callers can branch on `.length`
 * without a second null check.
 */
export function getSupportActs(concert: Pick<ConcertSummary, 'name' | 'lineup'>): string[] {
  const lineup = concert.lineup;
  if (!lineup || lineup.length < 2) return [];

  const title = loose(concert.name);
  // Everything after the first: the first entry is the headliner, which the
  // card already leads with.
  return lineup.slice(1).filter((act) => {
    const key = loose(act);
    // A name that normalises to nothing — "???" — is not a real act, and
    // without this guard it would also match every title.
    if (!key) return false;
    return !containsWords(title, key);
  });
}

/**
 * "w/ Nostalgix, Henry Fong" — the scene's own shorthand.
 *
 * "with" spelled out reads as prose on a card that is otherwise all proper
 * nouns and times, and "featuring" implies a guest spot rather than a shared
 * bill. Returns null when there is nothing to add, so a caller can render it
 * or skip the line entirely without composing an empty string.
 */
export function formatSupportActs(
  concert: Pick<ConcertSummary, 'name' | 'lineup'>,
  limit = 3,
): string | null {
  const support = getSupportActs(concert);
  if (support.length === 0) return null;

  const shown = support.slice(0, limit);
  const remainder = support.length - shown.length;
  // "+2 more" rather than truncating mid-name: a clipped name is unreadable and
  // still occupies the space, while a count is honest about what is hidden and
  // the full bill is one tap away on the detail screen.
  return `w/ ${shown.join(', ')}${remainder > 0 ? ` +${remainder} more` : ''}`;
}
