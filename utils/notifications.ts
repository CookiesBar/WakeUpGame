// Notification utilities for alarm scheduling
import * as Notifications from 'expo-notifications';
import { DEFAULT_SOUND_ID } from './sounds';
import { Alarm } from './storage';

// Number of backup notifications to schedule (1 per minute)
const BACKUP_NOTIFICATION_COUNT = 5;
const BACKUP_NOTIFICATION_INTERVAL_MS = 60 * 1000; // 1 minute

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

// Map sound IDs to notification sound filenames
// expo-notifications converts the sound files: replaces spaces/special chars with underscores
const SOUND_FILE_MAP: Record<string, string> = {
    'fast-alarm': 'Fast_Alarm.wav',
    'slow-alarm': 'Slow_Alarm.wav',
    'beige-sparkle': 'Beige_Sparkle_.wav',
    'coffee-run': 'Coffee_Run.wav',
    'office-water': 'Office_Water.wav',
    'whimsical': 'Wimsicle.wav',
};

// Get notification sound name from soundId
const getNotificationSoundName = (soundId?: string | null): string | undefined => {
    if (!soundId) {
        soundId = DEFAULT_SOUND_ID;
    }

    // Check if it's a bundled sound
    if (SOUND_FILE_MAP[soundId]) {
        return SOUND_FILE_MAP[soundId];
    }

    // Custom sound - notification can't use custom URIs, use default
    return SOUND_FILE_MAP[DEFAULT_SOUND_ID];
};

// Notification messages for backup notifications
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

        // Set up Android notification channel for alarms (high priority)
        await Notifications.setNotificationChannelAsync('alarms', {
            name: 'Alarms',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            vibrationPattern: [0, 500, 200, 500, 200, 500],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
            enableVibrate: true,
            enableLights: true,
        });

        // Get the sound name for notification
        const soundName = getNotificationSoundName(alarm.soundUri);

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
            const message = NOTIFICATION_MESSAGES[i] || NOTIFICATION_MESSAGES[0];
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
                    sound: soundName || true, // Each notification plays the alarm sound
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
                    channelId: 'alarms',
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
