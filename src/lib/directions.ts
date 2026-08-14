import { Platform } from 'react-native';

// Deep-links into the native Maps app with directions to a destination,
// defaulting to the current location as origin and no forced travel mode —
// so the user sees Apple/Google Maps' own walk/drive/transit/bike picker
// rather than a single guessed route.
//
// Query by "Venue Name, Address" text rather than raw lat/lng: Google's own
// docs warn that a bare coordinate produces "a pin in the map, but no
// additional place information" — i.e. it doesn't show the venue name,
// which reads as untrustworthy/wrong-looking even when it's the correct
// spot. Geocoding a real name+address resolves to the actual named place.
export function getDirectionsUrl(destination: { venueName: string; address: string }): string {
  const query = destination.address
    ? `${destination.venueName}, ${destination.address}`
    : destination.venueName;
  const encoded = encodeURIComponent(query);

  if (Platform.OS === 'ios') {
    // The long-established maps.apple.com/?daddr= scheme, not Apple's newer
    // unified /directions endpoint — that one requires iOS 18.4+, which
    // would break this entirely for anyone on an older iOS version.
    return `https://maps.apple.com/?daddr=${encoded}`;
  }
  // Google's universal cross-platform URL — opens the Google Maps app on
  // Android if installed, otherwise falls back to the web, so this also
  // works as-is for the web build.
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}
