/**
 * The ticket-status mapping.
 *
 * Worth pinning because the consequence of getting it wrong is asymmetric: a
 * missed `cancelled` shows someone a working "Buy Tickets" row for a show that
 * is not happening, while a false positive only hides links for a show that is.
 * The first is the app actively misleading someone; the second is a nuisance.
 */
import { normalizeStatus } from '@/services/ticketmaster';

describe('normalizeStatus', () => {
  it('maps every code the feed is known to return', () => {
    expect(normalizeStatus('onsale')).toBe('onsale');
    expect(normalizeStatus('offsale')).toBe('offsale');
    expect(normalizeStatus('cancelled')).toBe('cancelled');
    expect(normalizeStatus('postponed')).toBe('postponed');
    expect(normalizeStatus('rescheduled')).toBe('rescheduled');
  });

  it('is case-insensitive', () => {
    // The API returns lower case today and promises nothing about tomorrow.
    expect(normalizeStatus('Cancelled')).toBe('cancelled');
    expect(normalizeStatus('ONSALE')).toBe('onsale');
  });

  it('drops an unknown code rather than passing it through', () => {
    // Degrades to "treated as normal" instead of rendering a raw API string at
    // the user, which is what passing it through would do.
    expect(normalizeStatus('somethingNew')).toBeUndefined();
    expect(normalizeStatus('')).toBeUndefined();
    expect(normalizeStatus(undefined)).toBeUndefined();
  });
});
