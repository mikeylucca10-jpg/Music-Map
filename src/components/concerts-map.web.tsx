import { lazy, Suspense, useState } from 'react';

import { City, Concert } from '@/types/concert';

// leaflet touches `window` at import time, which crashes Expo Router's
// Node-based static SSR render pass. Lazy-load it client-side only.
const LeafletConcertsMap = lazy(() =>
  import('./concerts-map-leaflet.web').then((mod) => ({ default: mod.LeafletConcertsMap })),
);

type ConcertsMapProps = {
  concerts: Concert[];
  city: City;
  onSelectConcert: (concert: Concert) => void;
  userLocation?: { latitude: number; longitude: number } | null;
};

export function ConcertsMap(props: ConcertsMapProps) {
  const [isClient] = useState(() => typeof window !== 'undefined');

  if (!isClient) return null;

  return (
    <Suspense fallback={null}>
      <LeafletConcertsMap {...props} />
    </Suspense>
  );
}
