import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationPermissionPrompt } from '@/components/notification-permission-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useApplyDefaultCity } from '@/hooks/use-apply-default-city';
import { useAuth } from '@/hooks/use-auth';
import { useEdmConcerts } from '@/hooks/use-edm-concerts';
import { useFollows } from '@/hooks/use-follows';
import { useProfile } from '@/hooks/use-profile';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useTheme } from '@/hooks/use-theme';
import { addFollows, followKey, FollowKind } from '@/services/follows';
import { CITIES } from '@/types/concert';

type Candidate = { kind: FollowKind; name: string; dates: number; artistId?: string };

/**
 * Pick several things to follow at once, from what is actually playing.
 *
 * Following one act at a time from inside a show is how you end up with two
 * follows and a Following filter that stays empty. Every serious competitor
 * solves this by importing a streaming library, which is closed to an app this
 * size: Spotify Development Mode caps at five users, and extended access needs
 * 250k monthly actives — a bar you would need this very feature to clear.
 *
 * Offering what is on instead is arguably the better answer regardless. A
 * streaming import hands you artists you already know, most of whom never play
 * here; this only offers acts and rooms you could actually go and see, which is
 * what the app is for. It doubles as the first-run step, so the Following
 * filter has something in it on day one rather than after weeks of tapping.
 */
export default function FollowPickerScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [city, setCity] = useState(CITIES[0]);
  const { session } = useAuth();
  const { profile } = useProfile(session?.user.id ?? null);
  useApplyDefaultCity(profile, setCity);

  const { concerts, isLoading } = useEdmConcerts(city);
  const { follows, refresh } = useFollows(session?.user.id ?? null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // Non-null while the alerts sheet is up; also carries the name shown in its
  // preview, so one piece of state answers both "is it open" and "what does it
  // say" rather than letting those two drift apart.
  const [pushSampleName, setPushSampleName] = useState<string | null>(null);
  const { shouldAsk, request, decline } = usePushNotifications(session?.user.id ?? null);

  const alreadyFollowed = useMemo(
    () => new Set(follows.map((follow) => `${follow.kind}:${follow.key}`)),
    [follows],
  );

  // Ranked by how many dates each has coming up. A room with seventeen nights on
  // is a more useful thing to follow than one with a single date, and it is the
  // only signal here that reflects how active something is — the feed carries no
  // popularity field. Anything already followed is dropped rather than shown as
  // disabled: this is a list of things you could add, not an inventory.
  const { venues, artists } = useMemo(() => {
    const venueCounts = new Map<string, number>();
    const artistCounts = new Map<string, number>();
    // Kept alongside the count so the follow written from here carries the
    // source's stable id, not just the name. This screen is where most follows
    // are created, so an id dropped here meant the exact-id match was covering
    // almost nothing.
    const artistIds = new Map<string, string>();
    for (const concert of concerts) {
      venueCounts.set(concert.venueName, (venueCounts.get(concert.venueName) ?? 0) + 1);
      if (concert.artist) {
        artistCounts.set(concert.artist, (artistCounts.get(concert.artist) ?? 0) + 1);
        // First id wins. Two acts sharing a name is exactly what the id is for,
        // and picking one deterministically beats letting the last listing in
        // the feed decide.
        if (concert.artistId && !artistIds.has(concert.artist)) {
          artistIds.set(concert.artist, concert.artistId);
        }
      }
    }
    const build = (counts: Map<string, number>, kind: FollowKind): Candidate[] =>
      [...counts.entries()]
        .map(([name, dates]) => ({ kind, name, dates, artistId: artistIds.get(name) }))
        .filter((candidate) => !alreadyFollowed.has(`${candidate.kind}:${followKey(candidate.name)}`))
        .sort((a, b) => b.dates - a.dates || a.name.localeCompare(b.name));
    return { venues: build(venueCounts, 'venue'), artists: build(artistCounts, 'artist') };
  }, [concerts, alreadyFollowed]);

  function toggle(candidate: Candidate) {
    const id = `${candidate.kind}:${followKey(candidate.name)}`;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function commit() {
    if (!session || selected.size === 0 || saving) return;
    setSaving(true);
    try {
      const items = [...venues, ...artists]
        .filter((candidate) => selected.has(`${candidate.kind}:${followKey(candidate.name)}`))
        .map((candidate) => ({
          kind: candidate.kind,
          name: candidate.name,
          artistId: candidate.artistId,
        }));
      await addFollows(session.user.id, items);
      await refresh();
      // The ask lands here rather than at launch, and that placement is the
      // whole reason it works. Someone who has just followed six acts has
      // demonstrated exactly the intent a new-show alert serves, so the request
      // reads as the obvious next step rather than an interruption from an app
      // they have not yet understood. Asking on first launch is the single
      // biggest cause of low opt-in.
      if (shouldAsk) {
        setPushSampleName(items[0]?.name ?? null);
        return;
      }
      goBack();
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="smallBold">Sign in to follow</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Following needs an account, so the app can tell you when something new is on.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      {/* Either answer leaves the screen. The follows are already saved by the
          time this appears, so declining costs nothing that was just done —
          which is exactly what makes "Not Now" a real option rather than a
          threat to the work in progress. */}
      <NotificationPermissionPrompt
        visible={pushSampleName !== null}
        sampleName={pushSampleName ?? undefined}
        onAllow={async () => {
          await request();
          setPushSampleName(null);
          goBack();
        }}
        onDeny={async () => {
          await decline();
          setPushSampleName(null);
          goBack();
        }}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.three }]}>
        <ThemedText type="subtitle">Follow a few</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Rooms and acts with something coming up. Their shows come first.
        </ThemedText>
      </View>

      {isLoading && concerts.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.accentText} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
          showsVerticalScrollIndicator={false}>
          {/* Rooms lead, deliberately. A trusted room is how people meet acts
              they have never heard of, and someone new to the app is far more
              likely to recognise a venue than a DJ on any given week. */}
          <Section
            title="Rooms"
            candidates={venues}
            selected={selected}
            onToggle={toggle}
            emptyLabel="You already follow every room with something on."
          />
          <Section
            title="Artists"
            candidates={artists}
            selected={selected}
            onToggle={toggle}
            emptyLabel="You already follow every act with something on."
          />
        </ScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Pressable
          onPress={commit}
          disabled={selected.size === 0 || saving}
          accessibilityRole="button"
          accessibilityLabel={
            selected.size === 0
              ? 'Select something to follow first'
              : `Follow ${selected.size} selected`
          }
          style={({ pressed }) => [
            styles.commit,
            { backgroundColor: selected.size === 0 ? theme.surfaceOverlay : theme.accent },
            (pressed || saving) && styles.pressed,
          ]}>
          <ThemedText
            type="smallBold"
            style={{ color: selected.size === 0 ? theme.textSecondary : theme.accentInk }}>
            {saving ? 'Following…' : selected.size === 0 ? 'Select a few' : `Follow ${selected.size}`}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Skip for now"
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="textSecondary">
            Not now
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

function Section({
  title,
  candidates,
  selected,
  onToggle,
  emptyLabel,
}: {
  title: string;
  candidates: Candidate[];
  selected: Set<string>;
  onToggle: (candidate: Candidate) => void;
  emptyLabel: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText type="eyebrow" themeColor="textSecondary">
        {title}
      </ThemedText>
      {candidates.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {emptyLabel}
        </ThemedText>
      ) : (
        <View style={styles.grid}>
          {candidates.map((candidate) => {
            const id = `${candidate.kind}:${followKey(candidate.name)}`;
            const on = selected.has(id);
            return (
              <Pressable
                key={id}
                onPress={() => onToggle(candidate)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${candidate.name}, ${candidate.dates} ${
                  candidate.dates === 1 ? 'date' : 'dates'
                } coming up`}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement,
                    borderColor: on ? theme.accentText : theme.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  allowFontScaling={false}
                  style={[styles.tick, { color: on ? theme.accentText : theme.textSecondary }]}>
                  {on ? '✓' : '+'}
                </ThemedText>
                <View style={styles.optionLabel}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {candidate.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {candidate.dates} {candidate.dates === 1 ? 'date' : 'dates'}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: Spacing.one, paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  content: { gap: Spacing.five, paddingHorizontal: Spacing.four },
  section: { gap: Spacing.two },
  grid: { gap: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.card,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  optionLabel: { flex: 1, gap: Spacing.half },
  // Off-scale: a single glyph optically centred against the label beside it.
  tick: { fontSize: 17, lineHeight: 19, width: 18, textAlign: 'center' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  center: { textAlign: 'center' },
  // Pinned rather than scrolling with the list: the count changes as you tap, so
  // it has to stay on screen for the selection to feel like it is adding up.
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.two,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    backgroundColor: Colors.dark.background,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  commit: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
  skip: { paddingVertical: Spacing.one },
  pressed: { opacity: 0.75 },
});
