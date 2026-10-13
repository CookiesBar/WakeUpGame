import { withPause } from './schedule.ts';
import type { Alarm, Routine } from './storage';

/** A fixed routine's repeat rule, for the schedule math. */
export const repeatOf = (r: Routine) => ({ days: r.days, everyWeeks: r.everyWeeks, anchor: r.anchor });

/**
 * The alarm as the notification engine should see it: its routine's days,
 * switch, one-off changes and pause folded in.
 */
export function effectiveAlarm(
  alarm: Alarm,
  routines: Routine[],
  pausedUntil: string | null,
  now = new Date()
): Alarm {
  const routine = routines.find((r) => r.id === alarm.routineId);
  if (!routine) return alarm;
  return {
    ...alarm,
    ...repeatOf(routine),
    enabled: routine.enabled && alarm.enabled,
    exceptions: withPause(routine.exceptions, pausedUntil, now),
  };
}

/**
 * Each weekday owns its alarms: a fixed routine on several weekdays becomes one
 * routine per weekday, alarms and that weekday's one-off changes copied. The
 * first weekday keeps the original ids. null when nothing is shared.
 */
export function splitByDay(
  routines: Routine[],
  alarms: Alarm[],
  newId: () => string
): { routines: Routine[]; alarms: Alarm[] } | null {
  const shared = routines.filter((r) => r.days.length > 1);
  if (!shared.length) return null;
  const sharedIds = new Set(shared.map((r) => r.id));
  const outRoutines = routines.filter((r) => !sharedIds.has(r.id));
  const outAlarms = alarms.filter((a) => !a.routineId || !sharedIds.has(a.routineId));
  for (const r of shared) {
    const own = alarms.filter((a) => a.routineId === r.id);
    r.days.forEach((day, i) => {
      const id = i === 0 ? r.id : newId();
      const exceptions = Object.fromEntries(
        Object.entries(r.exceptions ?? {}).filter(([key]) => new Date(`${key}T00:00`).getDay() === day)
      );
      outRoutines.push({ ...r, id, days: [day], exceptions });
      outAlarms.push(...own.map((a) => ({ ...a, id: i === 0 ? a.id : newId(), routineId: id, days: [day] })));
    });
  }
  return { routines: outRoutines, alarms: outAlarms };
}

/** A routine's steps in ring order. */
export function stepsOf(routine: Routine, alarms: Alarm[]): Alarm[] {
  return alarms.filter((a) => a.routineId === routine.id).sort((a, b) => a.time.localeCompare(b.time));
}
