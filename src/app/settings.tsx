import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ConcertDetailSheet } from '@/components/concert-detail-sheet';
import { ConcertListCard } from '@/components/concert-list-card';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SkeletonCard } from '@/components/skeleton-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { useTheme } from '@/hooks/use-theme';
import { SavedConcert } from '@/types/concert';

const SAVED_CARD_WIDTH = 170;

export default function SettingsScreen() {
  const { session, isLoading, error, isSupabaseConfigured, signIn, signUp, signOut } = useAuth();
  const userId = session?.user.id ?? null;
  const { profile, error: profileError, updateProfile } = useProfile(userId);
  const {
    savedConcerts,
    isLoading: isSavedConcertsLoading,
    isSavePending,
    error: savedConcertsError,
    toggleSave,
  } = useSavedConcerts(userId);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [confirmationPendingEmail, setConfirmationPendingEmail] = useState<string | null>(null);
  const [selectedConcert, setSelectedConcert] = useState<SavedConcert | null>(null);
  const theme = useTheme();

  async function submit() {
    setIsSubmitting(true);
    setConfirmationPendingEmail(null);
    if (mode === 'signIn') {
      await signIn(email, password);
    } else {
      const result = await signUp(email, password);
      if (result === 'confirmation-required') setConfirmationPendingEmail(email);
    }
    setIsSubmitting(false);
  }

  function startEditingName() {
    setDisplayNameDraft(profile?.displayName ?? '');
    setIsEditingName(true);
  }

  async function saveDisplayName() {
    const success = await updateProfile({ displayName: displayNameDraft.trim() });
    if (success) setIsEditingName(false);
  }

  return (
    <ScreenScaffold title="Settings">
      {!isSupabaseConfigured && (
        <ThemedView type="backgroundElement" style={styles.messageCard}>
          <ThemedText type="smallBold">Supabase isn&apos;t configured yet</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Add <ThemedText type="code">EXPO_PUBLIC_SUPABASE_URL</ThemedText> and{' '}
            <ThemedText type="code">EXPO_PUBLIC_SUPABASE_ANON_KEY</ThemedText> to{' '}
            <ThemedText type="code">.env.local</ThemedText> from your Supabase project&apos;s
            Settings → API page.
          </ThemedText>
        </ThemedView>
      )}

      {isSupabaseConfigured && isLoading && (
        <ThemedView style={styles.centerState}>
          <ActivityIndicator color={theme.accent} />
        </ThemedView>
      )}

      {isSupabaseConfigured && !isLoading && session && (
        <ThemedView type="backgroundElement" style={styles.accountCard}>
          <ThemedText type="small" themeColor="textSecondary">
            Signed in as
          </ThemedText>
          <ThemedText type="default">{session.user.email}</ThemedText>

          {isEditingName ? (
            <View style={styles.nameEditRow}>
              <ThemedView type="backgroundSelected" style={styles.nameInputWrapper}>
                <TextInput
                  value={displayNameDraft}
                  onChangeText={setDisplayNameDraft}
                  placeholder="Display name"
                  placeholderTextColor={theme.textSecondary}
                  maxLength={50}
                  style={[styles.input, { color: theme.text }]}
                />
              </ThemedView>
              <Pressable onPress={saveDisplayName} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="linkPrimary">Save</ThemedText>
              </Pressable>
            </View>
          ) : profileError ? (
            <ThemedText type="small" themeColor="textSecondary">
              {profileError}
            </ThemedText>
          ) : null}
          {!isEditingName && (
            <Pressable onPress={startEditingName} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" themeColor="textSecondary">
                Display name: {profile?.displayName || 'Not set'} · Edit
              </ThemedText>
            </Pressable>
          )}

          <Pressable
            onPress={signOut}
            style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
            <ThemedText style={styles.signOutButtonLabel}>Sign Out</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {isSupabaseConfigured && !isLoading && session && (
        <ThemedView style={styles.savedSection}>
          <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.savedHeading}>
            Saved Concerts
          </ThemedText>
          {savedConcertsError && (
            <ThemedText type="small" themeColor="textSecondary">
              {savedConcertsError}
            </ThemedText>
          )}
          {isSavedConcertsLoading ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
              <SkeletonCard width={SAVED_CARD_WIDTH} />
              <SkeletonCard width={SAVED_CARD_WIDTH} />
            </ScrollView>
          ) : savedConcerts.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              No saved concerts yet. Tap the heart on a show in Explore or List to save it.
            </ThemedText>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
              {savedConcerts.map((concert) => (
                <ConcertListCard
                  key={concert.id}
                  concert={concert}
                  width={SAVED_CARD_WIDTH}
                  onPress={() => setSelectedConcert(concert)}
                  isSaved
                  isSavePending={isSavePending(concert.id)}
                  onToggleSave={() => toggleSave(concert)}
                />
              ))}
            </ScrollView>
          )}
        </ThemedView>
      )}

      {isSupabaseConfigured && !isLoading && !session && (
        <ThemedView style={styles.form}>
          <View style={styles.modeToggle}>
            <Pressable
              onPress={() => {
                setMode('signIn');
                setConfirmationPendingEmail(null);
              }}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView
                style={[
                  styles.modeButton,
                  { backgroundColor: mode === 'signIn' ? theme.accent : theme.backgroundElement },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: mode === 'signIn' ? theme.accentInk : theme.text }}>
                  Sign In
                </ThemedText>
              </ThemedView>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode('signUp');
                setConfirmationPendingEmail(null);
              }}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView
                style={[
                  styles.modeButton,
                  { backgroundColor: mode === 'signUp' ? theme.accent : theme.backgroundElement },
                ]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: mode === 'signUp' ? theme.accentInk : theme.text }}>
                  Sign Up
                </ThemedText>
              </ThemedView>
            </Pressable>
          </View>

          {confirmationPendingEmail && (
            <ThemedView type="backgroundSelected" style={styles.messageCard}>
              <ThemedText type="smallBold">Check your email</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                We sent a confirmation link to {confirmationPendingEmail}. Click it, then come
                back here and sign in.
              </ThemedText>
            </ThemedView>
          )}

          <ThemedView type="backgroundElement" style={styles.inputWrapper}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, { color: theme.text }]}
            />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.inputWrapper}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              style={[styles.input, { color: theme.text }]}
            />
          </ThemedView>

          {error && (
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          )}

          <Pressable
            onPress={submit}
            disabled={!email.trim() || !password.trim() || isSubmitting}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.pressed,
              (!email.trim() || !password.trim() || isSubmitting) && styles.disabled,
            ]}>
            <ThemedText style={styles.submitButtonLabel}>
              {isSubmitting ? 'Please wait…' : mode === 'signIn' ? 'Sign In' : 'Sign Up'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      )}

      <ConcertDetailSheet
        concert={selectedConcert}
        onClose={() => setSelectedConcert(null)}
        isSaved
        isSavePending={selectedConcert ? isSavePending(selectedConcert.id) : undefined}
        onToggleSave={selectedConcert ? () => toggleSave(selectedConcert) : undefined}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  centerState: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
  messageCard: {
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    borderRadius: Radius.card,
    padding: Spacing.four,
  },
  accountCard: {
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    borderRadius: Radius.card,
    padding: Spacing.four,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  nameInputWrapper: {
    flex: 1,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  savedSection: {
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  savedHeading: {
    marginBottom: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  savedRow: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    paddingHorizontal: Spacing.four,
  },
  signOutButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
    backgroundColor: '#e5484d',
  },
  signOutButtonLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  form: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  modeButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  inputWrapper: {
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: Spacing.two,
  },
  submitButton: {
    height: 48,
    marginTop: Spacing.two,
    borderRadius: Radius.pill,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonLabel: {
    color: '#0A0A0A',
    fontSize: 16,
    fontWeight: '700',
  },
});
