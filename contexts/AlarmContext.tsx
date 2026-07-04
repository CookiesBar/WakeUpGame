import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  cancelAlarmNotification,
  requestNotificationPermissions,
  scheduleAlarmNotification,
} from '@/utils/notifications';
import {
  Alarm,
  deleteAlarm as deleteAlarmStorage,
  generateId,
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

  return (
    <AlarmContext.Provider
      value={{
        alarms,
        loading,
        addAlarm,
        updateAlarm,
        removeAlarm,
        toggleAlarmEnabled,
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
