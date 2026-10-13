/**
 * Pure occurrence math for alarms with one-off changes ("skip Tuesday",
 * "move Thursday +15 min") and pauses. No RN imports, so it runs under
 * `node utils/schedule.check.ts`.
 */

/** Per-date change to a routine, keyed by the local day it would have rung: minutes to shift, or skip. */
export type Exceptions = Record<string, number | 'skip'>;

/** Weeks of dated triggers to schedule for a weekday that has a one-off change coming up. */
export const HORIZON_WEEKS = 4;

export interface Repeating {
  /** 24h "HH:MM" */
  time: string;
  /** 0 = Sunday … 6 = Saturday. Empty = rings once, at the next HH:MM. */
  days: number[];
  exceptions?: Exceptions;
  /** Repeating only: ring every N weeks (missing = 1). */
  everyWeeks?: number;
  /** A day in a week that rings, when everyWeeks > 1. */
  anchor?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local "YYYY-MM-DD". */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Midnight of the local day `offset` days after `d`. */
export function startOfDay(d: Date, offset = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
}

export function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function at(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

/** The base occurrence after its one-off change; null when skipped. */
export function applyException(base: Date, ex?: Exceptions): Date | null {
  const e = ex?.[dayKey(base)];
  if (e === 'skip') return null;
  if (typeof e === 'number') return new Date(base.getTime() + e * 60_000);
  return base;
}

/** Skip every day from today up to (not including) `pausedUntil`, on top of the routine's own changes. */
export function withPause(ex: Exceptions | undefined, pausedUntil: string | null, now: Date): Exceptions {
  const out: Exceptions = { ...ex };
  if (!pausedUntil) return out;
  for (let d = startOfDay(now); dayKey(d) < pausedUntil; d = startOfDay(d, 1)) out[dayKey(d)] = 'skip';
  return out;
}

/** Monday of the week containing `d`. */
export const mondayOf = (d: Date) => startOfDay(d, -((d.getDay() + 6) % 7));

const sparse = (r: Repeating) => (r.everyWeeks ?? 1) > 1;

/** Is `day` in a week that rings? Weeks run Monday–Sunday, counted from the anchor's week. */
function onWeek(r: Repeating, day: Date): boolean {
  if (!sparse(r)) return true;
  const anchor = r.anchor ? new Date(`${r.anchor}T00:00`) : day;
  const weeks = Math.round((mondayOf(day).getTime() - mondayOf(anchor).getTime()) / (7 * 86_400_000));
  const n = r.everyWeeks!;
  return ((weeks % n) + n) % n === 0;
}

/** Weeks to look ahead: long enough to hold a ringing week, however sparse. */
const horizon = (r: Repeating) => Math.max(HORIZON_WEEKS, (r.everyWeeks ?? 1) + 1);

/** Base (unchanged) occurrences on the days [from, from + days). */
function bases(r: Repeating, from: Date, days: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < days; i++) {
    const day = startOfDay(from, i);
    if (r.days.includes(day.getDay()) && onWeek(r, day)) out.push(at(day, r.time));
  }
  return out;
}

/** Next time it actually rings, after `now`. null = nothing coming (skipped one-time, or everything skipped). */
export function nextFire(r: Repeating, now: Date): Date | null {
  if (r.days.length === 0) {
    let base = at(now, r.time);
    if (base <= now) base = at(startOfDay(now, 1), r.time);
    const fire = applyException(base, r.exceptions);
    return fire && fire > now ? fire : null;
  }
  // From yesterday: a late occurrence moved forward can still be ahead of us.
  const fires = bases(r, startOfDay(now, -1), horizon(r) * 7 + 2)
    .map((b) => applyException(b, r.exceptions))
    .filter((f): f is Date => !!f && f > now);
  return fires[0] ?? null;
}

export interface TriggerPlan {
  /** Weekdays that ring at the plain time every week (cheap WEEKLY triggers). */
  weekly: number[];
  /** Exact fire times for one-time alarms and for weekdays with a one-off change coming up. */
  dates: Date[];
  /** When to rebuild the plan: a change has passed (back to WEEKLY) or the dated run is ending. */
  rebuildAt?: number;
}

/**
 * Which notifications to schedule. A weekday with no change in the next
 * HORIZON_WEEKS keeps its WEEKLY trigger; one with a change gets dated
 * triggers for the whole horizon instead, rebuilt on a later app launch.
 * Every-N-weeks routines always get dated triggers, rebuilt after each ring.
 * ponytail: if the app isn't opened for HORIZON_WEEKS after a change (or after an
 * every-N-weeks ring), that weekday goes quiet.
 */
export function planTriggers(r: Repeating, now: Date): TriggerPlan {
  if (r.days.length === 0) {
    const fire = nextFire(r, now);
    return { weekly: [], dates: fire ? [fire] : [] };
  }
  const plan: TriggerPlan = { weekly: [], dates: [] };
  const rebuild: number[] = [];
  for (const day of r.days) {
    const own = bases({ ...r, days: [day] }, startOfDay(now, -1), horizon(r) * 7 + 1);
    const changed = own.filter((b) => r.exceptions?.[dayKey(b)] !== undefined);
    if (changed.length === 0 && !sparse(r)) {
      plan.weekly.push(day);
      continue;
    }
    const fires = own
      .map((b) => applyException(b, r.exceptions))
      .filter((f): f is Date => !!f && f > now);
    plan.dates.push(...fires);
    // Rebuild the day after the last change, or a week before the dated run ends
    // (every N weeks: the day after the next ring, to add the one after it).
    const lastChange = changed.length ? startOfDay(changed[changed.length - 1], 1).getTime() : Infinity;
    const due = sparse(r)
      ? fires.length ? startOfDay(fires[0], 1).getTime() : Infinity
      : Math.max((fires[fires.length - 1]?.getTime() ?? now.getTime()) - 7 * 86_400_000, now.getTime());
    const when = Math.min(lastChange, due);
    if (when < Infinity) rebuild.push(when);
  }
  plan.dates.sort((a, b) => a.getTime() - b.getTime());
  if (rebuild.length) plan.rebuildAt = Math.min(...rebuild);
  return plan;
}

export type DayState = 'normal' | 'moved' | 'skipped';

/** How a routine's alarm at `time` looks on a given day, for the week strip and day sheet. */
export function dayState(r: Repeating, day: Date): { state: DayState; fire: Date | null; base: Date } | null {
  if (r.days.length && (!r.days.includes(day.getDay()) || !onWeek(r, day))) return null;
  const base = at(day, r.time);
  const fire = applyException(base, r.exceptions);
  return { state: !fire ? 'skipped' : fire.getTime() === base.getTime() ? 'normal' : 'moved', fire, base };
}
