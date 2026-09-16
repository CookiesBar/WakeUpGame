import type { Translate } from '@/i18n';
import type { Weekday } from '@/utils/storage';

/**
 * Human-readable summary of an alarm's repeat days, e.g. "Weekdays" or
 * "Mon · Wed · Fri". `dayLabels` must be Sunday-first (index 0 = Sunday),
 * matching the Weekday type — see `getNarrowWeekdays`.
 */
export function repeatLabel(days: Weekday[], t: Translate, dayLabels: string[]): string {
  if (days.length === 0) return t('repeat.once');
  if (days.length === 7) return t('repeat.everyDay');
  const sorted = [...days].sort();
  if (sorted.length === 5 && [1, 2, 3, 4, 5].every((d) => sorted.includes(d as Weekday))) {
    return t('repeat.weekdays');
  }
  if (sorted.length === 2 && [0, 6].every((d) => sorted.includes(d as Weekday))) {
    return t('repeat.weekends');
  }
  return sorted.map((d) => dayLabels[d]).join(' · ');
}
