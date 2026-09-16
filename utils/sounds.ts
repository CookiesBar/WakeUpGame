// Audio playback utilities
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
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

// Get sound name by ID or URI
export const getSoundName = (soundId?: string | null): string => {
    if (!soundId) {
        const defaultSound = BUNDLED_SOUNDS.find(s => s.id === DEFAULT_SOUND_ID);
        return defaultSound?.name || 'Default';
    }

    const bundledSound = BUNDLED_SOUNDS.find(s => s.id === soundId);
    if (bundledSound) {
        return bundledSound.name;
    }

    // Custom sound - return a generic name or extract from URI
    return 'Custom';
};

let currentSound: Audio.Sound | null = null;

// Initialize audio mode for background playback
export const initializeAudio = async (): Promise<void> => {
    try {
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            staysActiveInBackground: true,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: false,
            playThroughEarpieceAndroid: false,
        });
    } catch (error) {
        console.error('Error initializing audio:', error);
    }
};

// Play alarm sound (accepts soundId for bundled sounds or URI for custom sounds)
export const playAlarmSound = async (soundId?: string | null): Promise<void> => {
    try {
        // Stop any currently playing sound
        await stopAlarmSound();

        const soundSource = getSoundSource(soundId);
        if (!soundSource) {
            console.log('No sound source found');
            return;
        }

        const { sound } = await Audio.Sound.createAsync(soundSource, {
            isLooping: true,
            volume: 1.0,
        });

        currentSound = sound;
        await sound.playAsync();
    } catch (error) {
        console.error('Error playing alarm sound:', error);
    }
};

// Stop alarm sound
export const stopAlarmSound = async (): Promise<void> => {
    try {
        if (currentSound) {
            await currentSound.stopAsync();
            await currentSound.unloadAsync();
            currentSound = null;
        }
    } catch (error) {
        console.error('Error stopping alarm sound:', error);
    }
};

// Preview a sound (accepts soundId for bundled sounds or URI for custom sounds)
export const previewSound = async (soundId?: string | null): Promise<void> => {
    try {
        await stopAlarmSound();

        const soundSource = getSoundSource(soundId);
        if (!soundSource) {
            console.log('No sound source found');
            return;
        }

        const { sound } = await Audio.Sound.createAsync(soundSource, {
            volume: 1.0,
        });

        currentSound = sound;
        await sound.playAsync();

        // Stop after 3 seconds preview
        setTimeout(async () => {
            await stopAlarmSound();
        }, 3000);
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
