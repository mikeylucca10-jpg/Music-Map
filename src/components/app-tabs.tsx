import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const colors = Colors.dark;

  // `indicatorColor` stays `accent`: the indicator is a fill that content sits
  // on top of. The selected *label* is the opposite case — a mark drawn on the
  // dark bar itself — so it takes `accentText` (5.3:1) rather than `accent`
  // (~4.4:1, which fails AA at tab-label size). See CLAUDE.md.
  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.accent}
      labelStyle={{ selected: { color: colors.accentText } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* Second, not last. Search is the way in when someone arrives with a
          name in mind rather than to browse, and that is a common enough
          entry point to sit beside Home. */}
      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Explore</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {/* No Ask trigger. The route still exists and is still reachable, it just
          isn't a tab — same as reset-password, privacy-policy, and terms. Its
          Edge Function was never deployed, so a tab would have led to a screen
          that could only fail. */}
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
