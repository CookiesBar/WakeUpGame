/**
 * Rating Dialog Utility
 * Triggers native App Store rating dialog after odd-numbered alarm completions
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const ALARM_COMPLETION_COUNT_KEY = '@alarm_completion_count';
const SHOULD_SHOW_RATING_KEY = '@should_show_rating';

/**
 * Increment alarm completion count and check if rating should be shown
 * Called when user completes all wake-up games
 */
export async function recordAlarmCompletion(): Promise<void> {
    try {
        const countStr = await AsyncStorage.getItem(ALARM_COMPLETION_COUNT_KEY);
        const count = countStr ? parseInt(countStr, 10) : 0;
        const newCount = count + 1;

        await AsyncStorage.setItem(ALARM_COMPLETION_COUNT_KEY, String(newCount));
        console.log('Alarm completion count:', newCount);

        // Check if this is an odd-numbered completion (1, 3, 5, 7, ...)
        if (newCount % 2 === 1) {
            // Set flag to show rating when returning to main screen
            await AsyncStorage.setItem(SHOULD_SHOW_RATING_KEY, 'true');
            console.log('Rating dialog will be shown on main screen');
        }
    } catch (error) {
        console.error('Error recording alarm completion:', error);
    }
}

/**
 * Check and show rating dialog if needed
 * Called when main screen is displayed
 */
export async function checkAndShowRating(): Promise<void> {
    try {
        const shouldShow = await AsyncStorage.getItem(SHOULD_SHOW_RATING_KEY);

        if (shouldShow === 'true') {
            // Clear the flag first
            await AsyncStorage.removeItem(SHOULD_SHOW_RATING_KEY);

            // Check if store review is available
            const isAvailable = await StoreReview.isAvailableAsync();

            if (isAvailable) {
                console.log('Showing native rating dialog');
                // Small delay to ensure screen is fully loaded
                setTimeout(async () => {
                    try {
                        await StoreReview.requestReview();
                    } catch (error) {
                        console.error('Error requesting review:', error);
                    }
                }, 1000);
            } else {
                console.log('Store review not available on this platform');
            }
        }
    } catch (error) {
        console.error('Error checking/showing rating:', error);
    }
}

/**
 * Get current alarm completion count (for debugging)
 */
export async function getAlarmCompletionCount(): Promise<number> {
    try {
        const countStr = await AsyncStorage.getItem(ALARM_COMPLETION_COUNT_KEY);
        return countStr ? parseInt(countStr, 10) : 0;
    } catch (error) {
        console.error('Error getting alarm completion count:', error);
        return 0;
    }
}

/**
 * Reset alarm completion count (for debugging)
 */
export async function resetAlarmCompletionCount(): Promise<void> {
    try {
        await AsyncStorage.removeItem(ALARM_COMPLETION_COUNT_KEY);
        await AsyncStorage.removeItem(SHOULD_SHOW_RATING_KEY);
        console.log('Alarm completion count reset');
    } catch (error) {
        console.error('Error resetting alarm completion count:', error);
    }
}
