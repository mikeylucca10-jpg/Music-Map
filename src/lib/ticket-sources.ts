import { ConcertSummary } from '@/types/concert';

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

// TODO(real pricing): SeatGeek, StubHub, Dice, CrowdVolt, TIXR, and AXS all
// require their own partner/affiliate API access to get real prices
// (SeatGeek Platform API, StubHub Partner Network, Dice Partner API,
// CrowdVolt has no public API yet, TIXR's public API is organizer/Studio-
// facing only, AXS's Platform API is gated to established distribution
// partners). None of that is wired up — this generates a stable,
// clearly-marked *estimate* per concert+platform so the UI has something to
// show. Replace with a real fetch per platform once you have API access.
function mockPriceLabel(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const min = 25 + (hash % 90);
  const max = min + 20 + (hash % 40);
  return `~${currencyFormatter.format(min)}–${currencyFormatter.format(max)}`;
}

function searchTerm(concert: ConcertSummary) {
  return `${concert.artist ?? concert.name} ${concert.venueName}`;
}

// StubHub, SeatGeek, Dice, and CrowdVolt are all client-rendered SPAs with no
// documented flat "search?query=" URL, and SeatGeek/StubHub actively block
// non-browser requests, so a guessed direct deep-link risks landing on a
// dead or wrong page. A domain-scoped web search is guaranteed to resolve to
// something real. If you confirm an actual direct search URL for one of
// these later, swap it in here.
function scopedWebSearchUrl(domain: string, concert: ConcertSummary) {
  const query = encodeURIComponent(`site:${domain} ${searchTerm(concert)}`);
  return `https://www.google.com/search?q=${query}`;
}

export function getTicketSources(concert: ConcertSummary): TicketSource[] {
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
    {
      id: 'tixr',
      label: 'TIXR',
      // No confirmed direct search URL — tixr.com runs DataDome bot
      // protection and 403s non-browser requests even to the homepage, and
      // there's no documented public search endpoint (only an org-facing
      // Studio API). Same fallback treatment as SeatGeek/StubHub/Dice/
      // CrowdVolt.
      url: scopedWebSearchUrl('tixr.com', concert),
      priceLabel: mockPriceLabel(`tixr-${concert.id}`),
      isEstimate: true,
      color: '#00e6b8',
      monogram: 'TX',
    },
    {
      id: 'axs',
      label: 'AXS',
      // Confirmed working direct search URL (unlike SeatGeek/StubHub/Dice/
      // CrowdVolt below/above) — verified against a live axs.com/search?q=
      // example. No public pricing API (partner/enterprise-gated), hence
      // still an estimate.
      url: `https://www.axs.com/search?q=${query}`,
      priceLabel: mockPriceLabel(`axs-${concert.id}`),
      isEstimate: true,
      color: '#e01f3d',
      monogram: 'AX',
    },
  ];
}
