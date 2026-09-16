import type { TranslationSchema } from './en';

/** Spanish (es). Machine-translated from en.ts — worth a native-speaker pass before shipping. */
const es: TranslationSchema = {
  common: {
    cancel: 'Cancelar',
    save: 'Guardar',
    delete: 'Eliminar',
    alarmFallback: 'Alarma',
  },
  repeat: {
    once: 'Una vez',
    everyDay: 'Todos los días',
    weekdays: 'Días laborables',
    weekends: 'Fines de semana',
  },
  home: {
    deleteAlarmTitle: 'Eliminar alarma',
    deleteAlarmMessage: '¿Eliminar "%{label}"?',
    emptyTitle: 'Aún no hay alarmas',
    emptyBody: 'Crea una y supera el reto para despertar y apagarla.',
    emptyCta: 'Crea tu primera alarma',
  },
  alarmEditor: {
    addTitle: 'Añadir alarma',
    editTitle: 'Editar alarma',
    repeat: 'Repetir',
    label: 'Etiqueta',
    labelPlaceholder: 'Alarma matutina',
    sound: 'Sonido',
    deleteAlarm: 'Eliminar alarma',
  },
  game: {
    headerTitle: 'Reto para despertar',
    stepProgress: 'Paso %{step} de %{total}',
    shakeTitle: '¡Agita tu teléfono!',
    shakeDesc: 'Sigue agitándolo para despertarte',
    shakingOn: '¡Agitando!',
    mathTitle: 'Cálculo rápido',
    mathQuestion: '%{question} = ?',
    problemProgress: 'Problema %{step} de %{total}',
    largestTitle: 'Elige el más grande',
    largestDesc: 'Toca el número más grande',
    completeTitle: '¡Ya estás despierto!',
    completeDesc: 'Alarma apagada. Que tengas un gran día.',
    difficultyEasy: 'FÁCIL',
    difficultyMedium: 'MEDIO',
    difficultyHard: 'DIFÍCIL',
  },
  ring: {
    defaultLabel: '¡Despierta!',
    hint: 'Completa el reto para despertar y apagar la alarma.',
    startChallenge: 'Comenzar reto',
  },
};

export default es;
