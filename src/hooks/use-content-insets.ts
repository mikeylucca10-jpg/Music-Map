import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset, Spacing } from '@/constants/theme';

// Shared by screens using the ScrollView + contentInset pattern (list.tsx,
// settings.tsx) so the bottom-tab-bar inset math only lives in one place.
export function useContentInsets() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      // The web tab bar floats at the bottom now (matching native), so it's
      // paddingBottom that needs to clear it, not paddingTop.
      paddingTop: Spacing.four,
      paddingBottom: insets.bottom,
    },
  });

  return { insets, contentPlatformStyle };
}
