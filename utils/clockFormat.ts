import { getCalendars } from 'expo-localization';

import { strings, t } from '@/i18n';
import { clockParts } from '@/utils/time';

/** The device's 12/24-hour preference (24 h when unknown). */
export const uses24h = (): boolean => getCalendars()[0]?.uses24hourClock ?? true;

export const formatClock = (hours: number, minutes: number) => clockParts(hours, minutes, uses24h());

/** "6:45 AM" or "06:45". */
export const clockText = (hours: number, minutes: number) => {
    const { time, ap } = formatClock(hours, minutes);
    return ap ? `${time} ${ap}` : time;
};

/** "Weekdays", "Every day", "Mon, Wed" or "Once". days = [Sun..Sat]. */
export function repeatText(days: boolean[]): string {
    const n = days.filter(Boolean).length;
    if (n === 0) return t('alarms.once');
    if (n === 7) return t('edit.everyDay');
    if (days.every((on, i) => on === (i >= 1 && i <= 5))) return t('edit.weekdays');
    if (days.every((on, i) => on === (i === 0 || i === 6))) return t('edit.weekends');
    return days.map((on, i) => (on ? strings().days.short[i] : null)).filter(Boolean).join(', ');
}
