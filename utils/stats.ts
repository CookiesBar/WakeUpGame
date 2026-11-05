// Wake-up streak. Pure, so `node utils/stats.check.ts` can run it.

/** Epoch ms of each finished wake-up game. */
export type WakeLog = number[];

/** Badges along the way. */
export const MILESTONES = [7, 14, 30, 60] as const;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const daysFrom = (d: Date, offset: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
/** Monday of the week `d` is in. */
const weekOf = (d: Date) => dayKey(daysFrom(d, -((d.getDay() + 6) % 7)));

/** Days in a row with at least one finished wake-up, counting back from today (or yesterday). */
export function streak(log: WakeLog, now: Date): number {
    return streakV2(log, now).count;
}

export type DayMark = 'done' | 'rest' | 'missed' | 'open';

export interface StreakInfo {
    /** Mornings in the streak (rest days hold it, they don't add to it). */
    count: number;
    /** This week, Monday first. 'open' = today not done yet, or still ahead. */
    week: DayMark[];
    /** Index into `week` of today. */
    today: number;
    /** Next badge to reach, or null past the last one. */
    nextMilestone: number | null;
}

/**
 * Streak v2: one missed morning per Monday-to-Sunday week is forgiven as a rest day,
 * as long as it sits between two finished ones. A second miss in a week ends the streak.
 */
export function streakV2(log: WakeLog, now: Date): StreakInfo {
    const done = new Set(log.map(at => dayKey(new Date(at))));
    const rested = new Set<string>();
    const restWeeks = new Set<string>();
    let count = 0;
    let d = done.has(dayKey(now)) ? 0 : -1;
    for (;;) {
        const day = daysFrom(now, d);
        if (done.has(dayKey(day))) {
            count++;
        } else if (
            // Yesterday can rest before today's alarm: the streak stays alive until today is missed too.
            (count > 0 || d === -1) &&
            !restWeeks.has(weekOf(day)) &&
            done.has(dayKey(daysFrom(day, -1)))
        ) {
            rested.add(dayKey(day));
            restWeeks.add(weekOf(day));
        } else {
            break;
        }
        d--;
    }

    const today = (now.getDay() + 6) % 7;
    const week = Array.from({ length: 7 }, (_, i): DayMark => {
        const key = dayKey(daysFrom(now, i - today));
        if (done.has(key)) return 'done';
        if (rested.has(key)) return 'rest';
        return i >= today ? 'open' : 'missed';
    });
    return { count, week, today, nextMilestone: MILESTONES.find(m => m > count) ?? null };
}
