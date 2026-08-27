import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { MinTouchTarget, Radius } from '@/constants/theme';

/**
 * Sign in with Apple, using Apple's own button rather than one styled to match
 * the app.
 *
 * That is a requirement, not a preference. Apple's Human Interface Guidelines
 * specify the mark, the wording, the proportions and the minimum size, and a
 * hand-rolled black pill with a custom glyph is a documented rejection reason.
 * `AppleAuthenticationButton` renders the system control, so it stays correct
 * on its own as the guidelines change.
 *
 * BLACK style because the app's ground is near-black and the white variants
 * would read as a bright slab in the middle of the form. Corner radius takes
 * the app's pill token so it sits with the buttons around it — radius is the
 * one property Apple leaves to the developer.
 *
 * Renders nothing where Apple sign-in cannot work. The component is iOS-only
 * hardware-backed, and `isAvailableAsync` is the documented check — a button
 * that opens nothing is worse than an absent one, and this is exactly the case
 * where the platform decides, not us.
 */
export function AppleSignInButton({ onPress }: { onPress: () => void }) {
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    // One-shot availability probe on mount — there is no render-phase way to
    // ask the OS this.
    AppleAuthentication.isAvailableAsync().then(setIsAvailable).catch(() => setIsAvailable(false));
  }, []);

  if (!isAvailable) return null;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={Radius.pill}
      onPress={onPress}
      style={styles.button}
    />
  );
}

const styles = StyleSheet.create({
  // Height is set here rather than left to intrinsic sizing: the control has no
  // natural height in a flex column and collapses to nothing without it.
  button: {
    width: '100%',
    height: MinTouchTarget + 4,
  },
});
