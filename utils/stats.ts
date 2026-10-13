/** Wake-up stats for the "You beat Wakey" screen. Pure, so `node utils/stats.check.ts` can run it. */
import { dayKey, startOfDay } from './schedule.ts';

export interface Wake {
  /** Epoch ms the challenge was finished. */
  at: number;
  /** Took longer than ON_TIME_MS from the first ring. */
  late: boolean;
}

/** Finished within this long of the first ring = "up on the first ring". */
export const ON_TIME_MS = 5 * 60_000;
/** On-time wakes in a row before Wakey makes the game harder. */
export const LEVEL_UP_AFTER = 5;
export const STATS_WINDOW_DAYS = 14;

/** Days in a row with at least one finished wake-up, counting back from today (or yesterday). */
export function streak(log: Wake[], now: Date): number {
  const days = new Set(log.map((w) => dayKey(new Date(w.at))));
  let start = days.has(dayKey(now)) ? 0 : -1;
  let n = 0;
  while (days.has(dayKey(startOfDay(now, start - n)))) n++;
  return n;
}

/** On-time wakes out of all wakes in the last STATS_WINDOW_DAYS. */
export function firstRing(log: Wake[], now: Date): { onTime: number; total: number } {
  const since = startOfDay(now, -(STATS_WINDOW_DAYS - 1)).getTime();
  const recent = log.filter((w) => w.at >= since);
  return { onTime: recent.filter((w) => !w.late).length, total: recent.length };
}
