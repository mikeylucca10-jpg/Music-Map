import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors, DisplayFontFamily } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Root stack. The tab bar now lives one level down in `(tabs)/_layout.tsx`, so
 * routes declared here open *over* the tabs rather than inside them — which is
 * what lets a show have its own full screen, and what finally makes the legal
 * pages reachable by URL.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Archivo Expanded (SemiBold 600) carries the screen titles and the night
  // strip. Dropped from ExtraBold 800 because a lighter display weight reads as
  // editorial calm rather than shouting.
  //
  // The tree is gated on the font to avoid a visible reflow: the display face is
  // much wider than the system fallback, so swapping mid-render would re-lay-out
  // the header. The splash overlay is still up during the gate, so this is not a
  // blank screen. A decode error counts as ready on purpose — a broken font
  // should degrade to the system face, not hang behind a splash forever.
  const [fontsLoaded, fontError] = useFonts({
    [DisplayFontFamily]: require('@/assets/fonts/ArchivoExpanded-SemiBold.ttf'),
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.dark.background },
        }}>
        <Stack.Screen name="(tabs)" />
        {/* Slides up from the bottom: this is a detail *of* the list, and the
            gesture matches the one that opened it. */}
        <Stack.Screen name="concert/[id]" options={{ animation: 'slide_from_bottom' }} />
        {/* Parked, not a tab, but reachable at /ask -- it has to sit outside
            (tabs) for that, exactly like the legal pages. */}
        {/* Slides up: it is a task you come back from, not a place you go. */}
        <Stack.Screen name="follow-picker" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="ask" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </ThemeProvider>
  );
}
