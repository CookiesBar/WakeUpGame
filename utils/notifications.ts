// Notification utilities for alarm scheduling
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { BUNDLED_SOUNDS, DEFAULT_SOUND_ID } from './sounds';
import { Alarm } from './storage';

// A local notification can't wake the app while the screen is off, so the only
// sound the user hears is the notification's own (≤30 s on iOS). Schedule a
// burst of backup notifications so the alarm keeps ringing until it's tapped.
// 8 × 30 s ≈ 4 minutes of ringing.
export const BACKUP_NOTIFICATION_COUNT = 8;
export const BACKUP_NOTIFICATION_INTERVAL_MS = 30 * 1000;
export const BACKUP_WINDOW_MS = BACKUP_NOTIFICATION_COUNT * BACKUP_NOTIFICATION_INTERVAL_MS;

// Android plays the *channel's* sound (not the notification's) and a channel's
// settings are frozen once created — so one channel per bundled sound, under a
// new id prefix so the legacy 'alarms' channel (default sound) is left behind.
const ANDROID_CHANNEL_PREFIX = 'alarms-v2-';
const androidChannelId = (soundId: string) => `${ANDROID_CHANNEL_PREFIX}${soundId}`;

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

        return true;
    } catch (error) {
        console.error('Error requesting notification permissions:', error);
        return false;
    }
};

// Notification messages for backup notifications (cycles once exhausted)
const NOTIFICATION_MESSAGES = [
    { title: '⏰ Wake Up!', body: 'Time to wake up!' },
    { title: '⏰ Alarm Still Ringing!', body: 'Tap to dismiss your alarm' },
    { title: '⏰ Don\'t Miss Your Alarm!', body: 'Wake up! Tap to stop the alarm' },
    { title: '⏰ Your Alarm Needs Attention!', body: 'Complete challenges to dismiss' },
    { title: '⏰ Final Reminder!', body: 'Your alarm is still active' },
];

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
        const displayHours = hours % 12 || 12;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayTime = `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;

        // Thread ID for grouping notifications (iOS)
        const threadId = `alarm-${alarm.id}`;

        // Schedule multiple backup notifications (grouped)
        let firstNotificationId: string | null = null;

        for (let i = 0; i < BACKUP_NOTIFICATION_COUNT; i++) {
            const notificationTime = new Date(trigger.getTime() + (i * BACKUP_NOTIFICATION_INTERVAL_MS));
            const message = NOTIFICATION_MESSAGES[i % NOTIFICATION_MESSAGES.length];
            const displayBody = alarm.label || message.body;

            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: message.title,
                    body: displayBody,
                    data: {
                        alarmId: alarm.id,
                        soundUri: alarm.soundUri,
                        label: alarm.label,
                        time: displayTime,
                        notificationIndex: i,
                    },
                    sound: soundName, // Each notification plays the alarm sound
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

            console.log(`Scheduled alarm ${alarm.id} notification ${i + 1}/${BACKUP_NOTIFICATION_COUNT} for ${notificationTime.toLocaleString()}`);
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

// Legacy function name for backward compatibility
export const cancelAlarmNotification = cancelAlarmNotifications;

// Cancel all notifications
export const cancelAllNotifications = async (): Promise<void> => {
    try {
        await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
        console.error('Error canceling all notifications:', error);
    }
};

// Get all scheduled notifications
export const getScheduledNotifications = async () => {
    try {
        return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
        console.error('Error getting scheduled notifications:', error);
        return [];
    }
};
