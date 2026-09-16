import type { TranslationSchema } from './en';

/** Swedish (sv). Machine-translated from en.ts — worth a native-speaker pass before shipping. */
const sv: TranslationSchema = {
  common: {
    cancel: 'Avbryt',
    save: 'Spara',
    delete: 'Ta bort',
    alarmFallback: 'Alarm',
  },
  repeat: {
    once: 'En gång',
    everyDay: 'Varje dag',
    weekdays: 'Vardagar',
    weekends: 'Helger',
  },
  home: {
    deleteAlarmTitle: 'Ta bort alarm',
    deleteAlarmMessage: 'Ta bort "%{label}"?',
    emptyTitle: 'Inga alarm än',
    emptyBody: 'Ställ in ett och klara uppvakningsutmaningen för att stänga av det.',
    emptyCta: 'Skapa ditt första alarm',
  },
  alarmEditor: {
    addTitle: 'Lägg till alarm',
    editTitle: 'Redigera alarm',
    repeat: 'Upprepa',
    label: 'Etikett',
    labelPlaceholder: 'Morgonalarm',
    sound: 'Ljud',
    deleteAlarm: 'Ta bort alarm',
  },
  game: {
    headerTitle: 'Uppvakningsutmaningen',
    stepProgress: 'Steg %{step} av %{total}',
    shakeTitle: 'Skaka din telefon!',
    shakeDesc: 'Fortsätt skaka för att vakna ordentligt',
    shakingOn: 'Skakar!',
    mathTitle: 'Snabbmatte',
    mathQuestion: '%{question} = ?',
    problemProgress: 'Uppgift %{step} av %{total}',
    largestTitle: 'Välj det största',
    largestDesc: 'Tryck på det största talet',
    completeTitle: 'Du är vaken!',
    completeDesc: 'Alarmet är avstängt. Ha en fin dag.',
    difficultyEasy: 'LÄTT',
    difficultyMedium: 'MEDEL',
    difficultyHard: 'SVÅR',
  },
  ring: {
    defaultLabel: 'Vakna!',
    hint: 'Klara uppvakningsutmaningen för att stänga av alarmet.',
    startChallenge: 'Starta utmaningen',
  },
};

export default sv;
