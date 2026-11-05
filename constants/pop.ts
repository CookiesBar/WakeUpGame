/**
 * v3 "pop" look: bold blue, heavy ink outlines with a hard shadow underneath, sun-yellow
 * accents, cool greys. Matches Pop Wakey (components/Wakey.tsx). Font stays Plus Jakarta Sans.
 */
export const Pop = {
  blue: '#1652FF',
  blueDeep: '#0E3BC4',
  night: '#0E1A4D',
  ink: '#0E0E12',
  sun: '#F8B800',
  mist: '#DDE1E7', // Wakey's eye whites, inactive tracks
  paper: '#F4F6FB',
  white: '#FFFFFF',
  chip: '#EEF1F7',
  sub: '#4A5068', // secondary text on paper/white (7.4:1)
  faint: '#8A90A6', // disabled text
  onBlue: '#D6E0FF', // secondary text on blue (4.9:1)
  danger: '#B42318',
  dangerBg: '#FFE3E3',
} as const;

/** Outline every pop surface carries. */
export const LINE = 2.5;

export const PopFont = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
} as const;
