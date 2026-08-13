import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';

import { Colors } from '@/constants/theme';
import { City, Concert } from '@/types/concert';

const markerIcon = L.divIcon({
  className: 'concert-marker',
  html: `<div style="width:16px;height:16px;border-radius:8px;background:${Colors.dark.accent};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

type LeafletConcertsMapProps = {
  concerts: Concert[];
  city: City;
  onSelectConcert: (concert: Concert) => void;
};

function RecenterOnCityChange({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
    // Depend on the lat/lng primitives, not the `center` array reference —
    // a new array is created every render, which would re-run this on any
    // unrelated re-render and reset the user's pan/zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], map]);
  return null;
}

export function LeafletConcertsMap({ concerts, city, onSelectConcert }: LeafletConcertsMapProps) {
  const center: [number, number] = [city.mapCenter.latitude, city.mapCenter.longitude];

  return (
    <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
      <RecenterOnCityChange center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {concerts.map((concert) => (
        <Marker
          key={concert.id}
          position={[concert.latitude, concert.longitude]}
          icon={markerIcon}
          eventHandlers={{ click: () => onSelectConcert(concert) }}
        />
      ))}
    </MapContainer>
  );
}
