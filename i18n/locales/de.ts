import type { TranslationSchema } from './en';

/** German (de). Machine-translated from en.ts — worth a native-speaker pass before shipping. */
const de: TranslationSchema = {
  common: {
    cancel: 'Abbrechen',
    save: 'Speichern',
    delete: 'Löschen',
    alarmFallback: 'Alarm',
  },
  repeat: {
    once: 'Einmalig',
    everyDay: 'Täglich',
    weekdays: 'Wochentage',
    weekends: 'Wochenenden',
  },
  home: {
    deleteAlarmTitle: 'Alarm löschen',
    deleteAlarmMessage: '"%{label}" entfernen?',
    emptyTitle: 'Noch keine Alarme',
    emptyBody: 'Stell einen ein und bestehe die Aufwach-Challenge, um ihn auszuschalten.',
    emptyCta: 'Ersten Alarm erstellen',
  },
  alarmEditor: {
    addTitle: 'Alarm hinzufügen',
    editTitle: 'Alarm bearbeiten',
    repeat: 'Wiederholen',
    label: 'Bezeichnung',
    labelPlaceholder: 'Morgenalarm',
    sound: 'Klingelton',
    deleteAlarm: 'Alarm löschen',
  },
  game: {
    headerTitle: 'Aufwach-Challenge',
    stepProgress: 'Schritt %{step} von %{total}',
    shakeTitle: 'Schüttle dein Handy!',
    shakeDesc: 'Weiter schütteln, um richtig wach zu werden',
    shakingOn: 'Schütteln!',
    mathTitle: 'Kopfrechnen',
    mathQuestion: '%{question} = ?',
    problemProgress: 'Aufgabe %{step} von %{total}',
    largestTitle: 'Wähle die größte Zahl',
    largestDesc: 'Tippe auf die größte Zahl',
    completeTitle: 'Du bist wach!',
    completeDesc: 'Alarm aus. Schönen Tag noch.',
    difficultyEasy: 'LEICHT',
    difficultyMedium: 'MITTEL',
    difficultyHard: 'SCHWER',
  },
  ring: {
    defaultLabel: 'Aufwachen!',
    hint: 'Bestehe die Aufwach-Challenge, um den Alarm auszuschalten.',
    startChallenge: 'Challenge starten',
  },
};

export default de;
