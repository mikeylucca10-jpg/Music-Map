import { router, Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { SettingsRow } from '@/components/settings-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useFollows } from '@/hooks/use-follows';
import { useSavedConcerts } from '@/hooks/use-saved-concerts';
import { useTheme } from '@/hooks/use-theme';
import { CITIES } from '@/types/concert';

export default function SettingsScreen() {
  const { session, isLoading, error, isSupabaseConfigured, signIn, signUp, signOut, resetPassword } =
    useAuth();
  const userId = session?.user.id ?? null;
  const { profile, error: profileError, updateProfile } = useProfile(userId);
  // Counts only — the lists themselves live on settings/saved.tsx now.
  const { savedConcerts, pastConcerts } = useSavedConcerts(userId);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [confirmationPendingEmail, setConfirmationPendingEmail] = useState<string | null>(null);
  const [resetEmailSent, setResetEmailSent] = useState<string | null>(null);

  const { follows } = useFollows(userId);
  const theme = useTheme();

  async function submit() {
    setIsSubmitting(true);
    setConfirmationPendingEmail(null);
    setResetEmailSent(null);
    if (mode === 'signIn') {
      await signIn(email, password);
    } else {
      const result = await signUp(email, password);
      if (result === 'confirmation-required') setConfirmationPendingEmail(email);
    }
    setIsSubmitting(false);
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      return;
    }
    setIsSubmitting(true);
    setConfirmationPendingEmail(null);
    const success = await resetPassword(email.trim());
    setIsSubmitting(false);
    if (success) setResetEmailSent(email.trim());
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
          <ActivityIndicator color={theme.accentText} />
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

      {/* A table of contents rather than every section expanded at once.
          Settings used to render the city picker, the follow list, the alert
          toggles and the saved concerts inline, so it was a long scroll with no
          overview and a long follow list pushed everything below it off the
          screen. Each row now opens its own screen, and carries its current
          answer so the common question is settled without tapping. */}
      {isSupabaseConfigured && !isLoading && session && (
        <ThemedView style={styles.savedSection}>
          <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.savedHeading}>
            Your Music
          </ThemedText>
          <View style={styles.menuGroup}>
            <SettingsRow
              label="Following"
              value={follows.length > 0 ? String(follows.length) : undefined}
              onPress={() => router.push('/settings/following')}
              showDivider={false}
            />
            <SettingsRow
              label="Alerts"
              value={follows.length === 0 ? 'Follow something first' : undefined}
              onPress={() => router.push('/settings/alerts')}
            />
            <SettingsRow
              label="Saved Concerts"
              value={savedConcerts.length > 0 ? String(savedConcerts.length) : undefined}
              onPress={() => router.push('/settings/saved')}
            />
            {/* Only offered once there is something in it. A row that always
                opens an empty screen teaches people not to tap rows. */}
            {pastConcerts.length > 0 && (
              <SettingsRow
                label="Past Events"
                value={String(pastConcerts.length)}
                onPress={() => router.push({ pathname: '/settings/saved', params: { scope: 'past' } })}
              />
            )}
            <SettingsRow
              label="Default City"
              value={CITIES.find((city) => city.id === (profile?.defaultCity ?? CITIES[0].id))?.label}
              onPress={() => router.push('/settings/city')}
            />
          </View>
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

          {resetEmailSent && (
            <ThemedView type="backgroundSelected" style={styles.messageCard}>
              <ThemedText type="smallBold">Check your email</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                We sent a password reset link to {resetEmailSent}. Click it to choose a new
                password.
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

          {mode === 'signIn' && (
            <Pressable
              onPress={handleForgotPassword}
              disabled={!email.trim() || isSubmitting}
              style={({ pressed }) => [
                styles.forgotPasswordLink,
                pressed && styles.pressed,
                !email.trim() && styles.disabled,
              ]}>
              <ThemedText type="small" themeColor="textSecondary">
                Forgot password?
              </ThemedText>
            </Pressable>
          )}

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

      {/* Outside every auth conditional — the legal documents have to be
          reachable whether or not someone has an account. */}
      <ThemedView style={styles.savedSection}>
        <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.savedHeading}>
          About
        </ThemedText>
        <View style={styles.legalLinks}>
          <Link href="/privacy-policy" asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.legalRow}>
                <ThemedText type="default">Privacy Policy</ThemedText>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
          <Link href="/terms" asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.legalRow}>
                <ThemedText type="default">Terms of Service</ThemedText>
                <ThemedText themeColor="textSecondary">›</ThemedText>
              </ThemedView>
            </Pressable>
          </Link>
        </View>
      </ThemedView>

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
  // One rounded block containing the rows, so they read as a single grouped
  // list rather than separate cards -- the divider inside SettingsRow does the
  // separating.
  menuGroup: {
    marginHorizontal: Spacing.four,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Colors.dark.backgroundElement,
  },
  savedSection: {
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  followList: { gap: Spacing.two, paddingHorizontal: Spacing.four },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  followLabel: { flex: 1, gap: Spacing.half },
  savedHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.one,
  },
  savedHeading: {
    marginBottom: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  savedRow: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  cityRow: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  cityChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  centerText: {
    paddingHorizontal: Spacing.four,
  },
  legalLinks: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
  signOutButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
    backgroundColor: Colors.dark.surfaceOverlay,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  signOutButtonLabel: {
    color: Colors.dark.text,
    fontSize: Fonts.size.sm,
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
  forgotPasswordLink: {
    alignSelf: 'flex-end',
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
    backgroundColor: Colors.dark.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonLabel: {
    color: Colors.dark.accentInk,
    fontSize: Fonts.size.base,
    fontWeight: '700',
  },
});

