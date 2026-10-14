// Wake-up streak for the ring screen's finish. Pure, so `node utils/stats.check.ts` can run it.

/** Epoch ms of each finished wake-up game. */
export type WakeLog = number[];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const daysFrom = (d: Date, offset: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);

/** Days in a row with at least one finished wake-up, counting back from today (or yesterday). */
export function streak(log: WakeLog, now: Date): number {
    const days = new Set(log.map(at => dayKey(new Date(at))));
    const start = days.has(dayKey(now)) ? 0 : -1;
    let n = 0;
    while (days.has(dayKey(daysFrom(now, start - n)))) n++;
    return n;
}
