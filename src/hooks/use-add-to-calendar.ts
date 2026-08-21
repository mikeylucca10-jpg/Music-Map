import * as Calendar from 'expo-calendar';
import { Linking, Platform } from 'react-native';
import { useCallback, useState } from 'react';

import { buildCalendarEvent, buildGoogleCalendarUrl } from '@/lib/calendar-event';
import { ConcertSummary } from '@/types/concert';

export type AddToCalendarState = 'idle' | 'working' | 'added' | 'denied' | 'failed';

/**
 * Puts a show in the calendar the person already keeps.
 *
 * This is the one feature here that deliberately sends someone *out* of the
 * app. A saved concert is a bookmark nobody is reminded of; a calendar entry is
 * a commitment their phone will raise on the day, next to the rest of their
 * plans, with whatever alert they already trust. Songkick's own users report
 * its calendar sync silently failing, so doing this properly is a low bar that
 * nobody in this category has cleared.
 *
 * Two paths, because expo-calendar is a native module whose web build exists
 * only to throw:
 *
 *  - **Native** presents the system calendar sheet, pre-filled. It is not
 *    written silently, which matters: the person picks which calendar, sees the
 *    assumed end time before agreeing to it, and sets their own alert. Writing
 *    directly would be one fewer tap and a much worse trade.
 *  - **Web** hands off to Google Calendar's template URL, which pre-fills the
 *    same fields in any browser. Without it the button would have to be hidden
 *    on the one platform this app is developed and demoed on.
 */
export function useAddToCalendar() {
  const [state, setState] = useState<AddToCalendarState>('idle');

  const addToCalendar = useCallback(async (concert: ConcertSummary) => {
    const event = buildCalendarEvent(concert);

    if (Platform.OS === 'web') {
      // New tab rather than navigating away: the app is a tab someone came back
      // to, and replacing it with Google Calendar loses their place in the list.
      Linking.openURL(buildGoogleCalendarUrl(event));
      setState('added');
      return true;
    }

    setState('working');
    try {
      const permission = await Calendar.requestCalendarPermissionsAsync();
      if (!permission.granted) {
        // Not an error — a deliberate no. The UI says so plainly rather than
        // showing a failure the person did not cause.
        setState('denied');
        return false;
      }

      // iOS exposes a single default calendar; Android deliberately does not,
      // because an Android device can carry several accounts with no
      // system-managed primary. There, the first calendar that allows writes is
      // enough — addEventWithForm presents the system sheet, and the person
      // picks the calendar they actually want inside it, so this only has to be
      // a valid handle rather than the right destination.
      const calendar =
        Platform.OS === 'ios'
          ? Calendar.getDefaultCalendarSync()
          : (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).find(
              (candidate) => candidate.allowsModifications,
            );

      if (!calendar) {
        // A device with no writable calendar at all — rare, but a real state on
        // a stripped Android build with no account signed in.
        setState('failed');
        return false;
      }

      const result = await calendar.addEventWithForm({
        title: event.title,
        startDate: event.startDate,
        endDate: event.endDate,
        location: event.location,
        notes: event.notes,
        url: event.url,
      });

      // The sheet can be dismissed without saving, which is a normal outcome
      // and must not be reported as success — a false "Added" would have people
      // trusting a calendar entry that does not exist.
      const saved = result?.action === 'saved';
      setState(saved ? 'added' : 'idle');
      return saved;
    } catch (error) {
      console.warn('Add to calendar failed', error);
      setState('failed');
      return false;
    }
  }, []);

  return { state, addToCalendar };
}
