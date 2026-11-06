/**
 * v3 white look: Lazy Leo's white surface system with Wakey on top (canvas page "v3 · White").
 * No shadows: depth is Paper on Mist plus one hairline. Radii 6/16/24/pill, gutter 20, 4 pt grid.
 * Font stays Plus Jakarta Sans (PopFont).
 */
import { Easing } from 'react-native-reanimated';

export { PopFont as WFont } from '@/constants/pop';

export const W = {
  mist: '#F3F5F8', // app ground
  paper: '#FFFFFF', // cards and rows
  hair: '#E4E8EE', // separators, tracks, off switches
  ink: '#0B0D10', // text
  cta: '#0063F3', // every main button (CtaButton), the same blue as the onboarding Cta
  graphite: '#5A6472', // secondary text (5.5:1 on Mist)
  blue: '#2D6CE7', // Wakey Blue: switches, selected days, progress
  blueText: '#1F5AD6', // blue text on Mist (5.51:1)
  blueSoft: '#E6EEFF',
  sun: '#FFB020', // streak only
  sunSoft: '#FFF4DC',
  sunText: '#7A5200',
  dim: '#8A93A0', // off-alarm time (large numerals only)
  chev: '#B4BBC5',
  red: '#D92D20',
} as const;

/** Things that open or arrive. */
export const ARRIVE = Easing.bezier(0.23, 1, 0.32, 1);
/** Screen to screen in the wake-up flow: the next one fades in on top. */
export const FADE_MS = 250;
