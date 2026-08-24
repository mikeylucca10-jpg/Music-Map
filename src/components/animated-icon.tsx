import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Colors, DisplayFontFamily } from '@/constants/theme';

/**
 * Short on purpose.
 *
 * Guidance is blunt: one logo, one colour, and no animation past ~200ms. A
 * splash beyond 1.5 seconds costs roughly 12% of users to abandonment, and past
 * three seconds more than half of new ones. This is a handshake, not a brand
 * presentation -- it covers the gap while fonts resolve and should be gone
 * before anyone decides to wait.
 */
const DURATION = 250;

/**
 * The app's own launch screen, replacing the Expo starter template's.
 *
 * What was here before was entirely Expo's: expo-logo.png on Expo blue
 * (#208AEF), with a blue gradient card behind it. The app it introduces is
 * near-black with a red accent, so every launch flashed bright blue and then
 * cut to a dark app — and, worse, branded the product as somebody else's for
 * the first half-second of every session.
 *
 * A wordmark rather than a logo, because there is no logo and inventing a mark
 * would be a worse guess than using the identity the app already has. The
 * display face is the identity here: Archivo Expanded is wide and heavy
 * precisely because it reads as marquee signage, which is the subject. Setting
 * the name in it on the app's own ground says more than a placeholder symbol
 * would.
 *
 * The native splash in app.json now uses the same background, so the handoff
 * from it to this is invisible — no flash between the two.
 */
export function AnimatedSplashOverlay() {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  // Fades rather than moves. A splash that slides or scales draws attention to
  // itself at the exact moment attention should be moving to the content
  // behind it, and motion here delays nothing while adding nothing.
  // Starts fading immediately rather than holding first. The previous version
  // sat at full opacity for the opening 40%, which spent time without showing
  // anything new — the wordmark is already on screen by then, painted by the
  // native splash this hands off from.
  const splashKeyframe = new Keyframe({
    0: { opacity: 1 },
    100: { opacity: 0, easing: Easing.inOut(Easing.quad) },
  });

  const wordmark = (
    <Text style={styles.wordmark} allowFontScaling={false}>
      MUSIC MAP
    </Text>
  );

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {wordmark}
    </Animated.View>
  ) : (
    <View
      // Hidden on first layout rather than on a timer: the native splash stays
      // up until this view has actually painted, so there is never a frame of
      // empty screen between the two.
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setAnimate(true);
        });
      }}
      style={styles.splashOverlay}>
      {wordmark}
    </View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    // Matches the native splash exactly, so the handoff between them cannot be
    // seen. Read from Colors rather than hardcoded, since this is the one
    // colour that has to agree with app.json.
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  wordmark: {
    fontFamily: DisplayFontFamily,
    // Off-scale deliberately: this is a wordmark, not body copy, and it is the
    // only text on the screen. Letter-spacing opens it up the way signage is
    // set rather than the way a headline is.
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 2,
    color: Colors.dark.text,
  },
});
