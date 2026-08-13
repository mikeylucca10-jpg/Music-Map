import { supabase } from '@/lib/supabase';
import { SavedConcert } from '@/types/concert';

export async function fetchSavedConcerts(userId: string): Promise<SavedConcert[]> {
  const { data, error } = await supabase
    .from('saved_concerts')
    .select('concert_id, concert_name, venue_name, address, start_date_time, concert_url')
    .eq('user_id', userId)
    .order('start_date_time', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.concert_id,
    name: row.concert_name,
    venueName: row.venue_name,
    address: row.address ?? '',
    startDateTime: row.start_date_time,
    url: row.concert_url,
  }));
}

export async function saveConcert(userId: string, concert: SavedConcert): Promise<void> {
  const { error } = await supabase.from('saved_concerts').insert({
    user_id: userId,
    concert_id: concert.id,
    concert_name: concert.name,
    venue_name: concert.venueName,
    address: concert.address,
    start_date_time: concert.startDateTime,
    concert_url: concert.url,
  });
  if (error) throw new Error(error.message);
}

export async function unsaveConcert(userId: string, concertId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_concerts')
    .delete()
    .eq('user_id', userId)
    .eq('concert_id', concertId);
  if (error) throw new Error(error.message);
}
