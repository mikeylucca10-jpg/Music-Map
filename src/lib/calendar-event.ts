import { ConcertSummary } from '@/types/concert';

/**
 * How long to assume a show runs.
 *
 * No source gives an end time — Ticketmaster returns only a start — so this is
 * a guess, and it is deliberately a modest one. Three hours covers a typical
 * billed set without blocking out someone's whole evening; a club night that
 * genuinely runs until 4am would otherwise paint a six-hour bar across their
 * calendar on the strength of an assumption.
 *
 * The system calendar sheet is pre-filled rather than written silently, so the
 * end time is visible and editable before anything is saved. That is the real
 * safeguard here: a wrong guess costs one tap to fix, not a wrong calendar.
 */
const ASSUMED_SHOW_HOURS = 3;

export type CalendarEventDraft = {
  title: string;
  startDate: Date;
  endDate: Date;
  location: string;
  notes: string;
  url?: string;
};

/**
 * Turns a concert into the event someone would actually want in their calendar.
 *
 * The title leads with the show name rather than a prefix like "Concert:" —
 * their calendar already knows it is an event, and a prefix only pushes the
 * part they need past the truncation point in a week view.
 */
export function buildCalendarEvent(concert: ConcertSummary): CalendarEventDraft {
  const startDate = new Date(concert.startDateTime);
  const endDate = new Date(startDate.getTime() + ASSUMED_SHOW_HOURS * 60 * 60 * 1000);

  // Everything the notes can usefully carry, skipping anything absent rather
  // than printing an empty line for it.
  const notes = [
    concert.artist && concert.artist !== concert.name ? concert.artist : null,
    concert.lineup && concert.lineup.length > 1 ? `Lineup: ${concert.lineup.join(', ')}` : null,
    // The other times this show is listed at, when there are any — the calendar
    // entry uses the earliest, and it should say the earlier one was a choice.
    concert.alsoStartsAt?.length
      ? `Also listed at: ${concert.alsoStartsAt
          .map((time) =>
            new Date(time).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: concert.timezone,
            }),
          )
          .join(', ')}`
      : null,
    concert.url ? `Tickets: ${concert.url}` : null,
    'Added from Music Map',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    title: concert.name,
    startDate,
    endDate,
    // Venue *and* address, because a calendar entry is read on the way there.
    // The name alone is not enough to navigate to, and the address alone does
    // not tell you which door you are looking for.
    location: [concert.venueName, concert.address].filter(Boolean).join(', '),
    notes,
    url: concert.url,
  };
}

/**
 * A Google Calendar "add event" link, used on web.
 *
 * expo-calendar throws outright on web — it is a native module and its web
 * build exists only to say so. Rather than hide the button on the one platform
 * this app is developed and demoed on, web hands off to Google Calendar's
 * template URL, which pre-fills exactly the same fields and works in any
 * browser without an SDK.
 *
 * Times are UTC in the compact form Google expects (`YYYYMMDDTHHMMSSZ`). That
 * is not a contradiction of the venue-timezone rule everywhere else in this
 * app: an instant is unambiguous, and Google renders it on the calendar the
 * user actually keeps, which is the right clock for a reminder they will read
 * at home.
 */
export function buildGoogleCalendarUrl(event: CalendarEventDraft): string {
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(event.startDate)}/${stamp(event.endDate)}`,
    details: event.notes,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
