import { useCalendars } from 'expo-localization';
import { useEffect, useState } from 'react';

/** Follows the phone's 12/24-hour setting (like the system Clock app), not the app language. */
export function use24h(): boolean {
  return useCalendars()[0].uses24hourClock ?? false;
}

/** "HH:MM" (24h) → display parts; meridiem is '' in 24-hour mode. */
export function formatTime(time: string, h24: boolean): { display: string; meridiem: string } {
  const [h, m] = time.split(':').map(Number);
  const mm = String(m).padStart(2, '0');
  if (h24) return { display: `${String(h).padStart(2, '0')}:${mm}`, meridiem: '' };
  return { display: `${h % 12 || 12}:${mm}`, meridiem: h >= 12 ? 'PM' : 'AM' };
}

/** Re-renders every `ms` so relative times ("Rings in …") stay fresh. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
