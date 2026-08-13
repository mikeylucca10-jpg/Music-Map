import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/profile';

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, default_city')
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);

  return { id: data.id, displayName: data.display_name, defaultCity: data.default_city };
}

export async function updateProfile(
  userId: string,
  updates: { displayName?: string; defaultCity?: string },
): Promise<void> {
  const payload: { display_name?: string; default_city?: string } = {};
  if (updates.displayName !== undefined) payload.display_name = updates.displayName;
  if (updates.defaultCity !== undefined) payload.default_city = updates.defaultCity;

  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  if (error) throw new Error(error.message);
}
