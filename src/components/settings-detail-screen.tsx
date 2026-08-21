import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type SettingsDetailScreenProps = {
  title: string;
  /** One line under the title, for a screen whose purpose is not self-evident. */
  subtitle?: string;
  children: ReactNode;
  /** Opt out of the ScrollView, for a screen that renders its own list. */
  scroll?: boolean;
};

/**
 * The shell every Settings sub-screen sits in.
 *
 * Shared rather than repeated so the five of them cannot drift apart — the
 * back button in the same place, the title at the same size, the same bottom
 * inset clearing the tab bar. A settings section that looks subtly different
 * from its siblings reads as a bug even when nothing is wrong.
 *
 * Not ScreenScaffold, which is built for the tab screens: those own a tab bar
 * and never need a back button, and these are pushed over it and always do.
 */
export function SettingsDetailScreen({
  title,
  subtitle,
  children,
  scroll = true,
}: SettingsDetailScreenProps) {
  const insets = useSafeAreaInsets();

  function goBack() {
    // A deep link or a refresh leaves no history to pop, which would strand
    // someone on a back button that does nothing.
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }

  const body = (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to settings"
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}>
          <ThemedText allowFontScaling={false} style={styles.backGlyph}>
            ‹
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Settings
          </ThemedText>
        </Pressable>
        <ThemedText type="title">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );

  return (
    <ThemedView style={styles.screen}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset },
          ]}
          showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.scrollContent,
            { paddingTop: insets.top + Spacing.three, paddingBottom: insets.bottom + BottomTabInset },
          ]}>
          {body}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  // width + maxWidth rather than flexGrow + maxWidth. React Native's default
  // flexShrink is 0, so a growing child with a maxWidth refuses to shrink below
  // it on a narrow screen and overflows — the same trap ScreenScaffold documents.
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    gap: Spacing.four,
  },
  header: { gap: Spacing.one, paddingHorizontal: Spacing.four },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    // Pulled left so the chevron's own side-bearing does not make the row look
    // indented relative to the title beneath it.
    marginLeft: -Spacing.one,
    marginBottom: Spacing.one,
  },
  // Off-scale: one glyph optically centred against the label beside it.
  backGlyph: { fontSize: 22, lineHeight: 24 },
  pressed: { opacity: 0.6 },
});
