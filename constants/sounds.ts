/**
 * Bundled alarm sounds. `asset` is used for in-app playback (expo-audio);
 * `notificationSound` is the filename registered by the expo-notifications plugin
 * (see app.json) and used for the scheduled notification's sound.
 *
 * Notification sound files must be .wav/.aiff/.caf and under 30 s, otherwise
 * iOS silently falls back to the default alert sound.
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
    asset: require('../assets/sounds/fast_alarm.wav'),
    notificationSound: 'fast_alarm.wav',
  },
  {
    id: 'slow-alarm',
    name: 'Slow Alarm',
    asset: require('../assets/sounds/slow_alarm.wav'),
    notificationSound: 'slow_alarm.wav',
  },
];

export const DEFAULT_SOUND_ID = 'fast-alarm';

export function getSoundById(id: string | null | undefined): BundledSound {
  return BUNDLED_SOUNDS.find((s) => s.id === id) ?? BUNDLED_SOUNDS[0];
}
