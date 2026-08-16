import { Session } from '@supabase/supabase-js';
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

  return { session, isLoading, error, isSupabaseConfigured, signUp, signIn, signOut, resetPassword };
}
