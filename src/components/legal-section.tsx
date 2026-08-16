import { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type LegalSectionProps = {
  heading: string;
  children: ReactNode;
};

// Shared section shell for the privacy policy and terms screens, so the two
// documents stay typographically identical.
export function LegalSection({ heading, children }: LegalSectionProps) {
  return (
    <View style={styles.section}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        {heading}
      </ThemedText>
      {children}
    </View>
  );
}

// Body copy. Slightly looser line height than the app's default `small` —
// these are the only screens with more than a couple of sentences at a time.
export function LegalText({ children }: { children: ReactNode }) {
  return (
    <ThemedText type="small" style={styles.body}>
      {children}
    </ThemedText>
  );
}

// Inline emphasis inside a LegalText/LegalBullet. A nested <Text> inherits
// the parent's colour and size in React Native, so this only adds weight.
export function LegalBold({ children }: { children: ReactNode }) {
  return <Text style={styles.bold}>{children}</Text>;
}

export function LegalBullet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.bulletMark}>
        •
      </ThemedText>
      <ThemedText type="small" style={[styles.body, styles.bulletText]}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  body: {
    lineHeight: 21,
  },
  bold: {
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bulletMark: {
    lineHeight: 21,
  },
  bulletText: {
    flex: 1,
  },
});
