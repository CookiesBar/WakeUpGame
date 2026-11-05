// Notification utilities for alarm scheduling
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { strings, t } from '../i18n';
import { alarmKit } from '../modules/wakey-alarm';
import { alarmKitId } from './alarmKitId';
import { BUNDLED_SOUNDS, DEFAULT_SOUND_ID } from './sounds';
import { Alarm, getAlarms, getWakeChecks, saveAlarm, saveWakeChecks } from './storage';
import { harder, WAKE_CHECK_DELAY_MS, wakeCheckOutcome } from './wakeCheck';

// A local notification can't wake the app while the screen is off, so the only
// sound the user hears is the notification's own (≤30 s on iOS). Schedule a
// burst of backup notifications so the alarm keeps ringing until it's tapped.
// 8 × 30 s ≈ 4 minutes of ringing.
export const BACKUP_NOTIFICATION_COUNT = 8;
export const BACKUP_NOTIFICATION_INTERVAL_MS = 30 * 1000;
export const BACKUP_WINDOW_MS = BACKUP_NOTIFICATION_COUNT * BACKUP_NOTIFICATION_INTERVAL_MS;

// iOS keeps only the 64 soonest pending notifications and silently drops the
// rest, so with 8+ alarms the farthest one never rang. Share them out evenly,
// keeping one full burst free for a "Still awake?" check.
// ponytail: room for one pending check; two at once (games < 5 min apart) can still overflow.
const IOS_PENDING_LIMIT = 64;
const burstSize = (enabledAlarms: number) =>
    Math.max(1, Math.min(BACKUP_NOTIFICATION_COUNT, Math.floor((IOS_PENDING_LIMIT - BACKUP_NOTIFICATION_COUNT) / enabledAlarms)));

// Android plays the *channel's* sound (not the notification's) and a channel's
// settings are frozen once created — so one channel per bundled sound, under a
// new id prefix so the legacy 'alarms' channel (default sound) is left behind.
// Expo Go has no bundled notification sounds (or AlarmKit): use the system sound there.
const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const notificationSound = (file: string) => (IN_EXPO_GO ? 'default' : file);

const ANDROID_CHANNEL_PREFIX = 'alarms-v2-';
const androidChannelId = (soundId: string) => `${ANDROID_CHANNEL_PREFIX}${soundId}`;

// ---------- AlarmKit (iOS 26+) ----------
// AlarmKit rings through Silent and Focus, but its Stop button can't be hidden.
// So each alarm is a short chain: Stop silences one link, the next rings a minute
// later, until the wake-up game's first step cancels the rest. Stopping the last
// link re-arms it natively a minute later (capped), so tapping Stop never ends it.
const ALARMKIT_CHAIN = 4;
const ALARMKIT_CHAIN_INTERVAL_MS = 60 * 1000;

const cancelAlarmKitChain = (key: string): void => {
    if (!alarmKit) return;
    for (let i = 0; i < ALARMKIT_CHAIN; i++) alarmKit.cancel(alarmKitId(key, i));
};

/** True if AlarmKit will make the sound; false means the notifications must. */
const armAlarmKitChain = async (key: string, firesAt: number, title: string, soundFile: string): Promise<boolean> => {
    if (!alarmKit || alarmKit.authorizationState() !== 'authorized') return false;
    try {
        for (let i = 0; i < ALARMKIT_CHAIN; i++) {
            const last = i === ALARMKIT_CHAIN - 1;
            await alarmKit.schedule(alarmKitId(key, i), firesAt + i * ALARMKIT_CHAIN_INTERVAL_MS, title, t('alarmKit.stop'), soundFile, last);
        }
        return true;
    } catch (error) {
        console.error('AlarmKit scheduling failed, using notification sounds:', error);
        cancelAlarmKitChain(key);
        return false;
    }
};

/** The in-app ring screen is taking over: silence the system alarm that's ringing now. */
export const stopAlarmKitAlert = (): void => {
    try {
        alarmKit?.stopAlerting();
    } catch (error) {
        console.error('Error stopping AlarmKit alert:', error);
    }
};

const getBundledSound = (soundId?: string | null) =>
    BUNDLED_SOUNDS.find(s => s.id === soundId) ??
    BUNDLED_SOUNDS.find(s => s.id === DEFAULT_SOUND_ID) ??
    BUNDLED_SOUNDS[0];

export const ensureAndroidAlarmChannels = async (): Promise<void> => {
    if (Platform.OS !== 'android') return;
    try {
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
                vibrationPattern: [0, 500, 200, 500, 200, 500],
                lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
                bypassDnd: true,
                enableVibrate: true,
                enableLights: true,
            });
        }
    } catch (error) {
        console.error('Error creating Android alarm channels:', error);
    }
};

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
    }),
});


// Request notification permissions
export const requestNotificationPermissions = async (): Promise<boolean> => {
    try {
        await ensureAndroidAlarmChannels();
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Notification permissions not granted');
            return false;
        }

        // Notifications stay on even with AlarmKit: they're how a tap opens the wake-up game.
        await alarmKit?.requestAuthorization().catch(error => console.error('AlarmKit authorization failed:', error));
        return true;
    } catch (error) {
        console.error('Error requesting notification permissions:', error);
        return false;
    }
};

// Schedule alarm notification with backup notifications
export const scheduleAlarmNotification = async (alarm: Alarm): Promise<string | null> => {
    try {
        // Cancel existing notifications for this alarm
        await cancelAlarmNotifications(alarm.id);

        if (!alarm.enabled) return null;

        const [hours, minutes] = alarm.time.split(':').map(Number);

        // Find next trigger time
        const now = new Date();
        const trigger = new Date();
        trigger.setHours(hours, minutes, 0, 0);

        // If time has passed today, schedule for tomorrow or next enabled day
        if (trigger <= now) {
            trigger.setDate(trigger.getDate() + 1);
        }

        // Check if any day is selected (repeating alarm)
        const hasRepeatDays = alarm.days.some(d => d);

        if (hasRepeatDays) {
            // Find next enabled day
            let daysToAdd = 0;
            const startDay = trigger.getDay();

            for (let i = 0; i < 7; i++) {
                const checkDay = (startDay + i) % 7;
                if (alarm.days[checkDay]) {
                    daysToAdd = i;
                    break;
                }
            }

            trigger.setDate(trigger.getDate() + daysToAdd);
        }

        await ensureAndroidAlarmChannels();

        // Bundled sound for the notification (custom-sound URIs can't be used
        // as notification sounds, so they fall back to the default bundled one).
        const sound = getBundledSound(alarm.soundUri);
        const soundName = sound.notificationSound;
        const channelId = androidChannelId(sound.id);

        // Format time for display in alarm ring screen
        const displayTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        // Thread ID for grouping notifications (iOS)
        const threadId = `alarm-${alarm.id}`;

        // With AlarmKit ringing, the notifications go silent and only open the game.
        const viaAlarmKit = await armAlarmKitChain(alarm.id, trigger.getTime(), alarm.label || t('ring.defaultLabel'), soundName);

        // Bursts scheduled while fewer alarms were on are longer: trim them first,
        // so adding this one can't push a far-off alarm past the limit.
        const count = burstSize((await getAlarms()).filter(a => a.enabled).length);
        for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
            if (Number(n.content.data?.notificationIndex) >= count) await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }

        // Schedule multiple backup notifications (grouped)
        let firstNotificationId: string | null = null;

        for (let i = 0; i < count; i++) {
            const notificationTime = new Date(trigger.getTime() + (i * BACKUP_NOTIFICATION_INTERVAL_MS));
            // Text is fixed at scheduling time; Settings re-schedules on a language change.
            const messages = strings().notifications;
            const message = messages[i % messages.length];
            const displayBody = alarm.label || message.body;

            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: message.title,
                    body: displayBody,
                    data: {
                        alarmId: alarm.id,
                        soundUri: alarm.soundUri,
                        gradualVolume: !!alarm.gradualVolume,
                        label: alarm.label,
                        time: displayTime,
                        notificationIndex: i,
                    },
                    sound: viaAlarmKit ? false : notificationSound(soundName), // Each notification plays the alarm sound
                    priority: Notifications.AndroidNotificationPriority.MAX,
                    // iOS specific - makes notification more prominent and groups them
                    interruptionLevel: 'timeSensitive',
                    categoryIdentifier: 'alarm',
                    // Group notifications together on iOS
                    ...(i > 0 && { threadId }),
                } as Notifications.NotificationContentInput,
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: notificationTime,
                    channelId,
                },
            });

            if (i === 0) {
                firstNotificationId = notificationId;
            }

            console.log(`Scheduled alarm ${alarm.id} notification ${i + 1}/${count} for ${notificationTime.toString()}`);
        }

        return firstNotificationId;
    } catch (error) {
        console.error('Error scheduling alarm notification:', error);
        return null;
    }
};

// Alarms are scheduled as one-shot DATE triggers for the next occurrence only,
// so repeating alarms must be re-armed after they fire. Call on app launch,
// on foreground, and after the wake-up game is completed.
//
// `skipRinging` leaves alarms whose burst is still in progress untouched, so
// bringing the app to the foreground (e.g. via the app icon) doesn't silence a
// ringing alarm before the user has dealt with it.
export const rescheduleRepeatingAlarms = async (
    alarms: Alarm[],
    { skipRinging = false }: { skipRinging?: boolean } = {}
): Promise<void> => {
    for (const alarm of alarms) {
        if (!alarm.enabled || !alarm.days.some(d => d)) continue;
        if (skipRinging && isAlarmRinging(alarm)) continue;
        await scheduleAlarmNotification(alarm);
    }
};

// True if the alarm's most recent occurrence is within the backup window.
const isAlarmRinging = (alarm: Alarm): boolean => {
    const [hours, minutes] = alarm.time.split(':').map(Number);
    const now = new Date();
    for (let daysAgo = 0; daysAgo < 8; daysAgo++) {
        const candidate = new Date();
        candidate.setDate(now.getDate() - daysAgo);
        candidate.setHours(hours, minutes, 0, 0);
        if (candidate > now) continue;
        if (!alarm.days[candidate.getDay()]) continue;
        return now.getTime() - candidate.getTime() < BACKUP_WINDOW_MS;
    }
    return false;
};

// Cancel all notifications for an alarm (including backup notifications)
export const cancelAlarmNotifications = async (alarmId: string): Promise<void> => {
    try {
        cancelAlarmKitChain(alarmId);
        const notifications = await Notifications.getAllScheduledNotificationsAsync();
        const toCancel = notifications.filter(
            n => n.content.data?.alarmId === alarmId
        );

        for (const notification of toCancel) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }

        // Also dismiss any delivered notifications for this alarm
        const deliveredNotifications = await Notifications.getPresentedNotificationsAsync();
        const deliveredToCancel = deliveredNotifications.filter(
            n => n.request.content.data?.alarmId === alarmId
        );

        for (const notification of deliveredToCancel) {
            await Notifications.dismissNotificationAsync(notification.request.identifier);
        }

        console.log(`Cancelled ${toCancel.length} scheduled and ${deliveredToCancel.length} delivered notifications for alarm ${alarmId}`);
    } catch (error) {
        console.error('Error canceling alarm notifications:', error);
    }
};

// ---------- "Still awake?" check ----------
// Check notifications carry `checkAlarmId` (not `alarmId`) so the ring screen,
// dedupe and alarm cancel/re-arm paths all leave them alone.

// Serialize check bookkeeping: a notification tap and the app turning active
// arrive together and would otherwise both count the same missed check.
let wakeCheckQueue: Promise<unknown> = Promise.resolve();
const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = wakeCheckQueue.then(fn, fn);
    wakeCheckQueue = run.catch(() => undefined);
    return run;
};

const cancelWakeCheckNotifications = async (alarmId: string): Promise<void> => {
    cancelAlarmKitChain(`check-${alarmId}`);
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
        if (n.content.data?.checkAlarmId === alarmId) await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
        if (n.request.content.data?.checkAlarmId === alarmId) await Notifications.dismissNotificationAsync(n.request.identifier);
    }
};

/** Arm the check after the wake-up game; it rings like the alarm (same burst). */
export const armWakeCheck = (alarm: Alarm, delayMs = WAKE_CHECK_DELAY_MS): Promise<void> => serial(async () => {
    try {
        await cancelWakeCheckNotifications(alarm.id);
        await ensureAndroidAlarmChannels();
        const sound = getBundledSound(alarm.soundUri);
        const firesAt = Date.now() + delayMs;
        const viaAlarmKit = await armAlarmKitChain(`check-${alarm.id}`, firesAt, t('wakeCheck.title'), sound.notificationSound);
        for (let i = 0; i < BACKUP_NOTIFICATION_COUNT; i++) {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: t('wakeCheck.title'),
                    body: t('wakeCheck.body'),
                    data: { checkAlarmId: alarm.id },
                    sound: viaAlarmKit ? false : notificationSound(sound.notificationSound),
                    priority: Notifications.AndroidNotificationPriority.MAX,
                    interruptionLevel: 'timeSensitive',
                    ...(i > 0 && { threadId: `check-${alarm.id}` }),
                } as Notifications.NotificationContentInput,
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: new Date(firesAt + i * BACKUP_NOTIFICATION_INTERVAL_MS),
                    channelId: androidChannelId(sound.id),
                },
            });
        }
        const checks = await getWakeChecks();
        checks[alarm.id] = firesAt;
        await saveWakeChecks(checks);
    } catch (error) {
        console.error('Error arming wake check:', error);
    }
});

export const cancelWakeCheck = (alarmId: string): Promise<void> => serial(async () => {
    try {
        await cancelWakeCheckNotifications(alarmId);
        const checks = await getWakeChecks();
        delete checks[alarmId];
        await saveWakeChecks(checks);
    } catch (error) {
        console.error('Error cancelling wake check:', error);
    }
});

/**
 * Settle checks whose ring has started: the app being open during the ring
 * means the user is awake; a ring that ran out means they fell back asleep,
 * so that alarm's game levels up. Call on launch, on foreground and whenever a
 * check notification arrives. Returns true if any alarm levelled up.
 */
export const processWakeChecks = (): Promise<boolean> => serial(async () => {
    let leveled = false;
    try {
        const checks = await getWakeChecks();
        const now = Date.now();
        let changed = false;
        for (const [alarmId, firesAt] of Object.entries(checks)) {
            const outcome = wakeCheckOutcome(firesAt, now, BACKUP_WINDOW_MS);
            if (outcome === 'pending') continue;
            delete checks[alarmId];
            changed = true;
            await cancelWakeCheckNotifications(alarmId);
            if (outcome === 'missed') {
                const alarm = (await getAlarms()).find(a => a.id === alarmId);
                const bumped = alarm && harder(alarm);
                if (bumped) {
                    await saveAlarm(bumped);
                    leveled = true;
                }
            }
        }
        if (changed) await saveWakeChecks(checks);
    } catch (error) {
        console.error('Error processing wake checks:', error);
    }
    return leveled;
});

