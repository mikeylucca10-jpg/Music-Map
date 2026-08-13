// All current cities are NYC-only (see CITIES in types/concert.ts), so this
// is hardcoded to America/New_York — revisit per-city once more cities exist.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/New_York',
});

export function formatConcertDateTime(startDateTime: string) {
  return dateFormatter.format(new Date(startDateTime));
}
