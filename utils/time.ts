import { useCalendars } from 'expo-localization';
import { useEffect, useState } from 'react';

import type { Translate } from '@/i18n';
import { nextFire } from './schedule.ts';
import type { Alarm } from './storage';

export function nextDateFor(hour: number, minute: number): Date {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

/** Next time this alarm fires (skips/moves included); the plain next HH:MM if everything is skipped. */
export function nextOccurrence(alarm: Pick<Alarm, 'time' | 'days' | 'exceptions'>): Date {
  const [hour, minute] = alarm.time.split(':').map(Number);
  return nextFire(alarm, new Date()) ?? nextDateFor(hour, minute);
}

/** "Rings in 7 h 32 min" — `at` is the next fire time. */
export function ringsIn(t: Translate, at: Date, now = Date.now()): string {
  const mins = Math.floor((at.getTime() - now) / 60_000); // round down, like the iOS Clock app
  if (mins < 1) return t('nextAlarm.soon');
  if (mins < 60) return t('nextAlarm.minutes', { m: mins });
  return t('nextAlarm.hoursMinutes', { h: Math.floor(mins / 60), m: mins % 60 });
}

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
