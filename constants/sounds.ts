/**
 * Bundled alarm sounds. `asset` is used for in-app playback (expo-audio);
 * `notificationSound` is the filename registered by the expo-notifications plugin
 * (see app.json) and used for the scheduled notification's sound on iOS.
 */
export interface BundledSound {
  id: string;
  name: string;
  asset: number;
  notificationSound: string;
}

export const BUNDLED_SOUNDS: BundledSound[] = [
  {
    id: 'fast-alarm',
    name: 'Fast Alarm',
    asset: require('../assets/sounds/Fast Alarm.mp3'),
    notificationSound: 'Fast Alarm.mp3',
  },
  {
    id: 'slow-alarm',
    name: 'Slow Alarm',
    asset: require('../assets/sounds/Slow Alarm.mp3'),
    notificationSound: 'Slow Alarm.mp3',
  },
  {
    id: 'beige-sparkle',
    name: 'Beige Sparkle',
    asset: require('../assets/sounds/Beige Sparkle .mp3'),
    notificationSound: 'Beige Sparkle .mp3',
  },
  {
    id: 'coffee-run',
    name: 'Coffee Run',
    asset: require('../assets/sounds/Coffee Run.mp3'),
    notificationSound: 'Coffee Run.mp3',
  },
  {
    id: 'office-water',
    name: 'Office Water',
    asset: require('../assets/sounds/Office Water.mp3'),
    notificationSound: 'Office Water.mp3',
  },
  {
    id: 'whimsical',
    name: 'Whimsical',
    asset: require('../assets/sounds/Wimsicle.mp3'),
    notificationSound: 'Wimsicle.mp3',
  },
];

export const DEFAULT_SOUND_ID = 'fast-alarm';

export function getSoundById(id: string | null | undefined): BundledSound {
  return BUNDLED_SOUNDS.find((s) => s.id === id) ?? BUNDLED_SOUNDS[0];
}
