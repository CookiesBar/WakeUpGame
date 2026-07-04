/**
 * Alarm notification scheduling (expo-notifications, SDK 56).
 * One-time alarms use a DATE trigger at the next occurrence; repeating alarms
 * use one WEEKLY trigger per selected day. Scheduled ids are tracked per alarm
 * so they can be cancelled on edit/delete/toggle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSoundById } from '@/constants/sounds';
import type { Alarm } from './storage';

const NOTIF_MAP_KEY = '@wakeup_notif_ids';
const ANDROID_CHANNEL_ID = 'alarms';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Alarms',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      bypassDnd: true,
    });
  }

  const settings = await Notifications.getPermissionsAsync();
  let granted =
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted) {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    granted = req.granted;
  }
  return granted;
}

function nextDateFor(hour: number, minute: number): Date {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

async function readNotifMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

async function writeNotifMap(map: Record<string, string[]>): Promise<void> {
  await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(map));
}

export async function scheduleAlarmNotification(alarm: Alarm): Promise<void> {
  await cancelAlarmNotification(alarm.id);

  const sound = getSoundById(alarm.soundId);
  const [hour, minute] = alarm.time.split(':').map(Number);

  const content: Notifications.NotificationContentInput = {
    title: alarm.label?.trim() || 'Wake Up!',
    body: 'Tap to start your wake-up challenge',
    sound: sound.notificationSound,
    interruptionLevel: 'timeSensitive',
    data: {
      alarmId: alarm.id,
      label: alarm.label,
      time: alarm.time,
      soundId: alarm.soundId,
    },
  };

  const ids: string[] = [];

  if (alarm.days.length === 0) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextDateFor(hour, minute),
        channelId: ANDROID_CHANNEL_ID,
      },
    });
    ids.push(id);
  } else {
    for (const day of alarm.days) {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1, // expo: 1 = Sunday ... 7 = Saturday
          hour,
          minute,
          channelId: ANDROID_CHANNEL_ID,
        },
      });
      ids.push(id);
    }
  }

  const map = await readNotifMap();
  map[alarm.id] = ids;
  await writeNotifMap(map);
}

export async function cancelAlarmNotification(alarmId: string): Promise<void> {
  const map = await readNotifMap();
  const ids = map[alarmId] ?? [];
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)
    )
  );
  delete map[alarmId];
  await writeNotifMap(map);
}
