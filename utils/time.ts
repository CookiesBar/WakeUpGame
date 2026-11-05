// Alarm time maths for the home and editor screens. Pure, so `node utils/time.check.ts` can run it.

/** When an alarm at h:m next rings. days = [Sun..Sat]; none set = one-time (today, or tomorrow if passed). */
export function nextAlarmDate(hours: number, minutes: number, days: boolean[], now: Date): Date {
    const at = new Date(now);
    at.setHours(hours, minutes, 0, 0);
    if (!days.some(Boolean)) {
        if (at <= now) at.setDate(at.getDate() + 1);
        return at;
    }
    for (let i = 0; i <= 7; i++) {
        const day = (now.getDay() + i) % 7;
        if (days[day] && (i > 0 || at > now)) {
            at.setDate(at.getDate() + i);
            return at;
        }
    }
    return at; // unreachable: some day is set
}

/** Whole days, hours and minutes from now until `at` (never negative). */
export function untilParts(at: Date, now: Date): { d: number; h: number; m: number } {
    const total = Math.max(0, Math.floor((at.getTime() - now.getTime()) / 60_000));
    return { d: Math.floor(total / 1440), h: Math.floor((total % 1440) / 60), m: total % 60 };
}

/** "7:45" + "AM" on a 12-hour device, "07:45" + "" on a 24-hour one. */
export function clockParts(hours: number, minutes: number, h24: boolean): { time: string; ap: string } {
    const mm = String(minutes).padStart(2, '0');
    if (h24) return { time: `${String(hours).padStart(2, '0')}:${mm}`, ap: '' };
    return { time: `${hours % 12 || 12}:${mm}`, ap: hours < 12 ? 'AM' : 'PM' };
}
