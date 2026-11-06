// "Still awake?" check: 5 min after the wake-up game is done, the alarm rings
// again until the user opens the app. If it rings out unanswered, they went back
// to sleep, and that alarm's game gets one notch harder.
import type { MathLevel } from './math';

export const WAKE_CHECK_DELAY_MS = 5 * 60 * 1000;

// Game difficulty per alarm (3.0's walk + math missions)
export const STEP_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_STEPS = 50;
export const MATH_LEVELS: MathLevel[] = [0, 2];
export const DEFAULT_MATH_LEVEL: MathLevel = 0;

export interface Difficulty {
    steps?: number;
    mathLevel?: MathLevel;
}

export type WakeCheckOutcome = 'pending' | 'awake' | 'missed';

/**
 * firesAt: when the check starts ringing; windowMs: how long it keeps ringing.
 * Opening the app before it rings proves nothing; during the ring = awake;
 * after it rang out = missed.
 */
export const wakeCheckOutcome = (firesAt: number, now: number, windowMs: number): WakeCheckOutcome =>
    now < firesAt ? 'pending' : now < firesAt + windowMs ? 'awake' : 'missed';

/**
 * A check that rings out unanswered makes the alarm ring again, the whole game. Opening the app while it still
 * rings starts that game. AlarmKit's re-ring keeps going while its Stop is tapped (up to this long); the
 * notification fallback is one burst (`burstMs`).
 */
export const RING_AGAIN_MS = 30 * 60 * 1000;
export const ringAgainEnds = (startsAt: number, burstMs: number, viaAlarmKit: boolean): number =>
    startsAt + (viaAlarmKit ? RING_AGAIN_MS : burstMs);

/** One notch harder: math level first, then more steps. null = already at the top. */
export function harder<T extends Difficulty>(alarm: T): T | null {
    const level = alarm.mathLevel ?? DEFAULT_MATH_LEVEL;
    if (level < 2) return { ...alarm, mathLevel: 2 };
    const steps = STEP_OPTIONS.find(s => s > (alarm.steps ?? DEFAULT_STEPS));
    return steps ? { ...alarm, steps } : null;
}
