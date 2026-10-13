import type { Translate } from '@/i18n';
import { type Alarm, DEFAULT_MATH_LEVEL, DEFAULT_STEPS } from '@/utils/storage';

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
