import { type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useContentInsets } from '@/hooks/use-content-insets';
import { useTheme } from '@/hooks/use-theme';

type ScreenScaffoldProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

// Shared outer shell for scrollable tab screens (list.tsx, settings.tsx):
// themed ScrollView + centered max-width container + title/subtitle header +
// the web version badge at the bottom.
export function ScreenScaffold({ title, subtitle, children }: ScreenScaffoldProps) {
  const theme = useTheme();
  const { insets, contentPlatformStyle } = useContentInsets();

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
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

        {Platform.OS === 'web' && <WebBadge />}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  // Tightened from 24/16 to 16/8. On a 393pt screen the old header plus the
  // filter pills and the night strip pushed the first card almost entirely
  // below the fold, so the landing screen led with chrome rather than shows.
  titleContainer: {
    gap: Spacing.one,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  centerText: {},
});
