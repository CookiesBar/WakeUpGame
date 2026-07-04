/**
 * AsyncStorage persistence for alarms.
 * Minimal-core rebuild: bundled sounds only (no custom-sound import).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALARMS_KEY = '@wakeup_alarms';

/** 0 = Sunday ... 6 = Saturday. Empty array = one-time (no repeat). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Alarm {
  id: string;
  /** 24h "HH:MM" */
  time: string;
  label: string;
  enabled: boolean;
  days: Weekday[];
  /** Bundled sound id (see constants/sounds). null = default. */
  soundId: string | null;
  createdAt: number;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function getAlarms(): Promise<Alarm[]> {
  try {
    const raw = await AsyncStorage.getItem(ALARMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Alarm[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('getAlarms failed:', err);
    return [];
  }
}

async function writeAlarms(alarms: Alarm[]): Promise<void> {
  await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
}

export async function saveAlarm(alarm: Alarm): Promise<void> {
  const alarms = await getAlarms();
  const idx = alarms.findIndex((a) => a.id === alarm.id);
  if (idx >= 0) {
    alarms[idx] = alarm;
  } else {
    alarms.push(alarm);
  }
  await writeAlarms(alarms);
}

export async function deleteAlarm(id: string): Promise<void> {
  const alarms = await getAlarms();
  await writeAlarms(alarms.filter((a) => a.id !== id));
}

export async function getAlarm(id: string): Promise<Alarm | undefined> {
  const alarms = await getAlarms();
  return alarms.find((a) => a.id === id);
}

export async function toggleAlarm(id: string): Promise<Alarm | undefined> {
  const alarms = await getAlarms();
  const alarm = alarms.find((a) => a.id === id);
  if (!alarm) return undefined;
  alarm.enabled = !alarm.enabled;
  await writeAlarms(alarms);
  return alarm;
}
