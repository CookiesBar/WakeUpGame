// Storage utilities for alarm data persistence
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MathLevel } from './math';
import type { WakeLog } from './stats';

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
    wakeCheck?: boolean; // "Still awake?" check; undefined = on (alarms from before 2.0.2)
    steps?: number; // walk goal; undefined = DEFAULT_STEPS
    mathLevel?: MathLevel; // undefined = DEFAULT_MATH_LEVEL
    gradualVolume?: boolean; // in-app sound fades in over 30 s; undefined = off
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
        // Medium math (level 1, before v3) became Easy.
        return json ? (JSON.parse(json) as Alarm[]).map(a => ((a.mathLevel as number) === 1 ? { ...a, mathLevel: 0 } : a)) : [];
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

// Pending "Still awake?" checks: alarmId → epoch ms the check starts ringing
const WAKE_CHECKS_KEY = '@wake_up_game_wake_checks';

export const getWakeChecks = async (): Promise<Record<string, number>> => {
    try {
        const json = await AsyncStorage.getItem(WAKE_CHECKS_KEY);
        return json ? JSON.parse(json) : {};
    } catch (error) {
        console.error('Error reading wake checks:', error);
        return {};
    }
};

export const saveWakeChecks = (checks: Record<string, number>): Promise<void> =>
    AsyncStorage.setItem(WAKE_CHECKS_KEY, JSON.stringify(checks));

// Armed "ring again" after a check: alarmId → epoch ms it stops ringing. Kept until the game starts, so a
// missed check still owes its game after the app is killed.
const RING_AGAIN_KEY = '@wake_up_game_ring_again';

export const getRingAgain = async (): Promise<Record<string, number>> => {
    try {
        const json = await AsyncStorage.getItem(RING_AGAIN_KEY);
        return json ? JSON.parse(json) : {};
    } catch (error) {
        console.error('Error reading ring-again:', error);
        return {};
    }
};

export const saveRingAgain = (entries: Record<string, number>): Promise<void> =>
    AsyncStorage.setItem(RING_AGAIN_KEY, JSON.stringify(entries));

// Finished wake-ups (epoch ms), for the streak on the ring screen
const WAKE_LOG_KEY = '@wake_up_game_wake_log';
const WAKE_LOG_MAX = 400;

export const getWakeLog = async (): Promise<WakeLog> => {
    try {
        const parsed = JSON.parse((await AsyncStorage.getItem(WAKE_LOG_KEY)) ?? '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Error reading wake log:', error);
        return [];
    }
};

export const logWake = async (at: number): Promise<WakeLog> => {
    const log = [...(await getWakeLog()), at].slice(-WAKE_LOG_MAX);
    await AsyncStorage.setItem(WAKE_LOG_KEY, JSON.stringify(log));
    return log;
};
