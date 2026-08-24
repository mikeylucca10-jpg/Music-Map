import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';

type ScreenScaffoldProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /**
   * Pull-to-refresh handler. Omit on a screen with nothing to refetch.
   *
   * Pulling down on a feed is the most reflexive gesture on a phone, and a feed
   * that does not respond to it reads as stale or broken. This app already had
   * a refresh function on the concerts hook — nothing was ever wired to a
   * gesture, so the only way to get fresh listings was to close and reopen.
   */
  onRefresh?: () => Promise<unknown> | void;
};

// Shared outer shell for scrollable tab screens (list.tsx, settings.tsx):
// themed ScrollView + centered max-width container + title/subtitle header +
// the web version badge at the bottom.
export function ScreenScaffold({ title, subtitle, children, onRefresh }: ScreenScaffoldProps) {
  const theme = useTheme();
  const { insets, contentPlatformStyle } = useContentInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh?.();
    } finally {
      // Always cleared, including when the refetch throws. A spinner left
      // turning after a failed request is the worst of both outcomes: nothing
      // updated, and the app looks like it is still trying.
      setIsRefreshing(false);
    }
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            // The spinner is a mark on the app's own dark ground, so it takes
            // accentText rather than accent — see the two-token rule in
            // CLAUDE.md. tintColor is iOS, colors is Android.
            tintColor={theme.accentText}
            colors={[theme.accentText]}
            progressBackgroundColor={theme.backgroundElement}
          />
        ) : undefined
      }
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">{title}</ThemedText>
          {subtitle && (
            <ThemedText style={styles.centerText} themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          )}
        </ThemedView>

        {children}

      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: Spacing.six,
  },
  // width + maxWidth rather than flexGrow + maxWidth. React Native's default
  // flexShrink is 0, so a growing child with a maxWidth refuses to shrink below
  // it on a narrow viewport and overflows, clipped on both sides once the
  // parent centres it.
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  titleContainer: {
    gap: Spacing.one,
    paddingTop: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
});
