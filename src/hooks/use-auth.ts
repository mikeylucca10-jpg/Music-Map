import { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

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
   * Apple first, and for now Apple only. App Store guideline 4.8 makes these
   * asymmetric: offering Google (or any third-party login) *requires* offering
   * Sign in with Apple alongside it, while offering Apple alone is fine. So
   * Apple is the one that can ship on its own, and adding Google later is
   * additive rather than a prerequisite.
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

  const signOut = useCallback(async () => {
    setError(null);
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
    signOut,
    resetPassword,
  };
}
