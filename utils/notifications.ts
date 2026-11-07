// Notification utilities for alarm scheduling
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { strings, t } from '../i18n';
import { alarmKit } from '../modules/wakey-alarm';
import { posthog } from './analytics';
import { alarmKitId } from './alarmKitId';
import { BUNDLED_SOUNDS, DEFAULT_SOUND_ID } from './sounds';
import { Alarm, getAlarms, getRingAgain, getWakeChecks, saveAlarm, saveRingAgain, saveWakeChecks } from './storage';
import { harder, ringAgainEnds, WAKE_CHECK_DELAY_MS, wakeCheckOutcome } from './wakeCheck';

// A local notification can't wake the app while the screen is off, so the only
// sound the user hears is the notification's own (≤30 s on iOS). Schedule a
// burst of backup notifications so the alarm keeps ringing until it's tapped.
// 8 × 30 s ≈ 4 minutes of ringing.
export const BACKUP_NOTIFICATION_COUNT = 8;
export const BACKUP_NOTIFICATION_INTERVAL_MS = 30 * 1000;
export const BACKUP_WINDOW_MS = BACKUP_NOTIFICATION_COUNT * BACKUP_NOTIFICATION_INTERVAL_MS;

// iOS keeps only the 64 soonest pending notifications and silently drops the
// rest, so with 8+ alarms the farthest one never rang. Share them out evenly,
// keeping two full bursts free for a "Still awake?" check and its ring-again.
// ponytail: room for one pending check; two at once (games < 5 min apart) can still overflow.
const IOS_PENDING_LIMIT = 64;
const burstSize = (enabledAlarms: number) =>
    Math.max(1, Math.min(BACKUP_NOTIFICATION_COUNT, Math.floor((IOS_PENDING_LIMIT - 2 * BACKUP_NOTIFICATION_COUNT) / enabledAlarms)));

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
            await alarmKit.schedule(alarmKitId(key, i), firesAt + i * ALARMKIT_CHAIN_INTERVAL_MS, title, t('alarmKit.stop'), soundFile, last, t('alarmKit.play'));
        }
        return true;
    } catch (error) {
        console.error('AlarmKit scheduling failed, using notification sounds:', error);
        cancelAlarmKitChain(key);
        return false;
    }
};

/** A "Still awake?" chain: each link's alert has Yes and No, and either answer ends the whole check (natively). */
const armAlarmKitCheck = async (alarmId: string, firesAt: number, soundFile: string): Promise<boolean> => {
    const key = `check-${alarmId}`;
    if (!alarmKit?.scheduleCheck) return armAlarmKitChain(key, firesAt, t('wakeCheck.title'), soundFile); // a build from before Yes / No
    if (alarmKit.authorizationState() !== 'authorized') return false;
    try {
        for (let i = 0; i < ALARMKIT_CHAIN; i++) {
            await alarmKit.scheduleCheck(alarmKitId(key, i), firesAt + i * ALARMKIT_CHAIN_INTERVAL_MS, t('wakeCheck.title'), t('wakeCheck.yes'), t('wakeCheck.no'), soundFile, alarmId);
        }
        return true;
    } catch (error) {
        console.error('AlarmKit check scheduling failed, using notification sounds:', error);
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

        // PostHog Workflows push: the plugin registers the token on later launches; this covers the first grant.
        if (Platform.OS === 'ios' && !IN_EXPO_GO) Notifications.getDevicePushTokenAsync().then(tk => posthog.registerPushNotificationToken(tk.data)).catch(() => {});
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

// ---------- Ring again ----------
// A check that rings out unanswered means they went back to sleep: right after it, the alarm rings again and
// the whole wake-up game plays. It has its own keys (`ringAgainId`, AlarmKit `again-<id>`), because re-arming the
// alarm for its next day cancels everything keyed by `alarmId`, and the app does that on every return to the foreground.
const againKey = (alarmId: string) => `again-${alarmId}`;

/** Play tapped on an AlarmKit alarm: which alarm it was, and whether it was a ring-again (null if none / unknown). */
export const takeAlarmKitPlay = async (): Promise<{ alarm: Alarm; again: boolean } | null> => {
    const id = alarmKit?.takeOpenRequest?.();
    if (!id) return null;
    for (const alarm of await getAlarms()) {
        for (let i = 0; i < ALARMKIT_CHAIN; i++) {
            if (alarmKitId(alarm.id, i) === id) return { alarm, again: false };
            if (alarmKitId(againKey(alarm.id), i) === id) return { alarm, again: true };
        }
    }
    return null;
};
// The alarms whose check just rang out while their ring-again is still going: open the game for them.
let ringNow: Alarm[] = [];
/** Alarms to ring again now (read once; the root layout opens the game for each). */
export const takeRingAgain = (): Alarm[] => {
    const list = ringNow;
    ringNow = [];
    return list;
};

/** Returns true if AlarmKit rings it (it then keeps going while Stop is tapped), false for one notification burst. */
const armRingAgain = async (alarm: Alarm, at: number, checkViaAlarmKit: boolean): Promise<boolean> => {
    const sound = getBundledSound(alarm.soundUri);
    // With AlarmKit the check's Yes and No are handled natively (the app may not even open), so the ring-again
    // chain joins the check: either answer ends it too. Builds without that link fall back to notifications.
    if (checkViaAlarmKit && alarmKit?.linkToCheck) {
        const key = againKey(alarm.id);
        if (await armAlarmKitChain(key, at, alarm.label || t('ring.defaultLabel'), sound.notificationSound)) {
            for (let i = 0; i < ALARMKIT_CHAIN; i++) alarmKit.linkToCheck(alarm.id, alarmKitId(key, i));
            return true; // AlarmKit rings; opening the app while it does starts the game (processWakeChecks → takeRingAgain)
        }
    }
    const messages = strings().notifications;
    for (let i = 0; i < BACKUP_NOTIFICATION_COUNT; i++) {
        const message = messages[i % messages.length];
        await Notifications.scheduleNotificationAsync({
            content: {
                title: message.title,
                body: alarm.label || message.body,
                data: { ringAgainId: alarm.id, soundUri: alarm.soundUri, gradualVolume: !!alarm.gradualVolume, label: alarm.label },
                sound: notificationSound(sound.notificationSound),
                priority: Notifications.AndroidNotificationPriority.MAX,
                interruptionLevel: 'timeSensitive',
                ...(i > 0 && { threadId: againKey(alarm.id) }),
            } as Notifications.NotificationContentInput,
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(at + i * BACKUP_NOTIFICATION_INTERVAL_MS),
                channelId: androidChannelId(sound.id),
            },
        });
    }
    return false;
};

/** Stop the ring-again (the game started, or the check was answered or settled as awake). */
export const cancelRingAgain = async (alarmId: string): Promise<void> => {
    try {
        const owed = await getRingAgain();
        if (alarmId in owed) {
            delete owed[alarmId];
            await saveRingAgain(owed);
        }
        cancelAlarmKitChain(againKey(alarmId));
        for (const n of await Notifications.getAllScheduledNotificationsAsync()) {
            if (n.content.data?.ringAgainId === alarmId) await Notifications.cancelScheduledNotificationAsync(n.identifier);
        }
        for (const n of await Notifications.getPresentedNotificationsAsync()) {
            if (n.request.content.data?.ringAgainId === alarmId) await Notifications.dismissNotificationAsync(n.request.identifier);
        }
    } catch (error) {
        console.error('Error cancelling ring-again:', error);
    }
};

/** `keepRingAgain`: a check that rang out leaves its ring-again going until the game starts. */
const cancelWakeCheckNotifications = async (alarmId: string, keepRingAgain = false): Promise<void> => {
    if (!keepRingAgain) await cancelRingAgain(alarmId);
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
        const viaAlarmKit = await armAlarmKitCheck(alarm.id, firesAt, sound.notificationSound);
        // The alert's own Yes / No end the check natively, often without opening the app, so no JS could cancel
        // a notification burst after a Yes: with them, AlarmKit alone asks. (Builds without them keep the burst.)
        const nativeAnswers = viaAlarmKit && !!alarmKit?.scheduleCheck;
        setupWakeCheckButtons(); // in the current language (the launch-time registration can predate it)
        for (let i = 0; i < (nativeAnswers ? 0 : BACKUP_NOTIFICATION_COUNT); i++) {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: t('wakeCheck.title'),
                    // iPhone only shows a notification's buttons after a press and hold, so there a tap is the Yes
                    // (and no answer rings again). Android shows Yes / No right on the banner.
                    body: Platform.OS === 'android' ? t('wakeCheck.body') : t('wakeCheck.tapBody'),
                    data: { checkAlarmId: alarm.id },
                    ...(Platform.OS === 'android' && { categoryIdentifier: WAKE_CHECK_CATEGORY }),
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
        // No answer by the end of the check's ring: the alarm rings again, straight after.
        const againAt = firesAt + BACKUP_WINDOW_MS;
        const againViaAlarmKit = await armRingAgain(alarm, againAt, viaAlarmKit);
        const owed = await getRingAgain();
        owed[alarm.id] = ringAgainEnds(againAt, BACKUP_WINDOW_MS, againViaAlarmKit);
        await saveRingAgain(owed);
        const checks = await getWakeChecks();
        checks[alarm.id] = firesAt;
        await saveWakeChecks(checks);
    } catch (error) {
        console.error('Error arming wake check:', error);
    }
});

// Yes / No on the check. Both buttons open the app, so the answer is always handled
// (a background action can be lost if the app isn't running).
export const WAKE_CHECK_CATEGORY = 'wake-check';
export const WAKE_YES = 'wake-yes';
export const WAKE_NO = 'wake-no';

/** Register the check notification's Yes / No buttons (Android), in the current language. Call at launch. */
export const setupWakeCheckButtons = (): void => {
    if (Platform.OS !== 'android') return;
    Notifications.setNotificationCategoryAsync(WAKE_CHECK_CATEGORY, [
        { identifier: WAKE_YES, buttonTitle: t('wakeCheck.yes'), options: { opensAppToForeground: true } },
        { identifier: WAKE_NO, buttonTitle: t('wakeCheck.no'), options: { opensAppToForeground: true } },
    ]).catch(error => console.error('Error registering wake check buttons:', error));
};

// How each check was settled by processWakeChecks in this run of the app, so a late answer isn't counted twice.
const settled = new Map<string, { outcome: 'awake' | 'missed'; at: number }>();
/** An answer this soon after the app opening settled its check as awake is that same open (e.g. the No that opened it). */
const LATE_ANSWER_MS = 2 * 60 * 1000;

/**
 * Answer a check. Yes: awake, done. No: not awake, like a check that rang out (the game gets one notch harder),
 * and the game plays again now: returns the alarm to ring, else null.
 * An answer to a check that was already settled: if it rang out, the bump and the game already happened (a Yes
 * still stops the ring-again); if the app opening just settled it as awake, that open was this answer; else stale.
 */
export const answerWakeCheck = (alarmId: string, awake: boolean): Promise<Alarm | null> => serial(async () => {
    try {
        const checks = await getWakeChecks();
        if (!(alarmId in checks)) {
            const prior = settled.get(alarmId);
            if (awake) await cancelRingAgain(alarmId);
            if (awake || prior?.outcome !== 'awake' || Date.now() - prior.at > LATE_ANSWER_MS) return null;
        }
        delete checks[alarmId];
        await saveWakeChecks(checks);
        await cancelWakeCheckNotifications(alarmId);
        if (awake) return null;
        const alarm = (await getAlarms()).find(a => a.id === alarmId);
        if (!alarm) return null;
        const bumped = harder(alarm);
        if (bumped) await saveAlarm(bumped);
        return bumped ?? alarm;
    } catch (error) {
        console.error('Error answering wake check:', error);
        return null;
    }
});

/** Answers given on the AlarmKit alert (stored natively until read): [alarm id, awake]. */
export const takeAlarmKitAnswers = (): [string, boolean][] => {
    try {
        return Object.entries(alarmKit?.takeCheckAnswers?.() ?? {}).map(([id, answer]) => [id, answer === 'yes']);
    } catch (error) {
        console.error('Error reading wake check answers:', error);
        return [];
    }
};

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
 * so that alarm's game levels up and, while it still rings again, plays now. Call on launch, on foreground and whenever a
 * check notification arrives. Returns true if any alarm levelled up.
 */
export const processWakeChecks = (): Promise<boolean> => serial(async () => {
    let leveled = false;
    try {
        const checks = await getWakeChecks();
        const owed = await getRingAgain();
        const now = Date.now();
        let changed = false;
        for (const [alarmId, firesAt] of Object.entries(checks)) {
            const outcome = wakeCheckOutcome(firesAt, now, BACKUP_WINDOW_MS);
            if (outcome === 'pending') continue;
            delete checks[alarmId];
            changed = true;
            settled.set(alarmId, { outcome, at: now });
            // Rang out and still ringing again: keep it ringing (and owed, stored, until the game starts).
            const again = outcome === 'missed' && (owed[alarmId] ?? 0) > now;
            await cancelWakeCheckNotifications(alarmId, again);
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
        // Owed games: a check that rang out while its ring-again still rings opens the game now, also after the
        // app was killed in between; once the ring-again is over, it's dropped.
        const alarms = await getAlarms();
        for (const [alarmId, until] of Object.entries(await getRingAgain())) { // re-read: settling as awake cleared some
            if (alarmId in checks) continue; // its check hasn't settled yet
            const alarm = alarms.find(a => a.id === alarmId);
            if (alarm && until > now) {
                if (!ringNow.some(a => a.id === alarmId)) ringNow.push(alarm);
            } else {
                await cancelRingAgain(alarmId);
            }
        }
    } catch (error) {
        console.error('Error processing wake checks:', error);
    }
    return leveled;
});

