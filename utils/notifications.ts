// Notification utilities for alarm scheduling
import * as Notifications from 'expo-notifications';
import { DEFAULT_SOUND_ID } from './sounds';
import { Alarm } from './storage';

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

// Schedule alarm notification (single notification like Apple's alarm)
export const scheduleAlarmNotification = async (alarm: Alarm): Promise<string | null> => {
    try {
        // Cancel existing notification for this alarm
        await cancelAlarmNotification(alarm.id);

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

        // Schedule single notification (like Apple's alarm app)
        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title: '⏰ Wake Up!',
                body: alarm.label || 'Time to wake up!',
                data: {
                    alarmId: alarm.id,
                    soundUri: alarm.soundUri,
                },
                sound: soundName || true, // Use custom sound or default
                priority: Notifications.AndroidNotificationPriority.MAX,
                // iOS specific - makes notification more prominent
                interruptionLevel: 'timeSensitive',
                categoryIdentifier: 'alarm',
            } as Notifications.NotificationContentInput,
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: trigger,
                channelId: 'alarms',
            },
        });

        console.log(`Scheduled alarm ${alarm.id} for ${trigger.toLocaleString()}`);

        return notificationId;
    } catch (error) {
        console.error('Error scheduling alarm notification:', error);
        return null;
    }
};

// Cancel alarm notification
export const cancelAlarmNotification = async (alarmId: string): Promise<void> => {
    try {
        const notifications = await Notifications.getAllScheduledNotificationsAsync();
        const toCancel = notifications.filter(
            n => n.content.data?.alarmId === alarmId
        );

        for (const notification of toCancel) {
            await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
    } catch (error) {
        console.error('Error canceling alarm notification:', error);
    }
};

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
