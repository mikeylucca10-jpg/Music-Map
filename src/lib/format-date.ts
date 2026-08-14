// All current cities are NYC-only (see CITIES in types/concert.ts), so this
// is hardcoded to America/New_York — revisit per-city once more cities exist.
const NYC_TIME_ZONE = 'America/New_York';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: NYC_TIME_ZONE,
});

export function formatConcertDateTime(startDateTime: string) {
  return dateFormatter.format(new Date(startDateTime));
}

const dateKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: NYC_TIME_ZONE,
});

// 'YYYY-MM-DD' in NYC local time — used to compare "which calendar day" a
// concert falls on for the date filter, regardless of the viewer's own
// device timezone (en-CA gives that format directly, no string surgery).
export function getNycDateKey(date: Date) {
  return dateKeyFormatter.format(date);
}

const dateKeyLabelFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

// Formats a 'YYYY-MM-DD' key (as produced by getNycDateKey, or built
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
