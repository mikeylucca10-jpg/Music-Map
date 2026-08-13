import { supabase } from '@/lib/supabase';
import { SavedConcert } from '@/types/concert';

export async function fetchSavedConcerts(userId: string): Promise<SavedConcert[]> {
  const { data, error } = await supabase
    .from('saved_concerts')
    .select(
      'concert_id, concert_name, artist, venue_name, address, start_date_time, concert_url, image_url, price_min, price_max, price_currency',
    )
    .eq('user_id', userId)
    .order('start_date_time', { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.concert_id,
    name: row.concert_name,
    artist: row.artist ?? undefined,
    venueName: row.venue_name,
    address: row.address ?? '',
    startDateTime: row.start_date_time,
    url: row.concert_url,
    imageUrl: row.image_url ?? undefined,
    priceMin: row.price_min ?? undefined,
    priceMax: row.price_max ?? undefined,
    priceCurrency: row.price_currency ?? undefined,
  }));
}

export async function saveConcert(userId: string, concert: SavedConcert): Promise<void> {
  const { error } = await supabase.from('saved_concerts').insert({
    user_id: userId,
    concert_id: concert.id,
    concert_name: concert.name,
    artist: concert.artist ?? null,
    venue_name: concert.venueName,
    address: concert.address,
    start_date_time: concert.startDateTime,
    concert_url: concert.url,
    image_url: concert.imageUrl ?? null,
    price_min: concert.priceMin ?? null,
    price_max: concert.priceMax ?? null,
    price_currency: concert.priceCurrency ?? null,
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
