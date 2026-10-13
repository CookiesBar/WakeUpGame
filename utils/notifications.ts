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
import { i18n } from '@/i18n';
import { isAlarmPlaying } from './sounds';
import { nextFire, planTriggers } from './schedule.ts';
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
/** "Still awake?" re-ring this long after the walk, unless the user taps it. */
export const WAKE_CHECK_DELAY_MS = 5 * 60 * 1000;

/** Rides along in every notification's data so the app can tell the two apart. */
export type NotifKind = 'alarm' | 'check';

interface AlarmNotifEntry {
  /** Ids of the guaranteed base triggers (weekly or one-time date). */
  base: string[];
  /** Ids of the follow-up burst notifications for the next occurrence. */
  burst: string[];
  /** Epoch ms of the occurrence the current burst is armed for. */
  burstAt?: number;
  /** Epoch ms the one-time base DATE trigger fires (one-time alarms only). */
  baseAt?: number;
  /** Ids of a pending "Still awake?" burst. */
  check?: string[];
  /** Epoch ms after which the base triggers should be rebuilt (a one-off change passed). */
  rebuildAt?: number;
}

type NotifMap = Record<string, AlarmNotifEntry>;

// The burst stays armed while the user walks (it's the backup if they kill the
// app), so keep it silent in the foreground while the in-app alarm is ringing.
Notifications.setNotificationHandler({
  handleNotification: async () => {
    const show = !isAlarmPlaying();
    return {
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show,
      shouldSetBadge: false,
    };
  },
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
          check: v.check,
          rebuildAt: v.rebuildAt,
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

function buildContent(
  alarm: Alarm,
  burstIndex: number,
  kind: NotifKind = 'alarm'
): Notifications.NotificationContentInput {
  const sound = getSoundById(alarm.soundId);
  // Locale is the one active when the alarm was saved / last re-armed.
  const check = kind === 'check';
  return {
    title: check ? i18n.t('wakeCheck.title') : alarm.label?.trim() || i18n.t('ring.defaultLabel'),
    body: check ? i18n.t('wakeCheck.body') : i18n.t('ring.notificationBody'),
    sound: sound.notificationSound,
    interruptionLevel: 'timeSensitive',
    data: {
      alarmId: alarm.id,
      label: alarm.label,
      time: alarm.time,
      soundId: alarm.soundId,
      burstIndex,
      kind,
    },
  };
}

/**
 * Schedule burst notifications BURST_INTERVAL_MS apart from `fireAt`. Alarms
 * start at index 1 (index 0 is the base trigger); a wake check starts at 0.
 */
async function scheduleBurst(
  alarm: Alarm,
  fireAt: Date,
  kind: NotifKind = 'alarm',
  first = 1
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = first; i < BURST_COUNT; i++) {
    const date = new Date(fireAt.getTime() + i * BURST_INTERVAL_MS);
    const id = await Notifications.scheduleNotificationAsync({
      content: buildContent(alarm, i, kind),
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
  const channelId = androidChannelId(getSoundById(alarm.soundId).id);
  const entry: AlarmNotifEntry = { base: [], burst: [] };
  const now = new Date();
  // Weekdays with a skip/move coming up get dated triggers instead of WEEKLY ones.
  const plan = planTriggers(alarm, now);

  for (const day of plan.weekly) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: day + 1, // expo: 1 = Sunday ... 7 = Saturday
        hour,
        minute,
        channelId,
      },
    });
    entry.base.push(id);
  }
  for (const date of plan.dates) {
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId },
    });
    entry.base.push(id);
  }
  if (alarm.days.length === 0) entry.baseAt = plan.dates[0]?.getTime();
  entry.rebuildAt = plan.rebuildAt;

  const fireAt = nextFire(alarm, now);
  if (fireAt) {
    entry.burst = await scheduleBurst(alarm, fireAt);
    entry.burstAt = fireAt.getTime();
  }

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
  if (entry) await cancelIds([...entry.base, ...entry.burst, ...(entry.check ?? [])]);
  delete map[alarmId];
  await writeNotifMap(map);
}

/** Cancel only the pending burst follow-ups (base triggers stay armed). */
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
 * Called once the user has finished the walk: silence the remaining burst, arm
 * the "Still awake?" check if enabled, and arm a fresh burst for the next
 * occurrence (repeating alarms only — a one-time alarm's base has already fired).
 */
export function dismissAlarm(alarm: Alarm): Promise<void> {
  return withMapLock(async () => {
    await cancelAlarmBurstUnlocked(alarm.id);
    if (alarm.wakeCheck) await armWakeCheck(alarm);
    if (!alarm.enabled || alarm.days.length === 0) return;
    await armBurst(alarm);
  });
}

async function armWakeCheck(alarm: Alarm): Promise<void> {
  const map = await readNotifMap();
  const entry = map[alarm.id] ?? { base: [], burst: [] };
  await cancelIds(entry.check ?? []);
  const fireAt = new Date(Date.now() + WAKE_CHECK_DELAY_MS);
  entry.check = await scheduleBurst(alarm, fireAt, 'check', 0);
  map[alarm.id] = entry;
  await writeNotifMap(map);
}

/** User tapped a "Still awake?" notification: they're up, silence the rest. */
export function cancelWakeCheck(alarmId: string): Promise<void> {
  return withMapLock(async () => {
    const map = await readNotifMap();
    const entry = map[alarmId];
    if (!entry?.check?.length) return;
    await cancelIds(entry.check);
    entry.check = [];
    await writeNotifMap(map);
  });
}

async function armBurst(alarm: Alarm): Promise<void> {
  const map = await readNotifMap();
  const entry = map[alarm.id];
  if (!entry) return; // never scheduled → nothing to follow up

  await cancelIds(entry.burst);
  const fireAt = nextFire(alarm, new Date());
  entry.burst = fireAt ? await scheduleBurst(alarm, fireAt) : [];
  entry.burstAt = fireAt?.getTime();
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

      // One-time alarm whose base already fired (or was skipped): nothing left to follow up.
      if (alarm.days.length === 0 && (entry.baseAt === undefined || entry.baseAt <= now)) {
        continue;
      }

      // A skip/move has passed or the dated run is ending: rebuild, unless it's ringing right now.
      const ringing =
        entry.burstAt !== undefined && entry.burstAt <= now && entry.burstAt + BURST_WINDOW_MS > now;
      if (entry.rebuildAt !== undefined && entry.rebuildAt <= now && !ringing) {
        await scheduleAlarmNotificationUnlocked(alarm);
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
