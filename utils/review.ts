import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const WAKE_COUNT_KEY = '@wakeup_wake_count';
/** Ask after the user has had a few good mornings. iOS also caps the sheet at 3 per year. */
const ASK_AT = [2, 5, 15];

/** Call once per finished mission. Shows the native rating sheet on milestone wake-ups. */
export async function recordWakeAndMaybeAskReview(): Promise<void> {
  try {
    const count = Number(await AsyncStorage.getItem(WAKE_COUNT_KEY)) + 1;
    await AsyncStorage.setItem(WAKE_COUNT_KEY, String(count));
    if (ASK_AT.includes(count) && (await StoreReview.hasAction())) {
      await StoreReview.requestReview();
    }
  } catch (err) {
    console.error('review prompt failed:', err);
  }
}
