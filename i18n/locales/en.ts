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
    back: 'Back',
  },
  home: {
    today: 'Today',
    clockLabel: 'Alarms on %{day}: %{times}',
    noAlarms: 'No alarms on %{day}',
    changeDay: 'Change just this day',
    addRoutine: 'Add a routine',
    next: 'Next',
    rang: 'Rang',
    movedFrom: 'moved from %{time}',
    skipped: 'skipped',
  },
  alarmEditor: {
    done: 'Done',
    label: 'Label',
    sound: 'Sound',
    stepsValue: '%{count} steps',
    wakeCheck: 'Still awake? check',
    wakeCheckHint: 'Rings again 5 min after you turn it off, until you tap it',
    mission: 'Turn off by',
    mission_walk: 'Walk',
    mission_math: 'Math',
    mission_both: 'Both',
    mathLevel_0: 'Easy',
    mathLevel_1: 'Medium',
    mathLevel_2: 'Hard',
    mission_none: 'Just ring',
  },
  ring: {
    defaultLabel: 'Wake up',
    notificationBody: 'Tap to turn it off',
    stepsOf: 'of %{count} steps',
    startWalking: 'Start walking — steps show up after a few seconds',
    stepsLeft: '%{count} to go',
    keepMoving: 'Keep moving!',
    mathOf: 'Problem %{n} of %{count}',
    mathHint: 'Solve it to turn the alarm off',
    mathWrong: 'Not quite — try again',
    mathDelete: 'Delete',
    mathCheck: 'Check answer',
    beat: 'Beat Wakey',
    imUp: "I'm up!",
    intro_math: "Beat me at math and I'll stop!",
    intro_walk: "Walk %{count} steps and I'll stop!",
    intro_both: "Walk, then math. Then I'll stop!",
    intro_none: 'Rise and shine!',
    win: 'You beat Wakey!',
    upAt: 'Up at %{time} · %{m} min after the first ring',
    streak: 'day streak',
    firstRing: 'first-ring wake-ups',
    harderIn: 'Game gets harder in %{count} on-time wake-ups',
    leveledUp: 'Level up! Your game just got harder.',
    next: 'Next: %{time} %{label}',
  },
  wakeCheck: {
    title: 'Still awake?',
    body: "Tap to confirm you're up",
  },
  routines: {
    defaultName: '%{day} Routine',
    fallback: 'Routine',
  },
  day: {
    only: 'Only this day changes. Your routines stay as they are.',
    skip: 'Skip once',
    unskip: 'Ring after all',
    earlier: '15 min earlier',
    later: '15 min later',
    reset: 'Reset',
    none: 'Nothing rings this day.',
    done: 'Done',
  },
  routineEditor: {
    name: 'Name',
    alarms: 'Alarms',
    addAlarm: 'Add alarm',
    levelUp: 'Wakey levels up the game',
    levelUpHint: 'Harder after 5 on-time wake-ups in a row',
    everyWeek: 'Every week',
    everyNWeeks: 'Every %{count} weeks',
    moreOften: 'More often',
    lessOften: 'Less often',
    nextRing: 'Next: %{date}',
    delete: 'Delete routine',
    deleteMessage: 'Remove "%{name}" and its alarms?',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    system: 'System',
    subscription: 'Subscription',
    legal: 'Legal',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    done: 'Done',
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
