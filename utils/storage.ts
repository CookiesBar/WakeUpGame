/**
 * AsyncStorage persistence for alarms.
 * Minimal-core rebuild: bundled sounds only (no custom-sound import).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MathLevel } from './math';
import type { Exceptions } from './schedule.ts';
import type { Wake } from './stats.ts';

const ALARMS_KEY = '@wakeup_alarms';

/** 0 = Sunday ... 6 = Saturday. Empty array = one-time (no repeat). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** What it takes to turn the alarm off. 'both' = walk first, then math. 'none' = just ring. */
export type Mission = 'walk' | 'math' | 'both' | 'none';

export interface Alarm {
  id: string;
  /** 24h "HH:MM" */
  time: string;
  label: string;
  enabled: boolean;
  days: Weekday[];
  /** Bundled sound id (see constants/sounds). null = default. */
  soundId: string | null;
  /** Steps to walk to turn the alarm off. Missing on pre-3.0 alarms → DEFAULT_STEPS. */
  steps?: number;
  /** Re-ring 5 min after the walk until the user confirms they're up. Missing → off. */
  wakeCheck?: boolean;
  /** Missing on pre-3.0 alarms → 'walk'. */
  mission?: Mission;
  /** Missing → DEFAULT_MATH_LEVEL. */
  mathLevel?: MathLevel;
  /** The routine this alarm is a step of. Missing only on pre-routines alarms, before migration. */
  routineId?: string;
  /** Nap routines: minutes after the nap starts. `time` is filled in when the nap starts. */
  offsetMin?: number;
  /** On-time wakes in a row toward the next difficulty bump. */
  levelProgress?: number;
  /** Scheduling-only: the routine's one-off changes and pause. Never stored. */
  exceptions?: Exceptions;
  createdAt: number;
}

/** 'fixed' = clock times on chosen days (no days = once). 'nap' = steps counted from when you start it. */
export type RoutineKind = 'fixed' | 'nap';

/** A named group of alarms (VariAlarm-style profile): one switch, one set of days, one-off changes. */
export interface Routine {
  id: string;
  name: string;
  kind: RoutineKind;
  enabled: boolean;
  /** Fixed: repeat days, copied onto its alarms. Nap: reminder days, display only. */
  days: Weekday[];
  /** Skip / move single days, keyed by local "YYYY-MM-DD". */
  exceptions: Exceptions;
  /** Make the game harder after LEVEL_UP_AFTER on-time wakes. */
  levelUp: boolean;
  /** Nap routines: epoch ms of the running nap's start. */
  napStartedAt?: number;
  createdAt: number;
}

export const NAP_OFFSETS = [10, 15, 20, 25, 30, 45, 60] as const;

export const STEP_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_STEPS = 50;
export const MISSIONS: Mission[] = ['walk', 'math', 'both', 'none'];
export const MATH_LEVELS: MathLevel[] = [0, 1, 2];
export const DEFAULT_MATH_LEVEL: MathLevel = 1;

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

export async function writeAlarms(alarms: Alarm[]): Promise<void> {
  // `exceptions` is derived from the routine at schedule time; never persist it.
  await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms.map(({ exceptions, ...a }) => a)));
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

// --- Routines ---

const ROUTINES_KEY = '@wakeup_routines';
const PAUSE_KEY = '@wakeup_paused_until';
const WAKE_LOG_KEY = '@wakeup_wake_log';
/** Enough for the 14-day stats and a long streak, without growing forever. */
const WAKE_LOG_MAX = 400;

async function readList<T>(key: string): Promise<T[]> {
  try {
    const parsed = JSON.parse((await AsyncStorage.getItem(key)) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`read ${key} failed:`, err);
    return [];
  }
}

export const getRoutines = () => readList<Routine>(ROUTINES_KEY);

export async function writeRoutines(routines: Routine[]): Promise<void> {
  await AsyncStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
}

/** Resume day ("YYYY-MM-DD"), or null when not paused. */
export async function getPausedUntil(): Promise<string | null> {
  return AsyncStorage.getItem(PAUSE_KEY);
}

export async function setPausedUntil(day: string | null): Promise<void> {
  if (day) await AsyncStorage.setItem(PAUSE_KEY, day);
  else await AsyncStorage.removeItem(PAUSE_KEY);
}

export const getWakeLog = () => readList<Wake>(WAKE_LOG_KEY);

export async function logWake(wake: Wake): Promise<Wake[]> {
  const log = [...(await getWakeLog()), wake].slice(-WAKE_LOG_MAX);
  await AsyncStorage.setItem(WAKE_LOG_KEY, JSON.stringify(log));
  return log;
}
