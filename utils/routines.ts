import { hhmm, withPause } from './schedule.ts';
import type { Alarm, Routine } from './storage';

/**
 * The alarm as the notification engine should see it: its routine's days,
 * switch, one-off changes and pause folded in. Nap steps get a real clock
 * time once the nap is running, and are off otherwise.
 */
export function effectiveAlarm(
  alarm: Alarm,
  routines: Routine[],
  pausedUntil: string | null,
  now = new Date()
): Alarm {
  const routine = routines.find((r) => r.id === alarm.routineId);
  if (!routine) return alarm;
  if (routine.kind === 'nap') {
    const at = routine.napStartedAt === undefined ? 0 : routine.napStartedAt + (alarm.offsetMin ?? 0) * 60_000;
    return {
      ...alarm,
      days: [],
      time: at ? hhmm(new Date(at)) : alarm.time,
      enabled: routine.enabled && alarm.enabled && at > now.getTime(),
    };
  }
  return {
    ...alarm,
    days: routine.days,
    enabled: routine.enabled && alarm.enabled,
    exceptions: withPause(routine.exceptions, pausedUntil, now),
  };
}

/** A routine's steps in ring order. */
export function stepsOf(routine: Routine, alarms: Alarm[]): Alarm[] {
  const own = alarms.filter((a) => a.routineId === routine.id);
  return routine.kind === 'nap'
    ? own.sort((a, b) => (a.offsetMin ?? 0) - (b.offsetMin ?? 0))
    : own.sort((a, b) => a.time.localeCompare(b.time));
}
