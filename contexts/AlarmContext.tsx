import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import {
  cancelAlarmNotification,
  dismissAlarm as dismissAlarmNotification,
  rearmAlarmBursts,
  requestNotificationPermissions,
  scheduleAlarmNotification,
} from '@/utils/notifications';
import {
  Alarm,
  deleteAlarm as deleteAlarmStorage,
  generateId,
  getAlarm,
  getAlarms,
  saveAlarm,
  toggleAlarm as toggleAlarmStorage,
} from '@/utils/storage';

interface AlarmContextValue {
  alarms: Alarm[];
  loading: boolean;
  addAlarm: (data: Omit<Alarm, 'id' | 'createdAt'>) => Promise<Alarm>;
  updateAlarm: (alarm: Alarm) => Promise<void>;
  removeAlarm: (id: string) => Promise<void>;
  toggleAlarmEnabled: (id: string) => Promise<void>;
  /** User finished the wake-up challenge: silence the burst, arm the next one. */
  dismissAlarm: (id: string) => Promise<void>;
  refreshAlarms: () => Promise<void>;
}

const AlarmContext = createContext<AlarmContextValue | undefined>(undefined);

export const AlarmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshAlarms = useCallback(async () => {
    const loaded = await getAlarms();
    loaded.sort((a, b) => a.time.localeCompare(b.time));
    setAlarms(loaded);
  }, []);

  useEffect(() => {
    (async () => {
      await requestNotificationPermissions();
      await refreshAlarms();
      setLoading(false);
    })();
  }, [refreshAlarms]);

  // Bursts are only armed for the next occurrence, so top them up on launch
  // and every time the app returns to the foreground.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const rearm = () => {
      getAlarms()
        .then(rearmAlarmBursts)
        .catch((err) => console.error('rearmAlarmBursts failed:', err));
    };
    rearm();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') rearm();
    });
    return () => sub.remove();
  }, []);

  const addAlarm = useCallback(
    async (data: Omit<Alarm, 'id' | 'createdAt'>): Promise<Alarm> => {
      const alarm: Alarm = { ...data, id: generateId(), createdAt: Date.now() };
      await saveAlarm(alarm);
      if (alarm.enabled) await scheduleAlarmNotification(alarm);
      await refreshAlarms();
      return alarm;
    },
    [refreshAlarms]
  );

  const updateAlarm = useCallback(
    async (alarm: Alarm): Promise<void> => {
      await saveAlarm(alarm);
      if (alarm.enabled) {
        await scheduleAlarmNotification(alarm);
      } else {
        await cancelAlarmNotification(alarm.id);
      }
      await refreshAlarms();
    },
    [refreshAlarms]
  );

  const removeAlarm = useCallback(
    async (id: string): Promise<void> => {
      await cancelAlarmNotification(id);
      await deleteAlarmStorage(id);
      await refreshAlarms();
    },
    [refreshAlarms]
  );

  const toggleAlarmEnabled = useCallback(
    async (id: string): Promise<void> => {
      const alarm = await toggleAlarmStorage(id);
      if (alarm) {
        if (alarm.enabled) {
          await scheduleAlarmNotification(alarm);
        } else {
          await cancelAlarmNotification(alarm.id);
        }
      }
      await refreshAlarms();
    },
    [refreshAlarms]
  );

  const dismissAlarm = useCallback(async (id: string): Promise<void> => {
    const alarm = await getAlarm(id);
    if (alarm) await dismissAlarmNotification(alarm);
  }, []);

  return (
    <AlarmContext.Provider
      value={{
        alarms,
        loading,
        addAlarm,
        updateAlarm,
        removeAlarm,
        toggleAlarmEnabled,
        dismissAlarm,
        refreshAlarms,
      }}
    >
      {children}
    </AlarmContext.Provider>
  );
};

export function useAlarms(): AlarmContextValue {
  const ctx = useContext(AlarmContext);
  if (!ctx) throw new Error('useAlarms must be used within an AlarmProvider');
  return ctx;
}
