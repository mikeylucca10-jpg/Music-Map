/**
 * Concert times are formatted in the *venue's* timezone, never the viewer's.
 *
 * This is what the ticketing platforms do, and it is the opposite of what a
 * naive "show it in local time" reading suggests. A 9pm show in Los Angeles is
 * a 9pm show — that is the time on the ticket, the time you tell a friend, and
 * the organiser's actual intent. Converting it to a New York viewer's clock
 * would render it "12:00 AM" on the *following day*: technically correct about
 * the instant, useless as a fact about the event, and actively misleading about
 * which night it is on.
 *
 * Every formatter here therefore takes an IANA timezone. There is no
 * viewer-timezone path on purpose; adding one would mean two different answers
 * to "when is this show", which is worse than one occasionally surprising one.
 *
 * Note the deliberate asymmetry further down: the *event* formatters are
 * zone-aware because an event happens at a fixed place, while the calendar-grid
 * helpers are not, because "what day is it today" is a question about the
 * person holding the phone.
 */

/**
 * Fallback when a concert carries no timezone of its own.
 *
 * Every Ticketmaster event currently does carry one (measured: venue.timezone
 * present on 86/86 NYC and 100/100 LA listings), so this is a genuine
 * last-resort — it exists so a future source with thinner data degrades to a
 * plausible time rather than crashing or rendering "Invalid Date".
 */
export const DEFAULT_TIME_ZONE = 'America/New_York';

/**
 * Intl.DateTimeFormat construction is the expensive part — it resolves locale
 * and timezone data — while .format() on an existing instance is cheap. These
 * are built per timezone and reused, since the list rebuilds a formatter for
 * every visible card on every filter change and there are only ever a handful
 * of distinct zones in play.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function cachedFormatter(
  cacheKey: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
) {
  const key = `${cacheKey}|${timeZone}`;
  const existing = formatterCache.get(key);
  if (existing) return existing;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone });
  } catch {
    // An unrecognised IANA zone throws a RangeError rather than falling back.
    // A show at the wrong hour is a much smaller failure than a screen that
    // will not render, so bad data degrades instead of crashing.
    formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: DEFAULT_TIME_ZONE });
  }
  formatterCache.set(key, formatter);
  return formatter;
}

/**
 * "Fri, Aug 22, 9:00 PM" in the venue's local time.
 *
 * @param timeZone the venue's IANA zone. Optional so a caller that genuinely
 *   has no concert context still compiles, but every real call site passes
 *   `concert.timezone`.
 */
export function formatConcertDateTime(startDateTime: string, timeZone = DEFAULT_TIME_ZONE) {
  return cachedFormatter('datetime', timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(startDateTime));
}

/**
 * The short zone name — "EDT", "PDT" — for showing *which* clock a time is on.
 *
 * Only worth rendering when it is not obvious, which in practice means when the
 * viewer's own zone differs from the venue's. See shouldShowTimeZone.
 */
export function formatTimeZoneAbbreviation(startDateTime: string, timeZone = DEFAULT_TIME_ZONE) {
  const parts = cachedFormatter('tzname', timeZone, {
    timeZoneName: 'short',
  }).formatToParts(new Date(startDateTime));
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
}

/**
 * Whether a time needs its zone spelled out.
 *
 * Someone in New York reading New York listings does not need "EDT" on every
 * row — it is noise on the overwhelmingly common case. Someone in New York
 * reading Los Angeles listings very much does, otherwise "9:00 PM" silently
 * means something different from what they assume. So the label appears exactly
 * when the two zones disagree.
 *
 * Compared by resolved offset rather than by zone name, so America/New_York and
 * America/Detroit — the same clock, different identifiers — do not trigger a
 * pointless "EST" badge.
 */
export function shouldShowTimeZone(startDateTime: string, timeZone = DEFAULT_TIME_ZONE) {
  try {
    const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!viewerZone || viewerZone === timeZone) return false;
    const instant = new Date(startDateTime);
    return (
      cachedFormatter('offsetcheck', timeZone, { hour: 'numeric', minute: '2-digit' }).format(
        instant,
      ) !==
      cachedFormatter('offsetcheck', viewerZone, { hour: 'numeric', minute: '2-digit' }).format(
        instant,
      )
    );
  } catch {
    return false;
  }
}

/**
 * 'YYYY-MM-DD' for the calendar day a concert falls on *in the venue's zone*.
 *
 * This is what makes "shows on Saturday" mean the same thing as the Saturday
 * printed on the ticket. A 9pm Los Angeles show is 04:00Z the next day, so
 * keying it off UTC — or off a New York viewer's clock — files it under Sunday
 * and it vanishes from the Saturday filter.
 *
 * en-CA because it yields YYYY-MM-DD directly, with no string surgery.
 */
export function getConcertDateKey(date: Date, timeZone = DEFAULT_TIME_ZONE) {
  return cachedFormatter(
    'datekey',
    timeZone,
    { year: 'numeric', month: '2-digit', day: '2-digit' },
    'en-CA',
  ).format(date);
}

const dateKeyLabelFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

// Formats a 'YYYY-MM-DD' key (as produced by getConcertDateKey, or built
// directly from a calendar grid's year/month/day) into a display label like
// "Thu, Aug 13". Constructed from the y/m/d integers directly at noon local
// time, not parsed as an ISO string — that avoids UTC/local-midnight
// off-by-one issues, and no timezone conversion is needed since the key's
// date components are already the intended calendar day.
export function formatDateKeyLabel(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return dateKeyLabelFormatter.format(new Date(year, month - 1, day, 12));
}

export function dateKeyFor(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const weekRangeFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

// "Aug 24 – Aug 30" — used for the week-navigator label once you're more
// than one week out (offsets 0/1 use fixed "This Week"/"Next Week" labels
// instead, see use-concerts-filters.ts).
export function formatWeekRangeLabel(weekStart: Date, weekEnd: Date) {
  return `${weekRangeFormatter.format(weekStart)} – ${weekRangeFormatter.format(weekEnd)}`;
}

/**
 * "Sat, Sep 12, 3:00 PM & 6:00 PM" -- one date, every time it is listed at.
 *
 * The date is stated once because the extra times are always the same night;
 * repeating it would make one show read as two. Ampersand rather than a comma
 * so the second time cannot be mistaken for a second date.
 */
export function formatConcertDateTimeWithExtras(
  startDateTime: string,
  alsoStartsAt: string[] | undefined,
  timeZone = DEFAULT_TIME_ZONE,
) {
  const primary = formatConcertDateTime(startDateTime, timeZone);
  if (!alsoStartsAt?.length) return primary;
  const timeOnly = cachedFormatter('timeonly', timeZone, { hour: 'numeric', minute: '2-digit' });
  const extras = alsoStartsAt.map((time) => timeOnly.format(new Date(time)));
  return [primary, ...extras].join(' & ');
}
