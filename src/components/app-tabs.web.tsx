import { BlurView } from 'expo-blur';
import type { Href } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon, type TabIconName } from './tab-icons.web';
import { ThemedText } from './themed-text';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          {/* Cast because the generated route types describe a group index as
              `/(tabs)/index` or `/index`, and neither is the URL this actually
              resolves to: `/index` is an unmatched route at runtime, and the
              group is stripped from real URLs. "/" is what the router serves. */}
          <TabTrigger name="home" href={"/" as Href} asChild>
            <TabButton icon="home">Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton icon="explore">Explore</TabButton>
          </TabTrigger>
          {/* No Ask trigger — see the note in app-tabs.tsx. */}
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="settings">Settings</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: TabIconName };

export function TabButton({ children, icon, isFocused, ...props }: TabButtonProps) {
  const colors = Colors.dark;

  return (
    <Pressable {...props} style={styles.tabButton}>
      {/* `accentText`, not `accent`: both the icon and the 11px label are marks
          drawn straight onto the dark bar, not content sitting on an accent
          fill. `accent` only reaches ~4.4:1 on `background`, which fails AA at
          this size; `accentText` reaches 5.3:1. See the two-accent-token rule
          in CLAUDE.md. */}
      <TabIcon name={icon} color={isFocused ? colors.accentText : colors.textSecondary} />
      <ThemedText
        type="small"
        style={{ color: isFocused ? colors.accentText : colors.textSecondary, fontSize: 11 }}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.tabListContainer}>
      <BlurView intensity={70} tint="dark" style={styles.blur}>
        <View {...props} style={[styles.innerContainer, { paddingBottom: insets.bottom || Spacing.two }]} />
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  blur: {
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
    backgroundColor: Colors.dark.overlayScrim,
  },
  innerContainer: {
    flexDirection: 'row',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingTop: Spacing.two,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.one,
  },
});
