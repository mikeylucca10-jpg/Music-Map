import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { SettingsDetailScreen } from '@/components/settings-detail-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useFollows } from '@/hooks/use-follows';
import { useTheme } from '@/hooks/use-theme';

/**
 * Everything the viewer follows, and the way to stop.
 *
 * Low traffic by nature — people come here to unfollow, not to browse — which
 * is exactly why it belongs behind a row rather than expanded on the Settings
 * screen. It was previously listed inline, so a long follow list pushed
 * everything below it off the screen.
 *
 * Artists and venues are shown in one list rather than split into two. The
 * question being answered is "what am I following", and someone scanning for a
 * name they want to remove does not care which bucket it is in.
 */
export default function FollowingSettingsScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { follows, isFollowing, isFollowPending, toggleFollow } = useFollows(
    session?.user.id ?? null,
  );

  return (
    <SettingsDetailScreen
      title="Following"
      subtitle={
        follows.length === 0
          ? 'Nothing yet.'
          : `${follows.length} ${follows.length === 1 ? 'artist or venue' : 'artists and venues'}.`
      }>
      <View style={styles.list}>
        <Pressable
          onPress={() => router.push('/follow-picker')}
          accessibilityRole="button"
          accessibilityLabel="Find artists and venues to follow"
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedView type="backgroundSelected" style={styles.findMore}>
            <ThemedText type="default">Find more to follow</ThemedText>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </ThemedView>
        </Pressable>

        {follows.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            Following an artist or a venue puts their shows first, and lets the app tell you when
            they announce something new. A room is often the better follow — a trusted venue is how
            you meet acts you have never heard of.
          </ThemedText>
        ) : (
          follows.map((follow) => (
            <ThemedView
              key={`${follow.kind}:${follow.key}`}
              type="backgroundElement"
              style={styles.row}>
              <View style={styles.rowLabel}>
                <ThemedText type="default" numberOfLines={1}>
                  {follow.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {follow.kind === 'artist' ? 'Artist' : 'Venue'}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => toggleFollow(follow.kind, follow.name)}
                disabled={isFollowPending(follow.kind, follow.name)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Unfollow ${follow.name}`}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="smallBold" style={{ color: theme.accentText }}>
                  {isFollowing(follow.kind, follow.name) ? 'Unfollow' : 'Follow'}
                </ThemedText>
              </Pressable>
            </ThemedView>
          ))
        )}
      </View>
    </SettingsDetailScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.two, paddingHorizontal: Spacing.four },
  findMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Radius.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.card,
  },
  rowLabel: { flex: 1, gap: Spacing.half },
  empty: { paddingTop: Spacing.two },
  pressed: { opacity: 0.7 },
});
