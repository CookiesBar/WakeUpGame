import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { DEFAULT_SOUND_ID } from '@/constants/sounds';
import {
  cancelAlarmNotification,
  dismissAlarm as dismissAlarmNotification,
  rearmAlarmBursts,
  requestNotificationPermissions,
  scheduleAlarmNotification,
} from '@/utils/notifications';
import { effectiveAlarm, splitByDay } from '@/utils/routines';
import { dayKey } from '@/utils/schedule';
import {
  Alarm,
  DEFAULT_MATH_LEVEL,
  deleteAlarm as deleteAlarmStorage,
  generateId,
  getAlarm,
  getAlarms,
  getOnboarding,
  getPausedUntil,
  getRoutines,
  type Routine,
  saveAlarm,
  setPausedUntil,
  toggleAlarm as toggleAlarmStorage,
  type Weekday,
  writeAlarms,
  writeRoutines,
} from '@/utils/storage';

interface AlarmContextValue {
  alarms: Alarm[];
  routines: Routine[];
  /** Resume day ("YYYY-MM-DD") while paused, else null. */
  pausedUntil: string | null;
  loading: boolean;
  addAlarm: (data: Omit<Alarm, 'id' | 'createdAt'>) => Promise<Alarm>;
  updateAlarm: (alarm: Alarm) => Promise<void>;
  removeAlarm: (id: string) => Promise<void>;
  toggleAlarmEnabled: (id: string) => Promise<void>;
  /** User finished the wake-up challenge: silence the burst, arm the next one. */
  dismissAlarm: (id: string) => Promise<void>;
  refreshAlarms: () => Promise<void>;
  /** New routine with one starter alarm (`starter` overrides its defaults). */
  addRoutine: (name: string, days: Weekday[], starter?: Partial<Alarm>) => Promise<Routine>;
  updateRoutine: (routine: Routine) => Promise<void>;
  removeRoutine: (id: string) => Promise<void>;
  toggleRoutine: (id: string) => Promise<void>;
  /** Skip or move (minutes) a routine on one day; null puts it back. A function gets the current change. */
  setDayChange: (routineId: string, day: string, change: DayChange | ((current: DayChange) => DayChange)) => Promise<void>;
  setPause: (until: string | null) => Promise<void>;
  /** The alarm with its routine's days, switch, changes and pause applied. */
  effective: (alarm: Alarm) => Alarm;
}

type DayChange = number | 'skip' | null;

const AlarmContext = createContext<AlarmContextValue | undefined>(undefined);

/** Pre-routines alarms each become a one-alarm routine, once. */
async function migrate(alarms: Alarm[], routines: Routine[]): Promise<boolean> {
  const legacy = alarms.filter((a) => !a.routineId);
  if (!legacy.length) return false;
  for (const alarm of legacy) {
    const routine: Routine = {
      id: generateId(),
      name: alarm.label,
      enabled: alarm.enabled,
      days: alarm.days,
      exceptions: {},
      levelUp: false,
      createdAt: alarm.createdAt,
    };
    routines.push(routine);
    alarm.routineId = routine.id;
    alarm.enabled = true;
  }
  await writeRoutines(routines);
  await writeAlarms(alarms);
  return true;
}

export const AlarmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [pausedUntil, setPausedState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAlarms = useCallback(async () => {
    const [loaded, loadedRoutines, paused] = await Promise.all([getAlarms(), getRoutines(), getPausedUntil()]);
    loaded.sort((a, b) => a.time.localeCompare(b.time));
    setAlarms(loaded);
    setRoutines(loadedRoutines);
    // A pause that has run out is just noise.
    setPausedState(paused && paused > dayKey(new Date()) ? paused : null);
  }, []);

  /** Bring the scheduled notifications in line with storage (all alarms, or just `ids`). */
  const sync = useCallback(async (ids?: string[]) => {
    if (Platform.OS === 'web') return; // notifications are native-only
    const [all, allRoutines, paused] = await Promise.all([getAlarms(), getRoutines(), getPausedUntil()]);
    for (const alarm of all) {
      if (ids && !ids.includes(alarm.id)) continue;
      const eff = effectiveAlarm(alarm, allRoutines, paused);
      // One bad alarm mustn't leave the rest unscheduled or the UI stuck.
      try {
        if (eff.enabled) await scheduleAlarmNotification(eff);
        else await cancelAlarmNotification(alarm.id);
      } catch (err) {
        console.error(`scheduling ${alarm.id} failed:`, err);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Onboarding explains why first, then asks; after that, re-ask (and set up Android channels) on launch.
      if (await getOnboarding()) await requestNotificationPermissions();
      let [all, allRoutines] = await Promise.all([getAlarms(), getRoutines()]);
      // Nap routines were removed; their steps have no real time (00:00), so drop any saved ones.
      const naps = new Set(allRoutines.filter((r) => (r as { kind?: string }).kind === 'nap').map((r) => r.id));
      if (naps.size) {
        for (const a of all) if (a.routineId && naps.has(a.routineId)) await cancelAlarmNotification(a.id);
        all = all.filter((a) => !a.routineId || !naps.has(a.routineId));
        allRoutines = allRoutines.filter((r) => !naps.has(r.id));
        await writeRoutines(allRoutines);
        await writeAlarms(all);
      }
      const migrated = await migrate(all, allRoutines);
      const split = splitByDay(allRoutines, all, generateId);
      if (split) {
        await writeRoutines(split.routines);
        await writeAlarms(split.alarms);
      }
      if (migrated || split) await sync();
      await refreshAlarms();
      setLoading(false);
    })();
  }, [refreshAlarms, sync]);

  // Bursts are only armed for the next occurrence, so top them up on launch
  // and every time the app returns to the foreground.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const rearm = async () => {
      const [all, allRoutines, paused] = await Promise.all([getAlarms(), getRoutines(), getPausedUntil()]);
      await rearmAlarmBursts(all.map((a) => effectiveAlarm(a, allRoutines, paused)));
    };
    const run = () => rearm().catch((err) => console.error('rearmAlarmBursts failed:', err));
    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        run();
        refreshAlarms();
      }
    });
    return () => sub.remove();
  }, [refreshAlarms]);

  const addAlarm = useCallback(
    async (data: Omit<Alarm, 'id' | 'createdAt'>): Promise<Alarm> => {
      const alarm: Alarm = { ...data, id: generateId(), createdAt: Date.now() };
      await saveAlarm(alarm);
      await sync([alarm.id]);
      await refreshAlarms();
      return alarm;
    },
    [refreshAlarms, sync]
  );

  const updateAlarm = useCallback(
    async (alarm: Alarm): Promise<void> => {
      await saveAlarm(alarm);
      await sync([alarm.id]);
      await refreshAlarms();
    },
    [refreshAlarms, sync]
  );

  const removeAlarm = useCallback(
    async (id: string): Promise<void> => {
      await cancelAlarmNotification(id);
      await deleteAlarmStorage(id);
      await refreshAlarms();
    },
    [refreshAlarms]
  );

  const toggleAlarmEnabled = useCallback(
    async (id: string): Promise<void> => {
      await toggleAlarmStorage(id);
      await sync([id]);
      await refreshAlarms();
    },
    [refreshAlarms, sync]
  );

  const dismissAlarm = useCallback(async (id: string): Promise<void> => {
    const [alarm, allRoutines, paused] = await Promise.all([getAlarm(id), getRoutines(), getPausedUntil()]);
    if (alarm) await dismissAlarmNotification(effectiveAlarm(alarm, allRoutines, paused));
  }, []);

  /** Read-modify-write one routine, then reschedule its alarms. */
  const applyRoutineChange = useCallback(
    async (id: string, change: (r: Routine) => Routine | null) => {
      const all = await getRoutines();
      const idx = all.findIndex((r) => r.id === id);
      if (idx < 0) return;
      const next = change(all[idx]);
      if (next) all[idx] = next;
      else all.splice(idx, 1);
      await writeRoutines(all);

      const allAlarms = await getAlarms();
      const own = allAlarms.filter((a) => a.routineId === id);
      if (next) {
        // Days live on the routine; keep its alarms in step for anything that reads alarm.days.
        own.forEach((a) => (a.days = next.days));
        await writeAlarms(allAlarms);
      }
      if (next) {
        await sync(own.map((a) => a.id));
      } else {
        for (const a of own) await cancelAlarmNotification(a.id);
        await writeAlarms(allAlarms.filter((a) => a.routineId !== id));
      }
      await refreshAlarms();
    },
    [refreshAlarms, sync]
  );

  // Routine edits are read-modify-write on storage; run them one at a time so quick taps don't clobber each other.
  const routineQueue = useRef<Promise<unknown>>(Promise.resolve());

  const changeRoutine = useCallback(
    (id: string, change: (r: Routine) => Routine | null): Promise<void> => {
      const run = routineQueue.current.then(() => applyRoutineChange(id, change));
      routineQueue.current = run.catch(() => undefined);
      return run;
    },
    [applyRoutineChange]
  );

  const addRoutine = useCallback(
    async (name: string, days: Weekday[], starter?: Partial<Alarm>): Promise<Routine> => {
      const routine: Routine = {
        id: generateId(),
        name,
        enabled: true,
        days,
        exceptions: {},
        levelUp: true,
        createdAt: Date.now(),
      };
      await writeRoutines([...(await getRoutines()), routine]);
      await addAlarm({
        routineId: routine.id,
        time: '07:00',
        label: '',
        enabled: true,
        days,
        soundId: DEFAULT_SOUND_ID,
        steps: 50,
        wakeCheck: false,
        mission: 'math',
        mathLevel: DEFAULT_MATH_LEVEL,
        ...starter,
      });
      return routine;
    },
    [addAlarm]
  );

  const updateRoutine = useCallback(
    (routine: Routine) => changeRoutine(routine.id, () => routine),
    [changeRoutine]
  );
  const removeRoutine = useCallback((id: string) => changeRoutine(id, () => null), [changeRoutine]);
  const toggleRoutine = useCallback(
    (id: string) => changeRoutine(id, (r) => ({ ...r, enabled: !r.enabled })),
    [changeRoutine]
  );

  const setDayChange = useCallback(
    (routineId: string, day: string, change: DayChange | ((current: DayChange) => DayChange)) =>
      changeRoutine(routineId, (r) => {
        // Resolved against storage, so quick repeated taps add up.
        const next = typeof change === 'function' ? change(r.exceptions?.[day] ?? null) : change;
        const today = dayKey(new Date(Date.now() - 86_400_000)); // keep yesterday: a late move can still be pending
        const exceptions = Object.fromEntries(
          Object.entries(r.exceptions ?? {}).filter(([d]) => d >= today && d !== day)
        );
        if (next !== null && next !== 0) exceptions[day] = next;
        return { ...r, exceptions };
      }),
    [changeRoutine]
  );

  const setPause = useCallback(
    async (until: string | null) => {
      await setPausedUntil(until);
      await sync();
      await refreshAlarms();
    },
    [refreshAlarms, sync]
  );


  const effective = useCallback(
    (alarm: Alarm) => effectiveAlarm(alarm, routines, pausedUntil),
    [routines, pausedUntil]
  );

  return (
    <AlarmContext.Provider
      value={{
        alarms,
        routines,
        pausedUntil,
        loading,
        addAlarm,
        updateAlarm,
        removeAlarm,
        toggleAlarmEnabled,
        dismissAlarm,
        refreshAlarms,
        addRoutine,
        updateRoutine,
        removeRoutine,
        toggleRoutine,
        setDayChange,
        setPause,
        effective,
      }}
    >
      {children}
    </AlarmContext.Provider>
  );
};

export function useAlarms(): AlarmContextValue {
  const ctx = useContext(AlarmContext);
  if (!ctx) throw new Error('useAlarms must be used within an AlarmProvider');
  return ctx;
}
