/**
 * Alarm audio playback via expo-audio (expo-av was removed in SDK 55/56).
 * Uses the imperative createAudioPlayer API so it can be driven from
 * notification handlers outside of React components.
 */
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { getSoundById } from '@/constants/sounds';

let currentPlayer: AudioPlayer | null = null;
let previewPlayer: AudioPlayer | null = null;

/** Configure the audio session so the alarm plays even in silent mode / background. */
export async function initializeAudio(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });
  } catch (err) {
    console.error('initializeAudio failed:', err);
  }
}

/** Start looping the given bundled alarm sound. Stops any currently playing alarm first. */
export function playAlarmSound(soundId?: string | null): void {
  try {
    stopAlarmSound();
    const sound = getSoundById(soundId);
    const player = createAudioPlayer(sound.asset);
    player.loop = true;
    player.volume = 1.0;
    player.play();
    currentPlayer = player;
  } catch (err) {
    console.error('playAlarmSound failed:', err);
  }
}

export function stopAlarmSound(): void {
  if (currentPlayer) {
    try {
      currentPlayer.pause();
      currentPlayer.remove();
    } catch (err) {
      console.error('stopAlarmSound failed:', err);
    }
    currentPlayer = null;
  }
}

/** Play a sound once for previewing in the sound picker. */
export function previewSound(soundId: string): void {
  try {
    stopPreviewSound();
    const sound = getSoundById(soundId);
    const player = createAudioPlayer(sound.asset);
    player.loop = false;
    player.volume = 1.0;
    player.play();
    previewPlayer = player;
  } catch (err) {
    console.error('previewSound failed:', err);
  }
}

export function stopPreviewSound(): void {
  if (previewPlayer) {
    try {
      previewPlayer.pause();
      previewPlayer.remove();
    } catch (err) {
      console.error('stopPreviewSound failed:', err);
    }
    previewPlayer = null;
  }
}
