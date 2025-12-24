// Storage utilities for alarm data persistence
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALARMS_KEY = '@wake_up_game_alarms';
const CUSTOM_SOUNDS_KEY = '@wake_up_game_custom_sounds';

export interface Alarm {
    id: string;
    time: string; // HH:MM format
    label: string;
    enabled: boolean;
    days: boolean[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
    soundUri: string | null; // null = default sound
    createdAt: number;
}

export interface CustomSound {
    id: string;
    name: string;
    uri: string;
}

// Generate unique ID
export const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Alarm CRUD operations
export const getAlarms = async (): Promise<Alarm[]> => {
    try {
        const json = await AsyncStorage.getItem(ALARMS_KEY);
        return json ? JSON.parse(json) : [];
    } catch (error) {
        console.error('Error reading alarms:', error);
        return [];
    }
};

export const saveAlarm = async (alarm: Alarm): Promise<void> => {
    try {
        const alarms = await getAlarms();
        const index = alarms.findIndex(a => a.id === alarm.id);
        if (index >= 0) {
            alarms[index] = alarm;
        } else {
            alarms.push(alarm);
        }
        await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
    } catch (error) {
        console.error('Error saving alarm:', error);
        throw error;
    }
};

export const deleteAlarm = async (id: string): Promise<void> => {
    try {
        const alarms = await getAlarms();
        const filtered = alarms.filter(a => a.id !== id);
        await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Error deleting alarm:', error);
        throw error;
    }
};

export const toggleAlarm = async (id: string): Promise<Alarm | null> => {
    try {
        const alarms = await getAlarms();
        const alarm = alarms.find(a => a.id === id);
        if (alarm) {
            alarm.enabled = !alarm.enabled;
            await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
            return alarm;
        }
        return null;
    } catch (error) {
        console.error('Error toggling alarm:', error);
        throw error;
    }
};

// Custom sounds operations
export const getCustomSounds = async (): Promise<CustomSound[]> => {
    try {
        const json = await AsyncStorage.getItem(CUSTOM_SOUNDS_KEY);
        return json ? JSON.parse(json) : [];
    } catch (error) {
        console.error('Error reading custom sounds:', error);
        return [];
    }
};

export const saveCustomSound = async (sound: CustomSound): Promise<void> => {
    try {
        const sounds = await getCustomSounds();
        sounds.push(sound);
        await AsyncStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(sounds));
    } catch (error) {
        console.error('Error saving custom sound:', error);
        throw error;
    }
};

export const deleteCustomSound = async (id: string): Promise<void> => {
    try {
        const sounds = await getCustomSounds();
        const filtered = sounds.filter(s => s.id !== id);
        await AsyncStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Error deleting custom sound:', error);
        throw error;
    }
};
