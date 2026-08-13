import { Concert } from '@/types/concert';

export type TicketSource = {
  id: string;
  label: string;
  url: string;
  priceLabel: string | null;
  /** True for platforms we don't have a pricing API for — see mockPriceLabel below. */
  isEstimate: boolean;
  color: string;
  monogram: string;
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatRealPrice(min: number, max: number, currency: string) {
  const fmt =
    currency === 'USD'
      ? currencyFormatter
      : new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 });
  return min === max ? fmt.format(min) : `${fmt.format(min)}–${fmt.format(max)}`;
}

// TODO(real pricing): SeatGeek, StubHub, Dice, and CrowdVolt all require
// their own partner/affiliate API access to get real prices (SeatGeek
// Platform API, StubHub Partner Network, Dice Partner API, CrowdVolt has no
// public API yet). None of that is wired up — this generates a stable,
// clearly-marked *estimate* per concert+platform so the UI has something to
// show. Replace with a real fetch per platform once you have API access.
function mockPriceLabel(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const min = 25 + (hash % 90);
  const max = min + 20 + (hash % 40);
  return `~${currencyFormatter.format(min)}–${currencyFormatter.format(max)}`;
}

function searchTerm(concert: Concert) {
  return `${concert.artist ?? concert.name} ${concert.venueName}`;
}

// StubHub, SeatGeek, Dice, and CrowdVolt are all client-rendered SPAs with no
// documented flat "search?query=" URL, and SeatGeek/StubHub actively block
// non-browser requests, so a guessed direct deep-link risks landing on a
// dead or wrong page. A domain-scoped web search is guaranteed to resolve to
// something real. If you confirm an actual direct search URL for one of
// these later, swap it in here.
function scopedWebSearchUrl(domain: string, concert: Concert) {
  const query = encodeURIComponent(`site:${domain} ${searchTerm(concert)}`);
  return `https://www.google.com/search?q=${query}`;
}

export function getTicketSources(concert: Concert): TicketSource[] {
  const query = encodeURIComponent(searchTerm(concert));

  return [
    {
      id: 'ticketmaster',
      label: 'Ticketmaster',
      url: concert.url,
      priceLabel:
        concert.priceMin != null && concert.priceMax != null
          ? formatRealPrice(concert.priceMin, concert.priceMax, concert.priceCurrency ?? 'USD')
          : null,
      isEstimate: false,
      color: '#026cdf',
      monogram: 'TM',
    },
    {
      id: 'vividseats',
      label: 'Vivid Seats',
      url: `https://www.vividseats.com/search?searchTerm=${query}`,
      priceLabel: mockPriceLabel(`vividseats-${concert.id}`),
      isEstimate: true,
      color: '#6a3df5',
      monogram: 'VS',
    },
    {
      id: 'seatgeek',
      label: 'SeatGeek',
      url: scopedWebSearchUrl('seatgeek.com', concert),
      priceLabel: mockPriceLabel(`seatgeek-${concert.id}`),
      isEstimate: true,
      color: '#ff5b49',
      monogram: 'SG',
    },
    {
      id: 'stubhub',
      label: 'StubHub',
      url: scopedWebSearchUrl('stubhub.com', concert),
      priceLabel: mockPriceLabel(`stubhub-${concert.id}`),
      isEstimate: true,
      color: '#3ab54a',
      monogram: 'SH',
    },
    {
      id: 'dice',
      label: 'Dice',
      url: scopedWebSearchUrl('dice.fm', concert),
      priceLabel: mockPriceLabel(`dice-${concert.id}`),
      isEstimate: true,
      color: '#111111',
      monogram: 'DI',
    },
    {
      id: 'crowdvolt',
      label: 'CrowdVolt',
      url: scopedWebSearchUrl('crowdvolt.com', concert),
      priceLabel: mockPriceLabel(`crowdvolt-${concert.id}`),
      isEstimate: true,
      color: '#00b3a4',
      monogram: 'CV',
    },
  ];
}
