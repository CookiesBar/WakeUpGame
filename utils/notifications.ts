/**
 * Alarm notification scheduling (expo-notifications, SDK 56).
 *
 * A local notification never wakes the JS side while the screen is off, so the
 * only sound the user hears is the notification's own (≤30 s on iOS). To keep
 * ringing until the user reacts we schedule a *burst*:
 *
 *  - "base": the guaranteed trigger — one WEEKLY trigger per selected day for
 *    repeating alarms, or a single DATE trigger for one-time alarms.
 *  - "burst": BURST_COUNT - 1 follow-up DATE notifications spaced
 *    BURST_INTERVAL_MS apart, scheduled only for the *next* occurrence. They are
 *    re-armed on app foreground / after the alarm is dismissed. Limiting bursts
 *    to the next occurrence keeps us well under iOS's 64 pending-notification cap
 *    (an everyday alarm costs 7 + BURST_COUNT - 1 slots).
 *
 * Scheduled ids are tracked per alarm so they can be cancelled on
 * edit/delete/toggle/dismiss.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { BUNDLED_SOUNDS, getSoundById } from '@/constants/sounds';
import type { Alarm } from './storage';

const NOTIF_MAP_KEY = '@wakeup_notif_ids';
/**
 * Android plays the *channel's* sound, not the notification's, and a channel's
 * settings are frozen once created. So: one channel per bundled sound, and a
 * version suffix to leave the legacy `alarms` channel (default sound) behind.
 */
const ANDROID_CHANNEL_PREFIX = 'alarms-v2-';
const androidChannelId = (soundId: string) => `${ANDROID_CHANNEL_PREFIX}${soundId}`;

/** Total notifications per ring (base + follow-ups). 8 × 30 s ≈ 4 min of ringing. */
export const BURST_COUNT = 8;
export const BURST_INTERVAL_MS = 30 * 1000;
/** How long one ring lasts end-to-end; used to dedupe and to detect an in-progress burst. */
export const BURST_WINDOW_MS = BURST_COUNT * BURST_INTERVAL_MS;

interface AlarmNotifEntry {
  /** Ids of the guaranteed base triggers (weekly or one-time date). */
  base: string[];
  /** Ids of the follow-up burst notifications for the next occurrence. */
  burst: string[];
  /** Epoch ms of the occurrence the current burst is armed for. */
  burstAt?: number;
  /** Epoch ms the one-time base DATE trigger fires (one-time alarms only). */
  baseAt?: number;
}

type NotifMap = Record<string, AlarmNotifEntry>;

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
    await Notifications.deleteNotificationChannelAsync('alarms').catch(() => undefined);
    for (const sound of BUNDLED_SOUNDS) {
      await Notifications.setNotificationChannelAsync(androidChannelId(sound.id), {
        name: `Alarm – ${sound.name}`,
        importance: Notifications.AndroidImportance.MAX,
        sound: sound.notificationSound,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
        vibrationPattern: [0, 250, 250, 250],
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
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

/** Next time this alarm fires: soonest selected weekday at HH:MM, or tomorrow-ish for one-time. */
function nextOccurrence(alarm: Alarm): Date {
  const [hour, minute] = alarm.time.split(':').map(Number);
  if (alarm.days.length === 0) return nextDateFor(hour, minute);

  const now = new Date();
  let best: Date | null = null;
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date();
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    if (candidate <= now) continue;
    if (!alarm.days.includes(candidate.getDay() as Alarm['days'][number])) continue;
    if (!best || candidate < best) best = candidate;
  }
  return best ?? nextDateFor(hour, minute);
}

async function readNotifMap(): Promise<NotifMap> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const map: NotifMap = {};
    for (const [alarmId, value] of Object.entries(parsed)) {
      // Legacy format was a flat string[] of base ids.
      if (Array.isArray(value)) {
        map[alarmId] = { base: value as string[], burst: [] };
      } else if (value && typeof value === 'object') {
        const v = value as Partial<AlarmNotifEntry>;
        map[alarmId] = {
          base: v.base ?? [],
          burst: v.burst ?? [],
          burstAt: v.burstAt,
          baseAt: v.baseAt,
        };
      }
    }
    return map;
  } catch {
    return {};
  }
}

async function writeNotifMap(map: NotifMap): Promise<void> {
  await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(map));
}

/**
 * Serialize read-modify-write cycles on the notif map. On launch a foreground
 * re-arm and a notification-tap cancel can overlap; without this one would
 * clobber the other's ids and leave un-cancellable notifications behind.
 */
let mapLock: Promise<unknown> = Promise.resolve();
function withMapLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = mapLock.then(fn, fn);
  mapLock = run.catch(() => undefined);
  return run;
}

async function cancelIds(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)
    )
  );
}

function buildContent(alarm: Alarm, burstIndex: number): Notifications.NotificationContentInput {
  const sound = getSoundById(alarm.soundId);
  return {
    title: alarm.label?.trim() || 'Wake Up!',
    body: 'Tap to start your wake-up challenge',
    sound: sound.notificationSound,
    interruptionLevel: 'timeSensitive',
    data: {
      alarmId: alarm.id,
      label: alarm.label,
      time: alarm.time,
      soundId: alarm.soundId,
      burstIndex,
    },
  };
}

/** Schedule the follow-up burst for `fireAt`. Returns the scheduled ids. */
async function scheduleBurst(alarm: Alarm, fireAt: Date): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 1; i < BURST_COUNT; i++) {
    const date = new Date(fireAt.getTime() + i * BURST_INTERVAL_MS);
    const id = await Notifications.scheduleNotificationAsync({
      content: buildContent(alarm, i),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: androidChannelId(getSoundById(alarm.soundId).id),
      },
    });
    ids.push(id);
  }
  return ids;
}

/** (Re)schedule base triggers + the burst for the next occurrence. */
export function scheduleAlarmNotification(alarm: Alarm): Promise<void> {
  return withMapLock(() => scheduleAlarmNotificationUnlocked(alarm));
}

async function scheduleAlarmNotificationUnlocked(alarm: Alarm): Promise<void> {
  await cancelAlarmNotificationUnlocked(alarm.id);

  const [hour, minute] = alarm.time.split(':').map(Number);
  const content = buildContent(alarm, 0);
  const entry: AlarmNotifEntry = { base: [], burst: [] };

  if (alarm.days.length === 0) {
    const date = nextDateFor(hour, minute);
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: androidChannelId(getSoundById(alarm.soundId).id),
      },
    });
    entry.base.push(id);
    entry.baseAt = date.getTime();
  } else {
    for (const day of alarm.days) {
      const id = await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1, // expo: 1 = Sunday ... 7 = Saturday
          hour,
          minute,
          channelId: androidChannelId(getSoundById(alarm.soundId).id),
        },
      });
      entry.base.push(id);
    }
  }

  const fireAt = nextOccurrence(alarm);
  entry.burst = await scheduleBurst(alarm, fireAt);
  entry.burstAt = fireAt.getTime();

  const map = await readNotifMap();
  map[alarm.id] = entry;
  await writeNotifMap(map);
}

/** Cancel everything (base + burst) for an alarm. */
export function cancelAlarmNotification(alarmId: string): Promise<void> {
  return withMapLock(() => cancelAlarmNotificationUnlocked(alarmId));
}

async function cancelAlarmNotificationUnlocked(alarmId: string): Promise<void> {
  const map = await readNotifMap();
  const entry = map[alarmId];
  if (entry) await cancelIds([...entry.base, ...entry.burst]);
  delete map[alarmId];
  await writeNotifMap(map);
}

/** Cancel only the pending burst follow-ups (base triggers stay armed). */
export function cancelAlarmBurst(alarmId: string): Promise<void> {
  return withMapLock(() => cancelAlarmBurstUnlocked(alarmId));
}

async function cancelAlarmBurstUnlocked(alarmId: string): Promise<void> {
  const map = await readNotifMap();
  const entry = map[alarmId];
  if (!entry) return;
  await cancelIds(entry.burst);
  entry.burst = [];
  entry.burstAt = undefined;
  await writeNotifMap(map);
}

/**
 * Called once the user has dealt with a ringing alarm: silence the remaining
 * burst and arm a fresh one for the next occurrence (repeating alarms only —
 * a one-time alarm's base has already fired).
 */
export function dismissAlarm(alarm: Alarm): Promise<void> {
  return withMapLock(async () => {
    await cancelAlarmBurstUnlocked(alarm.id);
    if (!alarm.enabled || alarm.days.length === 0) return;
    await armBurst(alarm);
  });
}

async function armBurst(alarm: Alarm): Promise<void> {
  const map = await readNotifMap();
  const entry = map[alarm.id];
  if (!entry) return; // never scheduled → nothing to follow up

  await cancelIds(entry.burst);
  const fireAt = nextOccurrence(alarm);
  entry.burst = await scheduleBurst(alarm, fireAt);
  entry.burstAt = fireAt.getTime();
  await writeNotifMap(map);
}

/**
 * Make sure every enabled alarm has a burst armed for its next occurrence.
 * Cheap and idempotent — call on app start and whenever the app comes to the
 * foreground. Leaves an in-progress or already-correct burst untouched.
 */
export function rearmAlarmBursts(alarms: Alarm[]): Promise<void> {
  return withMapLock(async () => {
    const map = await readNotifMap();
    const now = Date.now();

    for (const alarm of alarms) {
      if (!alarm.enabled) continue;
      const entry = map[alarm.id];
      if (!entry) continue;

      // One-time alarm whose base already fired: nothing left to follow up.
      if (alarm.days.length === 0 && entry.baseAt !== undefined && entry.baseAt <= now) {
        continue;
      }

      const burstAt = entry.burstAt;
      const stillValid =
        burstAt !== undefined &&
        entry.burst.length > 0 &&
        // upcoming, or currently ringing (don't silence it from under the user)
        burstAt + BURST_WINDOW_MS > now;
      if (stillValid) continue;

      await armBurst(alarm);
    }
  });
}
