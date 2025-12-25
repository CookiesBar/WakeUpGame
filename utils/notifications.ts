// Notification utilities for alarm scheduling
import * as Notifications from 'expo-notifications';
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

// Number of follow-up notifications for nagging alarm (60 = 1 hour for heavy sleepers)
const NAGGING_COUNT = 60;
// Interval between nagging notifications (in minutes)
const NAGGING_INTERVAL_MINUTES = 1;

// Schedule alarm notification with nagging follow-ups
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

        // Thread ID to group all notifications for this alarm together
        // iOS will show them as a single grouped notification
        const threadId = `alarm-${alarm.id}`;

        // Schedule main notification + nagging follow-ups
        let firstNotificationId: string | null = null;

        for (let i = 0; i < NAGGING_COUNT; i++) {
            const notificationTime = new Date(trigger.getTime() + i * NAGGING_INTERVAL_MINUTES * 60 * 1000);

            const notificationId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: '⏰ Wake Up!',
                    body: i === 0
                        ? (alarm.label || 'Time to wake up!')
                        : `${alarm.label || 'Alarm'} - Tap to stop`,
                    data: {
                        alarmId: alarm.id,
                        soundUri: alarm.soundUri,
                        isFollowUp: i > 0,
                        threadId: threadId, // Store in data for grouping reference
                    },
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.MAX,
                    // iOS specific - makes notification more prominent
                    interruptionLevel: 'timeSensitive',
                    categoryIdentifier: 'alarm',
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

            console.log(`Scheduled alarm ${alarm.id} notification ${i + 1}/${NAGGING_COUNT} for ${notificationTime.toLocaleString()}`);
        }

        return firstNotificationId;
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
