import { BlurView } from 'expo-blur';
import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { SymbolView, SymbolViewProps } from 'expo-symbols';
import { Pressable, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

// This file only ever runs on web, so these are Material Symbol names
// (matching the `md=` values used for the native tab bar's icons).
const TAB_ICONS: Record<string, SymbolViewProps['name']> = {
  home: { web: 'home' },
  explore: { web: 'map' },
  ask: { web: 'chat' },
  settings: { web: 'settings' },
};

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton icon="home">Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton icon="explore">Explore</TabButton>
          </TabTrigger>
          <TabTrigger name="ask" href="/ask" asChild>
            <TabButton icon="ask">Ask</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="settings">Settings</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & { icon: keyof typeof TAB_ICONS };

export function TabButton({ children, icon, isFocused, ...props }: TabButtonProps) {
  const colors = Colors.dark;

  return (
    <Pressable {...props} style={styles.tabButton}>
      <SymbolView
        name={TAB_ICONS[icon]}
        tintColor={isFocused ? colors.accent : colors.textSecondary}
        size={22}
      />
      <ThemedText
        type="small"
        style={{ color: isFocused ? colors.accent : colors.textSecondary, fontSize: 11 }}>
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
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(10, 10, 10, 0.6)',
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
