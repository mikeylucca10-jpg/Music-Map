import Constants from 'expo-constants';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import { Platform, StyleSheet } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { Concert, City } from '@/types/concert';

const androidApiKey = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
const isAndroidMapsConfigured = Boolean(
  androidApiKey && androidApiKey !== 'REPLACE_WITH_YOUR_GOOGLE_MAPS_API_KEY',
);

type ConcertsMapProps = {
  concerts: Concert[];
  city: City;
  onSelectConcert: (concert: Concert) => void;
  userLocation?: { latitude: number; longitude: number } | null;
};

export function ConcertsMap({ concerts, city, onSelectConcert, userLocation }: ConcertsMapProps) {
  if (Platform.OS === 'android' && !isAndroidMapsConfigured) {
    return (
      <ThemedView style={styles.placeholderContainer}>
        <ThemedView type="backgroundElement" style={styles.placeholderCard}>
          <ThemedText type="smallBold">Android map needs setup</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            This screen uses Google Maps on Android, which needs your own Google Maps API key.
            Add it to <ThemedText type="code">app.json</ThemedText> under{' '}
            <ThemedText type="code">android.config.googleMaps.apiKey</ThemedText>, then rebuild
            the dev client.
          </ThemedText>
          <ExternalLink href="https://docs.expo.dev/versions/v57.0.0/sdk/maps/">
            <ThemedText type="linkPrimary">Setup instructions →</ThemedText>
          </ExternalLink>
        </ThemedView>
      </ThemedView>
    );
  }

  const markers = concerts.map((concert) => ({
    id: concert.id,
    coordinates: { latitude: concert.latitude, longitude: concert.longitude },
    title: concert.name,
  }));

  function handleMarkerClick(marker: { id?: string }) {
    const concert = concerts.find((item) => item.id === marker.id);
    if (concert) onSelectConcert(concert);
  }

  // isMyLocationEnabled draws the native "blue dot" using the OS's own
  // location system — gated on already having coords from useUserLocation
  // so it only turns on once our own soft-ask flow has actually granted
  // permission, rather than expo-maps triggering its own separate prompt.
  const properties = { isMyLocationEnabled: Boolean(userLocation) };

  // The native location button is the arrow the OS draws over the map, and it
  // lands under this screen's filter bar — the reset row and the Following
  // pill both overlap it, and the bar grows taller as filters are added, so it
  // gets worse the more the screen is used.
  //
  // Turned off rather than moved because expo-maps has no way to move it:
  // uiSettings only enables or disables. That is the same call the web map
  // already makes for the same reason — it sets zoomControl={false} because
  // Leaflet's +/- buttons sit in the corner the pills occupy.
  //
  // The blue dot is unaffected: it comes from isMyLocationEnabled above, not
  // from this button. What goes with the button is the tap-to-recentre
  // shortcut, which nothing else currently replaces.
  //
  // Every drawn control is off, not just the location arrow. The compass is
  // also an arrow — a needle, shown only once the map has been rotated, which
  // is why it appears to come and go — and the scale bar arrives on zoom.
  // Both land in the same corners. Turning off one at a time means finding the
  // next one the same way, from a screenshot, so they all go together.
  //
  // Only *chrome* is disabled. togglePitchEnabled is deliberately left alone:
  // it governs whether the user may change the pitch, so it is a gesture
  // permission rather than something the map draws.
  const uiSettings = {
    myLocationButtonEnabled: false,
    compassEnabled: false,
    scaleBarEnabled: false,
  };

  if (Platform.OS === 'android') {
    return (
      <GoogleMaps.View
        style={styles.map}
        cameraPosition={{ coordinates: city.mapCenter, zoom: 11 }}
        markers={markers}
        onMarkerClick={handleMarkerClick}
        properties={properties}
        uiSettings={uiSettings}
      />
    );
  }

  return (
    <AppleMaps.View
      style={styles.map}
      cameraPosition={{ coordinates: city.mapCenter, zoom: 11 }}
      markers={markers}
      onMarkerClick={handleMarkerClick}
      properties={properties}
      uiSettings={uiSettings}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  placeholderCard: {
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    maxWidth: 360,
  },
});
