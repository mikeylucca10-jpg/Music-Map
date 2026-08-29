import { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { releaseCurrentPushToken } from '@/services/push-tokens';

// Where the reset-password email link sends the user back to. Web computes
// this from the current origin (works for both localhost in dev and
// whatever domain this ends up deployed to, no hardcoding). Native uses the
// app's own URL scheme (see app.json) via expo-linking — this part is
// untested: it also needs the resulting scheme added to the Supabase
// dashboard's Authentication -> URL Configuration redirect allow list,
// which isn't something that can be verified from here.
function getResetPasswordRedirectUrl(): string | undefined {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
  }
  return Linking.createURL('reset-password');
}

// Where Apple's hosted OAuth flow returns to, for the platforms with no native
// provider. Web computes it from the current origin like the reset link does;
// native falls back to the app scheme, which — like the reset flow — needs the
// scheme on Supabase's redirect allow list before it can work.
function getAppleRedirectUrl(): string | undefined {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' ? window.location.origin : undefined;
  }
  return Linking.createURL('');
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      return 'error' as const;
    }
    // With email confirmation enabled (the Supabase default), the account is
    // created but no session comes back until the user clicks the email link.
    return data.session ? ('signed-in' as const) : ('confirmation-required' as const);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    return !signInError;
  }, []);

  /**
   * Sign in with Apple.
   *
   * Offered because it is what iOS users expect and the highest-converting
   * option there, not because it is required. Guideline 4.8 only bites on apps
   * that use third-party login *exclusively*; this app also has email, so the
   * rule does not apply and any provider meeting its three criteria (name and
   * email only, address masking, no ad tracking) would satisfy it anyway.
   *
   * Two different flows behind one function. On iOS the OS supplies a signed
   * identity token directly, which is exchanged with Supabase — no browser, no
   * redirect, and the Face ID sheet is the whole interaction. Everywhere else
   * there is no native provider, so it falls back to the hosted OAuth redirect.
   */
  const signInWithApple = useCallback(async () => {
    setError(null);

    if (Platform.OS !== 'ios') {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: getAppleRedirectUrl() },
      });
      if (oauthError) setError(oauthError.message);
      return !oauthError;
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Documented as nullable, and a null token cannot be exchanged — treated
      // as a failed sign-in rather than passed on to fail less clearly inside
      // Supabase.
      if (!credential.identityToken) {
        setError('Apple did not return a sign-in token. Please try again.');
        return false;
      }

      const { error: tokenError } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (tokenError) {
        setError(tokenError.message);
        return false;
      }
      return true;
    } catch (appleError) {
      // Cancelling is not an error to report. Apple raises ERR_REQUEST_CANCELED
      // when the sheet is dismissed, and surfacing that would put a red message
      // on screen for someone who simply changed their mind.
      if ((appleError as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return false;
      setError('Could not sign in with Apple. Please try again.');
      return false;
    }
  }, []);

  /**
   * Email a six-digit sign-in code.
   *
   * A code rather than a magic link, deliberately. A link has to redirect back
   * into the app, and this client runs with `detectSessionInUrl: false` (the
   * AsyncStorage adapter cannot parse a URL on native), so every link needs
   * manual fragment parsing plus the redirect target on Supabase's allow list —
   * and on native it needs a deep link that cannot be verified without a device.
   * A code is typed into the app: identical on web and native, no redirect, no
   * allow list, nothing to configure per platform.
   *
   * It also removes the password from this path entirely — nothing to invent,
   * forget, or reuse from somewhere it has already leaked.
   *
   * `shouldCreateUser` is left at its default (true): the same code both signs
   * in an existing account and creates a new one, so there is no sign-up step
   * to choose first and no "no account found" dead end.
   */
  const sendEmailCode = useCallback(async (email: string) => {
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({ email });
    if (otpError) {
      setError(otpError.message);
      return false;
    }
    return true;
  }, []);

  /**
   * Exchange the emailed code for a session.
   *
   * Type is 'email' rather than 'magiclink'. Both arrive from signInWithOtp,
   * but 'magiclink' only verifies codes for accounts that already exist, so a
   * first-time user's code is rejected as invalid — which reads as a broken
   * code rather than the wrong verification type.
   */
  const verifyEmailCode = useCallback(async (email: string, token: string) => {
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: 'email',
    });
    if (verifyError) {
      setError(verifyError.message);
      return false;
    }
    return true;
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    // Before signOut, not after: the delete is scoped by RLS to the signed-in
    // user, so once the session is gone it silently matches nothing.
    //
    // Without it the row stays mapped to the departing account, and
    // alerts_due() joins push_tokens on user_id — so the next person to sign in
    // on this device keeps receiving the previous account's alerts, which name
    // the artists and venues that account follows. Their own registration
    // cannot repair it either: the upsert conflicts on the token, and the RLS
    // check refuses an update to a row owned by someone else.
    await releaseCurrentPushToken();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getResetPasswordRedirectUrl(),
    });
    if (resetError) {
      setError(resetError.message);
      return false;
    }
    return true;
  }, []);

  return {
    session,
    isLoading,
    error,
    isSupabaseConfigured,
    signUp,
    signIn,
    signInWithApple,
    sendEmailCode,
    verifyEmailCode,
    signOut,
    resetPassword,
  };
}
