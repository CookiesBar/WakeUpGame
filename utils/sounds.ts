// Audio playback utilities
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { CustomSound, generateId, saveCustomSound } from './storage';

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

// Play alarm sound
export const playAlarmSound = async (uri?: string | null): Promise<void> => {
    try {
        // Stop any currently playing sound
        await stopAlarmSound();

        let soundSource: any;
        if (uri) {
            soundSource = { uri };
        } else {
            // Try to load default sound, if not available use system default
            try {
                soundSource = require('../assets/sounds/alarm-default.mp3');
            } catch {
                // Default sound not found, audio will still work with custom sounds
                console.log('Default sound not found, using custom sound only');
                return;
            }
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

// Preview a sound
export const previewSound = async (uri?: string | null): Promise<void> => {
    try {
        await stopAlarmSound();

        let soundSource: any;
        if (uri) {
            soundSource = { uri };
        } else {
            try {
                soundSource = require('../assets/sounds/alarm-default.mp3');
            } catch {
                console.log('Default sound not found');
                return;
            }
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
