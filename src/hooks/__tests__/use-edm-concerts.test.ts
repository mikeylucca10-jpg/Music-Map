import { dedupeConcerts } from '@/hooks/use-edm-concerts';
import { Concert } from '@/types/concert';

function makeConcert(overrides: Partial<Concert> = {}): Concert {
  return {
    id: 'tm-1',
    source: 'ticketmaster',
    name: 'Gimme Gimme Disco',
    url: 'https://example.com',
    startDateTime: '2026-08-22T22:30:00Z',
    venueName: 'The Rooftop at Pier 17',
    address: '89 South St, New York, NY',
    latitude: 40.7055,
    longitude: -74.0025,
    ...overrides,
  };
}

describe('dedupeConcerts', () => {
  it('collapses the same show listed twice', () => {
    // The real case this was written for: Ticketmaster returns separate
    // GA and VIP "events" for one show, with different ids but identical
    // name, venue, and start time.
    const deduped = dedupeConcerts([
      makeConcert({ id: 'tm-ga' }),
      makeConcert({ id: 'tm-vip' }),
    ]);
    expect(deduped).toHaveLength(1);
  });

  it('keeps the first listing of a duplicate pair', () => {
    const deduped = dedupeConcerts([
      makeConcert({ id: 'tm-ga' }),
      makeConcert({ id: 'tm-vip' }),
    ]);
    expect(deduped[0].id).toBe('tm-ga');
  });

  // The whole reason the key includes the exact start time: a multi-day
  // festival is one name at one venue across several days, and each day is a
  // genuinely separate event that must stay on the calendar.
  it('keeps every day of a multi-day festival', () => {
    const deduped = dedupeConcerts([
      makeConcert({ id: 'day-1', name: 'Electric Zoo', startDateTime: '2026-09-04T18:00:00Z' }),
      makeConcert({ id: 'day-2', name: 'Electric Zoo', startDateTime: '2026-09-05T18:00:00Z' }),
      makeConcert({ id: 'day-3', name: 'Electric Zoo', startDateTime: '2026-09-06T18:00:00Z' }),
    ]);
    expect(deduped).toHaveLength(3);
  });

  it('keeps same-named shows at different venues', () => {
    const deduped = dedupeConcerts([
      makeConcert({ id: 'a', venueName: 'Brooklyn Mirage' }),
      makeConcert({ id: 'b', venueName: 'Webster Hall' }),
    ]);
    expect(deduped).toHaveLength(2);
  });

  it('ignores casing and surrounding whitespace when comparing', () => {
    const deduped = dedupeConcerts([
      makeConcert({ id: 'a', name: 'Gimme Gimme Disco' }),
      makeConcert({ id: 'b', name: '  gimme gimme DISCO  ' }),
    ]);
    expect(deduped).toHaveLength(1);
  });

  it('handles an empty list', () => {
    expect(dedupeConcerts([])).toEqual([]);
  });
});
