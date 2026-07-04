/**
 * Wakey design system — ported from the Claude Design UI kit.
 * Brand blue #0063F3, accent yellow #FFBC00, purple support, cool blue-tinted
 * neutrals. Display font Fredoka, body font Nunito. Chunky, rounded, glassy.
 */

export const Colors = {
  // Brand ramps
  blue50: '#E8F1FF',
  blue100: '#CFE0FF',
  blue200: '#A6C6FF',
  blue300: '#6FA2FF',
  blue400: '#3B82FF',
  blue500: '#0063F3', // primary
  blue600: '#0052CC',
  blue700: '#0041A3',
  blue800: '#00337F',

  yellow100: '#FFEDB3',
  yellow400: '#FFC933',
  yellow500: '#FFBC00', // accent
  yellow700: '#B88700',

  purple100: '#EDE7FF',
  purple400: '#A78BEB',
  purple500: '#8B6FE0',
  purple600: '#7256C7',

  green500: '#2FC66B',
  green600: '#23A657',
  red500: '#FF5A5F',
  red600: '#E3474C',
  orange500: '#FF8A3D',

  // Cool neutrals
  ink900: '#0B1B3B', // headings
  ink700: '#2A3A5C', // body
  ink500: '#5A6B8C', // secondary
  ink400: '#8A98B5', // muted / placeholder
  ink200: '#CAD4E6', // hairline
  ink100: '#E6ECF5',
  paper: '#F4F8FF', // bg top
  paper2: '#E8F1FF', // bg bottom
  white: '#FFFFFF',

  // Semantic aliases
  primary: '#0063F3',
  primaryPress: '#0041A3',
  accent: '#FFBC00',
  textHeading: '#0B1B3B',
  textBody: '#2A3A5C',
  textMuted: '#5A6B8C',
  textFaint: '#8A98B5',
  surfaceCard: '#FFFFFF',
  borderHairline: '#CAD4E6',
  success: '#2FC66B',
  danger: '#FF5A5F',
  warning: '#FF8A3D',
  onBrand: '#FFFFFF',
  onAccent: '#0B1B3B',

  // Glass (approximated for RN: translucent white, no native blur)
  glassBg: 'rgba(255,255,255,0.62)',
  glassBorder: 'rgba(255,255,255,0.7)',

  // --- Back-compat aliases for screens not yet re-skinned (editor/ring/game) ---
  background: '#F4F8FF',
  surface: '#FFFFFF',
  surfaceAlt: '#E8F1FF',
  border: '#CAD4E6',
  text: '#0B1B3B',
  textSecondary: '#5A6B8C',
  accentSoft: '#CFE0FF',
} as const;

/** Sky-wash app background gradient stops (top -> bottom). */
export const BgGradient = ['#F4F8FF', '#E8F1FF'] as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  h3: 20,
  h2: 26,
  h1: 34,
  display: 56,
  clock: 72,
  // Back-compat aliases
  xl: 22,
  xxl: 28,
  title: 40,
} as const;

export const FontFamily = {
  // Display — Fredoka
  display: 'Fredoka_600SemiBold',
  displayMedium: 'Fredoka_500Medium',
  displayBold: 'Fredoka_700Bold',
  // Body — Nunito
  body: 'Nunito_400Regular',
  bodyMedium: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
  bodyBlack: 'Nunito_800ExtraBold',
  // Back-compat aliases (editor/ring/game)
  regular: 'Nunito_400Regular',
  medium: 'Nunito_600SemiBold',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
} as const;

export const BorderRadius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 30,
  '2xl': 40,
  pill: 999,
  full: 999,
} as const;

/** Soft, floaty shadows (iOS shadow* + Android elevation). */
export const Shadow = {
  sm: {
    shadowColor: '#0B1B3B',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#0B1B3B',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  blue: {
    shadowColor: '#0063F3',
    shadowOpacity: 0.3,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const;
