/**
 * English copy — the source of truth for every other locale file. Keep keys
 * grouped by screen so a translator can work through one section at a time.
 * Interpolation uses i18n-js's `%{name}` placeholder syntax.
 */
const en = {
  common: {
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    alarmFallback: 'Alarm',
  },
  repeat: {
    once: 'Once',
    everyDay: 'Every day',
    weekdays: 'Weekdays',
    weekends: 'Weekends',
  },
  home: {
    deleteAlarmTitle: 'Delete alarm',
    deleteAlarmMessage: 'Remove "%{label}"?',
    emptyTitle: 'No alarms yet',
    emptyBody: 'Set one and beat the wake-up challenge to turn it off.',
    emptyCta: 'Create your first alarm',
  },
  alarmEditor: {
    addTitle: 'Add Alarm',
    editTitle: 'Edit Alarm',
    repeat: 'Repeat',
    label: 'Label',
    labelPlaceholder: 'Morning Alarm',
    sound: 'Sound',
    deleteAlarm: 'Delete Alarm',
  },
  game: {
    headerTitle: 'Wake Up Challenge',
    stepProgress: 'Step %{step} of %{total}',
    shakeTitle: 'Shake your phone!',
    shakeDesc: 'Keep shaking to wake yourself up',
    shakingOn: 'Shaking!',
    mathTitle: 'Quick math',
    mathQuestion: '%{question} = ?',
    problemProgress: 'Problem %{step} of %{total}',
    largestTitle: 'Pick the largest',
    largestDesc: 'Tap the biggest number',
    completeTitle: "You're awake!",
    completeDesc: 'Alarm off. Have a great day.',
    difficultyEasy: 'EASY',
    difficultyMedium: 'MEDIUM',
    difficultyHard: 'HARD',
  },
  ring: {
    defaultLabel: 'Wake Up!',
    hint: 'Complete the wake-up challenge to turn off the alarm.',
    startChallenge: 'Start challenge',
  },
} as const;

export default en;

/**
 * Same nested shape as `en`, but every leaf widened to `string` — lets a
 * translation file (`es.ts`, etc.) be typed against it so TypeScript flags a
 * missing or misspelled key without forcing the same literal English text.
 */
type DeepStringify<T> = T extends string ? string : { [K in keyof T]: DeepStringify<T[K]> };
export type TranslationSchema = DeepStringify<typeof en>;
