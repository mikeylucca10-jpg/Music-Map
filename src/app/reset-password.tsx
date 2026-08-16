import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ScreenStatus = 'checking' | 'ready' | 'invalid' | 'success';

// Not implemented for native yet — the email link there needs the app's own
// URL scheme to deep-link back in (see getResetPasswordRedirectUrl in
// use-auth.ts), which also needs the resulting scheme added to Supabase's
// redirect allow list and can't be verified without a real device/build.
// This screen currently only completes the flow on web.
function readRecoveryTokensFromUrl(): { accessToken: string; refreshToken: string } | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState<ScreenStatus>(() => {
    // Synchronous on web (just reads the URL) — not an effect, so no
    // set-state-in-effect concern. Native always lands on 'invalid' for now.
    return readRecoveryTokensFromUrl() ? 'checking' : 'invalid';
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'checking') return;
    let cancelled = false;
    const tokens = readRecoveryTokensFromUrl();
    if (!tokens) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: establishing the recovery session is inherently async
      setStatus('invalid');
      return;
    }
    supabase.auth
      .setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken })
      .then(({ error: sessionError }) => {
        if (!cancelled) setStatus(sessionError ? 'invalid' : 'ready');
      });
    return () => {
      cancelled = true;
    };
    // Only ever needs to run once — status flips away from 'checking' as
    // soon as this resolves, and readRecoveryTokensFromUrl reads a URL that
    // doesn't change during this screen's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit() {
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);
    if (updateError) {
      setError(updateError.message);
    } else {
      setStatus('success');
    }
  }

  return (
    <ScreenScaffold title="Reset Password">
      {status === 'checking' && (
        <ThemedView style={styles.centerState}>
          <ActivityIndicator color={theme.accentText} />
        </ThemedView>
      )}

      {status === 'invalid' && (
        <ThemedView type="backgroundElement" style={styles.messageCard}>
          <ThemedText type="smallBold">This link isn&apos;t valid</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {Platform.OS === 'web'
              ? 'This reset link has expired or was already used. Go back to Settings and request a new one.'
              : "Password reset links currently only work when opened on the web version of Music Map. Open the link you were emailed in a browser, or reset your password from the web app's Settings page."}
          </ThemedText>
        </ThemedView>
      )}

      {status === 'success' && (
        <ThemedView type="backgroundElement" style={styles.messageCard}>
          <ThemedText type="smallBold">Password updated</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            You&apos;re signed in with your new password — head back to Settings.
          </ThemedText>
        </ThemedView>
      )}

      {status === 'ready' && (
        <View style={styles.form}>
          <ThemedText type="small" themeColor="textSecondary">
            Choose a new password for your account.
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.inputWrapper}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="New password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry
              style={[styles.input, { color: theme.text }]}
            />
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.inputWrapper}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
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
            onPress={handleSubmit}
            disabled={!password.trim() || !confirmPassword.trim() || isSubmitting}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.pressed,
              (!password.trim() || !confirmPassword.trim() || isSubmitting) && styles.disabled,
            ]}>
            <ThemedText style={styles.submitButtonLabel}>
              {isSubmitting ? 'Please wait…' : 'Update Password'}
            </ThemedText>
          </Pressable>
        </View>
      )}
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
  form: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
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
