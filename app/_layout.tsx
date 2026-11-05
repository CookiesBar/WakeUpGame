import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Onboarding from '@/components/Onboarding';
import PaywallGate from '@/components/PaywallGate';
import { Colors as WakeyColors } from '@/constants/wakeyTheme';
import { AlarmProvider } from '@/contexts/AlarmContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { BACKUP_WINDOW_MS, processWakeChecks, stopAlarmKitAlert } from '@/utils/notifications';
import { needsPaywall } from '@/utils/revenueCat';
import { initializeAudio, playAlarmSound } from '@/utils/sounds';

export {
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

const ONBOARDING_COMPLETE_KEY = 'hasSeenOnboarding';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Handle alarm notification - navigate to full-screen alarm screen
const handleAlarmNotification = (notification: Notifications.Notification) => {
  const data = notification.request.content.data;
  if (data?.alarmId) {
    // Play alarm sound; the in-app sound replaces a ringing AlarmKit alert
    stopAlarmKitAlert();
    playAlarmSound(data.soundUri as string | undefined, data.gradualVolume === true);

    // Navigate to the full-screen ring + wake-up game
    router.push({
      pathname: '/ring',
      params: {
        alarmId: data.alarmId as string,
        label: (data.label as string | undefined) ?? '',
      },
    });
  }
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // The one app font (constants/theme + constants/wakeyTheme)
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);
  // alarmId → when we last handled it. Backup notifications share the alarmId
  // but have distinct identifiers, so dedupe per alarm within one ring window.
  const lastHandledAt = useRef<Map<string, number>>(new Map());

  const [locked, setLocked] = useState(false);
  // Never cover the ring screen: a non-subscriber couldn't stop the alarm.
  const pathname = usePathname();

  // Handle alarm notification with deduplication
  const handleAlarmNotificationSafe = (notification: Notifications.Notification) => {
    // "Still awake?" ringing while the app is open (or tapped) = awake.
    if (notification.request.content.data?.checkAlarmId) {
      processWakeChecks();
      return;
    }
    const alarmId = notification.request.content.data?.alarmId as string | undefined;
    if (!alarmId) return;

    const now = Date.now();
    const last = lastHandledAt.current.get(alarmId);
    if (last !== undefined && now - last < BACKUP_WINDOW_MS) {
      console.log('Alarm already being handled, skipping:', alarmId);
      return;
    }

    lastHandledAt.current.set(alarmId, now);
    console.log('Handling notification for alarm:', alarmId);

    handleAlarmNotification(notification);
  };

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        const isComplete = hasSeenOnboarding === 'true';
        console.log('Onboarding status:', isComplete ? 'complete' : 'not complete');
        setIsOnboardingComplete(isComplete);
        setShowOnboarding(!isComplete);
        return isComplete;
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setIsOnboardingComplete(true);
        setShowOnboarding(false);
        return true;
      }
    };

    if (fontsLoaded) {
      checkOnboarding().then(async (isComplete) => {
        // Decide before the splash hides, so home never flashes before the paywall.
        if (isComplete) setLocked(await needsPaywall().catch(() => false));
        SplashScreen.hideAsync();
        initializeAudio();
      });
    }
  }, [fontsLoaded]);

  // Set up notification listeners
  useEffect(() => {
    // When notification is received while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      handleAlarmNotificationSafe(notification);
    });

    // When user interacts with notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      handleAlarmNotificationSafe(response.notification);
    });

    // Check if app was opened from notification (only on initial mount)
    // The last response survives app restarts, so without the age check every
    // cold start re-opened the ring screen for an alarm dismissed long ago.
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response && Date.now() - response.notification.date < BACKUP_WINDOW_MS) {
        console.log('App opened from notification:', response);
        handleAlarmNotificationSafe(response.notification);
      }
      Notifications.clearLastNotificationResponse();
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  const handleOnboardingComplete = async () => {
    try {
      // The onboarding already saved and scheduled the user's first alarm.
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
    // Personalizing → paywall: lock first so home never shows in between.
    setLocked(await needsPaywall().catch(() => false));
    setShowOnboarding(false);
    setIsOnboardingComplete(true);
  };

  if (!fontsLoaded || isOnboardingComplete === null) {
    return null;
  }

  // Show onboarding as a full-screen overlay
  if (showOnboarding) {
    return (
      <LocaleProvider>
        <GestureHandlerRootView style={styles.container}>
          <StatusBar style="dark" />
          <SafeAreaView style={styles.onboardingContainer}>
            <Onboarding onComplete={handleOnboardingComplete} />
          </SafeAreaView>
        </GestureHandlerRootView>
      </LocaleProvider>
    );
  }

  return (
    <LocaleProvider>
      <GestureHandlerRootView style={styles.container}>
        <AlarmProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen
              name="alarm/[id]"
              options={{
                animation: 'slide_from_bottom',
                animationDuration: 200, // Faster animation
              }}
            />
            <Stack.Screen
              name="alarm/sounds"
              options={{
                animation: 'slide_from_right',
                animationDuration: 250,
              }}
            />
            <Stack.Screen
              name="settings"
              options={{
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="ring"
              options={{
                presentation: 'fullScreenModal',
                gestureEnabled: false,
                animation: 'fade',
              }}
            />
          </Stack>
          {locked && pathname !== '/ring' && (
            <View style={StyleSheet.absoluteFill}>
              <PaywallGate onUnlocked={() => setLocked(false)} />
            </View>
          )}
        </AlarmProvider>
      </GestureHandlerRootView>
    </LocaleProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  onboardingContainer: {
    flex: 1,
    backgroundColor: WakeyColors.paper,
  },
});
