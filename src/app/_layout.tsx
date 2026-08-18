import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { DisplayFontFamily } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  // Archivo Expanded (SemiBold 600) carries the screen titles and the night strip.
  // Dropped from ExtraBold 800: a lighter display weight reads as editorial calm
  // rather than shouting, which is the difference between looking designed and
  // looking loud. Gating the
  // tree on it avoids a visible reflow: the display face is much wider than the
  // system fallback, so swapping mid-render would visibly re-lay-out the
  // header. The splash overlay is still up during this, so the gate is not a
  // blank screen.
  //
  // `error` is treated as ready on purpose. A font that fails to decode should
  // degrade to the system face, not leave the app stuck behind a splash that
  // never lifts.
  const [fontsLoaded, fontError] = useFonts({
    [DisplayFontFamily]: require('@/assets/fonts/ArchivoExpanded-SemiBold.ttf'),
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
