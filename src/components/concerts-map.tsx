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
};

export function ConcertsMap({ concerts, city, onSelectConcert }: ConcertsMapProps) {
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

  if (Platform.OS === 'android') {
    return (
      <GoogleMaps.View
        style={styles.map}
        cameraPosition={{ coordinates: city.mapCenter, zoom: 11 }}
        markers={markers}
        onMarkerClick={handleMarkerClick}
      />
    );
  }

  return (
    <AppleMaps.View
      style={styles.map}
      cameraPosition={{ coordinates: city.mapCenter, zoom: 11 }}
      markers={markers}
      onMarkerClick={handleMarkerClick}
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
