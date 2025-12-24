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

// Schedule alarm notification
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

        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title: '⏰ Wake Up!',
                body: alarm.label || 'Time to wake up!',
                data: {
                    alarmId: alarm.id,
                    soundUri: alarm.soundUri,
                },
                sound: true,
                priority: 'max',
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: trigger,
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
