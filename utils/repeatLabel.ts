import type { Translate } from '@/i18n';
import { type Alarm, DEFAULT_MATH_LEVEL, DEFAULT_STEPS, type Weekday } from '@/utils/storage';

/** "Math · Hard", "50 steps", "Just ring" — what it takes to turn this alarm off. */
export function missionLabel(alarm: Alarm, t: Translate): string {
  const mission = alarm.mission ?? 'walk';
  const steps = t('alarmEditor.stepsValue', { count: alarm.steps ?? DEFAULT_STEPS });
  const math = `${t('alarmEditor.mission_math')} · ${t(`alarmEditor.mathLevel_${alarm.mathLevel ?? DEFAULT_MATH_LEVEL}`)}`;
  if (mission === 'walk') return steps;
  if (mission === 'math') return math;
  if (mission === 'both') return `${steps} + ${math}`;
  return t('alarmEditor.mission_none');
}

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
