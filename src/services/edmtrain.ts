import { City, Concert } from '@/types/concert';

// EDMTrain requires requesting API access (edmtrain.com/page/api) before a key
// is issued. Until EXPO_PUBLIC_EDMTRAIN_API_KEY is set, this source is skipped
// and useEdmConcerts merges in only Ticketmaster results.
export async function fetchEdmtrainConcerts(_city: City): Promise<Concert[]> {
  const apiKey = process.env.EXPO_PUBLIC_EDMTRAIN_API_KEY;
  if (!apiKey) return [];

  // TODO: once approved, call https://edmtrain.com/api/events and normalize
  // the response into Concert[] the same way ticketmaster.ts does.
  return [];
}
