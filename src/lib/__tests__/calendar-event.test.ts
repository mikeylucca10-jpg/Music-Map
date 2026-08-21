import { buildCalendarEvent, buildGoogleCalendarUrl } from '@/lib/calendar-event';
import { ConcertSummary } from '@/types/concert';

function makeConcert(overrides: Partial<ConcertSummary> = {}): ConcertSummary {
  return {
    id: 'tm-1',
    name: 'Odd Mob',
    url: 'https://tickets.example.com/odd-mob',
    // 03:00Z is 11pm the previous evening in New York.
    startDateTime: '2026-09-12T03:00:00Z',
    timezone: 'America/New_York',
    venueName: 'Brooklyn Steel',
    address: '319 Frost St, Brooklyn, NY',
    ...overrides,
  };
}

describe('buildCalendarEvent', () => {
  it('leads with the show name rather than a prefix', () => {
    // Their calendar already knows it is an event; a "Concert:" prefix only
    // pushes the part they need past the truncation point in a week view.
    expect(buildCalendarEvent(makeConcert()).title).toBe('Odd Mob');
  });

  it('assumes a three hour show, since no source gives an end time', () => {
    const event = buildCalendarEvent(makeConcert());
    const hours = (event.endDate.getTime() - event.startDate.getTime()) / 3_600_000;
    expect(hours).toBe(3);
  });

  it('puts the venue and the address in the location', () => {
    // A calendar entry is read on the way there: the name alone cannot be
    // navigated to, and the address alone does not say which door.
    expect(buildCalendarEvent(makeConcert()).location).toBe(
      'Brooklyn Steel, 319 Frost St, Brooklyn, NY',
    );
  });

  it('carries the full lineup and the ticket link into the notes', () => {
    const notes = buildCalendarEvent(
      makeConcert({ lineup: ['Odd Mob', 'San Pacho', 'Coco Prosecco'] }),
    ).notes;
    expect(notes).toContain('Lineup: Odd Mob, San Pacho, Coco Prosecco');
    expect(notes).toContain('Tickets: https://tickets.example.com/odd-mob');
  });

  it('omits absent fields instead of printing empty lines', () => {
    const notes = buildCalendarEvent(makeConcert()).notes;
    expect(notes).not.toContain('Lineup:');
    expect(notes).not.toContain('Also listed at:');
    expect(notes.split('\n').every((line) => line.trim().length > 0)).toBe(true);
  });

  it('names the other times a show is listed at', () => {
    // The entry uses the earliest listing, so it should say the earlier one was
    // a choice rather than the only option.
    const notes = buildCalendarEvent(
      makeConcert({
        startDateTime: '2026-09-11T19:00:00Z',
        alsoStartsAt: ['2026-09-11T22:00:00Z'],
      }),
    ).notes;
    expect(notes).toContain('Also listed at:');
    expect(notes).toContain('6:00');
  });
});

describe('buildGoogleCalendarUrl', () => {
  const url = buildGoogleCalendarUrl(buildCalendarEvent(makeConcert()));

  it('builds a Google Calendar template link', () => {
    expect(url.startsWith('https://calendar.google.com/calendar/render?')).toBe(true);
    expect(url).toContain('action=TEMPLATE');
  });

  it('stamps times in the compact UTC form Google expects', () => {
    // YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ — no dashes, no colons, no millis.
    // A malformed range is silently ignored by Google, which would produce an
    // empty event rather than an error.
    expect(url).toContain('dates=20260912T030000Z%2F20260912T060000Z');
  });

  it('carries the location through', () => {
    // URLSearchParams encodes spaces as "+", which is valid in a query string
    // but which decodeURIComponent does not reverse — so the "+" has to be
    // undone first or this compares against the wrong thing.
    const decoded = decodeURIComponent(url).replace(/\+/g, ' ');
    expect(decoded).toContain('Brooklyn Steel, 319 Frost St, Brooklyn, NY');
  });
});
