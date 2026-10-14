// Bedtimes that end a whole ~90 min sleep cycle right at the alarm. Pure, so `node utils/sleepCycle.check.ts` can run it.

// ponytail: fixed averages; real cycles run ~70–120 min, add a setting if users ask.
export const CYCLE_MIN = 90;
export const FALL_ASLEEP_MIN = 15;
export const CYCLE_OPTIONS = [6, 5, 4];

export interface Bedtime {
    at: Date;
    cycles: number;
    passed: boolean;
}

export function bedtimes(alarmAt: Date, now: Date): Bedtime[] {
    return CYCLE_OPTIONS.map(cycles => {
        const at = new Date(alarmAt.getTime() - (cycles * CYCLE_MIN + FALL_ASLEEP_MIN) * 60_000);
        return { at, cycles, passed: at <= now };
    });
}
