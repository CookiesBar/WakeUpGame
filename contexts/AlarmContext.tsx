// Alarm Context for state management
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { clearPendingDemoAlarm, getPendingDemoAlarm } from '../components/OnboardingAlarmDemo';
import {
    cancelAlarmNotification,
    requestNotificationPermissions,
    scheduleAlarmNotification,
} from '../utils/notifications';
import {
    Alarm,
    CustomSound,
    deleteAlarm as deleteAlarmStorage,
    generateId,
    getAlarms,
    getCustomSounds,
    saveAlarm,
    toggleAlarm as toggleAlarmStorage,
} from '../utils/storage';

interface AlarmContextType {
    alarms: Alarm[];
    customSounds: CustomSound[];
    loading: boolean;
    addAlarm: (alarm: Omit<Alarm, 'id' | 'createdAt'>) => Promise<Alarm>;
    updateAlarm: (alarm: Alarm) => Promise<void>;
    removeAlarm: (id: string) => Promise<void>;
    toggleAlarmEnabled: (id: string) => Promise<void>;
    refreshAlarms: () => Promise<void>;
    refreshCustomSounds: () => Promise<void>;
}

const AlarmContext = createContext<AlarmContextType | undefined>(undefined);

export const AlarmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [alarms, setAlarms] = useState<Alarm[]>([]);
    const [customSounds, setCustomSounds] = useState<CustomSound[]>([]);
    const [loading, setLoading] = useState(true);

    // Load alarms and request permissions on mount
    useEffect(() => {
        const init = async () => {
            await requestNotificationPermissions();
            await refreshAlarms();
            await refreshCustomSounds();

            // Check if there's a pending demo alarm to create
            const shouldCreatePendingAlarm = await AsyncStorage.getItem('@create_pending_alarm');
            if (shouldCreatePendingAlarm === 'true') {
                const pendingAlarm = await getPendingDemoAlarm();
                if (pendingAlarm) {
                    console.log('Creating alarm from demo settings:', pendingAlarm);
                    // Convert hours and minutes to HH:MM format
                    const time = `${String(pendingAlarm.hours).padStart(2, '0')}:${String(pendingAlarm.minutes).padStart(2, '0')}`;

                    const newAlarm: Alarm = {
                        id: generateId(),
                        time,
                        label: pendingAlarm.label,
                        enabled: true,
                        days: pendingAlarm.days,
                        soundUri: null,
                        createdAt: Date.now(),
                    };

                    await saveAlarm(newAlarm);
                    await scheduleAlarmNotification(newAlarm);
                    await clearPendingDemoAlarm();
                    await AsyncStorage.removeItem('@create_pending_alarm');
                    await refreshAlarms();
                    console.log('Demo alarm created successfully:', newAlarm);
                }
            }

            setLoading(false);
        };
        init();
    }, []);

    const refreshAlarms = useCallback(async () => {
        const loadedAlarms = await getAlarms();
        // Sort by time
        loadedAlarms.sort((a, b) => a.time.localeCompare(b.time));
        setAlarms(loadedAlarms);
    }, []);

    const refreshCustomSounds = useCallback(async () => {
        const sounds = await getCustomSounds();
        setCustomSounds(sounds);
    }, []);

    const addAlarm = useCallback(async (alarmData: Omit<Alarm, 'id' | 'createdAt'>): Promise<Alarm> => {
        const newAlarm: Alarm = {
            ...alarmData,
            id: generateId(),
            createdAt: Date.now(),
        };
        await saveAlarm(newAlarm);
        if (newAlarm.enabled) {
            await scheduleAlarmNotification(newAlarm);
        }
        await refreshAlarms();
        return newAlarm;
    }, [refreshAlarms]);

    const updateAlarm = useCallback(async (alarm: Alarm): Promise<void> => {
        await saveAlarm(alarm);
        if (alarm.enabled) {
            await scheduleAlarmNotification(alarm);
        } else {
            await cancelAlarmNotification(alarm.id);
        }
        await refreshAlarms();
    }, [refreshAlarms]);

    const removeAlarm = useCallback(async (id: string): Promise<void> => {
        await cancelAlarmNotification(id);
        await deleteAlarmStorage(id);
        await refreshAlarms();
    }, [refreshAlarms]);

    const toggleAlarmEnabled = useCallback(async (id: string): Promise<void> => {
        const alarm = await toggleAlarmStorage(id);
        if (alarm) {
            if (alarm.enabled) {
                await scheduleAlarmNotification(alarm);
            } else {
                await cancelAlarmNotification(alarm.id);
            }
        }
        await refreshAlarms();
    }, [refreshAlarms]);

    return (
        <AlarmContext.Provider
            value={{
                alarms,
                customSounds,
                loading,
                addAlarm,
                updateAlarm,
                removeAlarm,
                toggleAlarmEnabled,
                refreshAlarms,
                refreshCustomSounds,
            }}
        >
            {children}
        </AlarmContext.Provider>
    );
};

export const useAlarms = (): AlarmContextType => {
    const context = useContext(AlarmContext);
    if (!context) {
        throw new Error('useAlarms must be used within an AlarmProvider');
    }
    return context;
};
