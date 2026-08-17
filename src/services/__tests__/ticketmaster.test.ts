import { pickImageForWidth, type TicketmasterImage } from '@/services/ticketmaster';

// The size ladder a real Ticketmaster event returns, deliberately in the
// unsorted order the API actually uses — the 305px thumbnail really does come
// before the 2426px original in the live response, which is the whole reason
// this function exists rather than reading images[0].
const LADDER: TicketmasterImage[] = [
  { url: 'w100', width: 100, height: 56 },
  { url: 'w305', width: 305, height: 225 },
  { url: 'w2426', width: 2426, height: 1365 },
  { url: 'w640', width: 640, height: 360 },
  { url: 'w1024', width: 1024, height: 576 },
  { url: 'w205', width: 205, height: 115 },
  { url: 'w1136', width: 1136, height: 639 },
  { url: 'w2048', width: 2048, height: 1152 },
];

describe('pickImageForWidth', () => {
  it('takes the smallest image that still covers the target', () => {
    // 720 = the shipped setting (360pt display x 2). 1024 is the first rung
    // above it; 640 would be under-resolution.
    expect(pickImageForWidth(LADDER, 720)).toBe('w1024');
  });

  it('does not overshoot to the largest available', () => {
    // The previous rule always returned w2426 here. That is 537KB measured,
    // against roughly 157KB for w1024, for a card about 360pt wide.
    expect(pickImageForWidth(LADDER, 720)).not.toBe('w2426');
  });

  it('never returns a thumbnail while something clears the target', () => {
    // The failure mode that made "largest" attractive in the first place:
    // images[0] is a 100px thumbnail and must never win.
    for (const target of [200, 400, 720, 1200]) {
      const picked = pickImageForWidth(LADDER, target);
      const width = LADDER.find((image) => image.url === picked)?.width ?? 0;
      expect(width).toBeGreaterThanOrEqual(target);
    }
  });

  it('falls back to the largest when nothing reaches the target', () => {
    expect(pickImageForWidth(LADDER, 5000)).toBe('w2426');
  });

  it('picks an exact match rather than the next rung up', () => {
    expect(pickImageForWidth(LADDER, 1024)).toBe('w1024');
  });

  it('returns undefined for missing or empty input', () => {
    expect(pickImageForWidth(undefined, 720)).toBeUndefined();
    expect(pickImageForWidth([], 720)).toBeUndefined();
  });

  it('treats images with no dimensions as too small rather than crashing', () => {
    const images: TicketmasterImage[] = [{ url: 'unknown' }, { url: 'w640', width: 640, height: 360 }];
    expect(pickImageForWidth(images, 500)).toBe('w640');
    // Nothing clears the target, so the fallback runs; the sized one still
    // beats the dimensionless one on area.
    expect(pickImageForWidth(images, 5000)).toBe('w640');
  });
});
