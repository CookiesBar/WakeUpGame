// Audio playback utilities
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import { t } from '../i18n';
import { CustomSound, generateId, saveCustomSound } from './storage';

// Bundled alarm sounds registry.
// `notificationSound` is the filename registered with the expo-notifications plugin
// (see app.json). Notification sounds must be .wav/.aiff/.caf and under 30 s or
// iOS silently plays the default alert instead; the name must also be a valid
// Android raw-resource name (lowercase, [a-z0-9_]).
export interface BundledSound {
    id: string;
    name: string;
    source: any;
    notificationSound: string;
}

export const BUNDLED_SOUNDS: BundledSound[] = [
    { id: 'fast-alarm', name: 'Fast Alarm', source: require('../assets/sounds/fast_alarm.wav'), notificationSound: 'fast_alarm.wav' },
    { id: 'slow-alarm', name: 'Slow Alarm', source: require('../assets/sounds/slow_alarm.wav'), notificationSound: 'slow_alarm.wav' },
];

// Default sound ID
export const DEFAULT_SOUND_ID = 'fast-alarm';

// Get sound source by ID (for bundled sounds) or URI (for custom sounds)
export const getSoundSource = (soundId?: string | null): any => {
    if (!soundId) {
        // Return default sound
        const defaultSound = BUNDLED_SOUNDS.find(s => s.id === DEFAULT_SOUND_ID);
        return defaultSound?.source;
    }

    // Check if it's a bundled sound ID
    const bundledSound = BUNDLED_SOUNDS.find(s => s.id === soundId);
    if (bundledSound) {
        return bundledSound.source;
    }

    // It's a custom sound URI
    return { uri: soundId };
};

// Display name for a bundled sound ID or a custom sound URI
export const getSoundName = (soundId?: string | null): string => {
    const id = soundId || DEFAULT_SOUND_ID;
    return BUNDLED_SOUNDS.some(s => s.id === id) ? t(`sounds.names.${id}`) : t('sounds.custom');
};

// The sounds screen hands its pick back to the alarm editor through here
// (navigating "back" with params would push a second, fresh editor instead).
let pickedSound: string | null = null;
export const setPickedSound = (soundId: string) => { pickedSound = soundId; };
export const takePickedSound = (): string | null => {
    const soundId = pickedSound;
    pickedSound = null;
    return soundId;
};

// One player shared by the ringing alarm and sound previews (expo-av was
// removed after SDK 54; createAudioPlayer works outside React components).
let currentPlayer: AudioPlayer | null = null;
let previewTimer: ReturnType<typeof setTimeout> | null = null;

/** Gradual volume: the alarm climbs from FADE_START to full over FADE_MS. */
const FADE_MS = 30_000;
const FADE_START = 0.15;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let fade = 1; // ceiling while fading in
let wanted = 1; // what the ring screen asked for
const apply = () => {
    if (currentPlayer) currentPlayer.volume = wanted * fade;
};

// Play even in silent mode and keep playing in the background
export const initializeAudio = async (): Promise<void> => {
    try {
        await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true });
    } catch (error) {
        console.error('Error initializing audio:', error);
    }
};

const play = (soundId: string | null | undefined, loop: boolean): void => {
    stopAlarmSound();
    const source = getSoundSource(soundId);
    if (!source) return;
    const player = createAudioPlayer(source);
    player.loop = loop;
    player.volume = 1.0;
    player.play();
    currentPlayer = player;
};

// Play alarm sound on loop (bundled sound ID or custom sound URI)
export const playAlarmSound = async (soundId?: string | null, gradual = false): Promise<void> => {
    try {
        play(soundId, true);
        if (!gradual) return;
        const startedAt = Date.now();
        fade = FADE_START;
        apply();
        fadeTimer = setInterval(() => {
            fade = Math.min(1, FADE_START + (1 - FADE_START) * ((Date.now() - startedAt) / FADE_MS));
            apply();
            if (fade >= 1 && fadeTimer) clearInterval(fadeTimer);
        }, 500);
    } catch (error) {
        console.error('Error playing alarm sound:', error);
    }
};

export const stopAlarmSound = async (): Promise<void> => {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = null;
    if (fadeTimer) clearInterval(fadeTimer);
    fadeTimer = null;
    fade = 1;
    wanted = 1;
    if (!currentPlayer) return;
    try {
        currentPlayer.pause();
        currentPlayer.remove();
    } catch (error) {
        console.error('Error stopping alarm sound:', error);
    }
    currentPlayer = null;
};

// 0–1. The ring screen fades the alarm as the user makes progress.
export const setAlarmVolume = (volume: number): void => {
    wanted = volume;
    apply();
};

// Preview a sound for 3 seconds
export const previewSound = async (soundId?: string | null): Promise<void> => {
    try {
        play(soundId, false);
        previewTimer = setTimeout(stopAlarmSound, 3000);
    } catch (error) {
        console.error('Error previewing sound:', error);
    }
};

// Pick custom sound file
export const pickCustomSound = async (): Promise<CustomSound | null> => {
    try {
        const result = await DocumentPicker.getDocumentAsync({
            type: 'audio/*',
            copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets.length > 0) {
            const file = result.assets[0];
            const customSound: CustomSound = {
                id: generateId(),
                name: file.name,
                uri: file.uri,
            };

            await saveCustomSound(customSound);
            return customSound;
        }

        return null;
    } catch (error) {
        console.error('Error picking custom sound:', error);
        return null;
    }
};
