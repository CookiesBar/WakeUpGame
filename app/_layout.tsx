import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Onboarding from '@/components/Onboarding';
import { getPendingDemoAlarm } from '@/components/OnboardingAlarmDemo';
import { Colors } from '@/constants/theme';
import { AlarmProvider } from '@/contexts/AlarmContext';
import { checkPremiumStatus, configureRevenueCat, presentPaywall } from '@/utils/revenueCat';
import { initializeAudio, playAlarmSound } from '@/utils/sounds';

export {
  ErrorBoundary
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

const ONBOARDING_COMPLETE_KEY = 'hasSeenOnboarding';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Handle alarm notification - navigate to full-screen alarm screen
const handleAlarmNotification = (notification: Notifications.Notification) => {
  const data = notification.request.content.data;
  if (data?.alarmId) {
    // Play alarm sound
    playAlarmSound(data.soundUri as string | undefined);

    // Navigate to full-screen alarm ring screen
    router.push({
      pathname: '/alarm-ring' as const,
      params: {
        alarmId: data.alarmId as string,
        label: data.label as string | undefined,
        time: data.time as string | undefined,
      },
    } as any);
  }
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isCheckingPremium, setIsCheckingPremium] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);
  const handledNotificationIds = useRef<Set<string>>(new Set());

  // Handle alarm notification with deduplication
  const handleAlarmNotificationSafe = (notification: Notifications.Notification) => {
    const notificationId = notification.request.identifier;

    // Skip if already handled
    if (handledNotificationIds.current.has(notificationId)) {
      console.log('Notification already handled, skipping:', notificationId);
      return;
    }

    // Mark as handled
    handledNotificationIds.current.add(notificationId);
    console.log('Handling notification:', notificationId);

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

    const checkAndShowPaywallIfNeeded = async (onboardingComplete: boolean) => {
      // Only check premium for users who have completed onboarding
      if (!onboardingComplete) return;

      try {
        setIsCheckingPremium(true);
        await configureRevenueCat();

        const isPremium = await checkPremiumStatus();
        console.log('Premium status on app open:', isPremium);

        if (!isPremium) {
          console.log('User is not premium, showing hard paywall');
          // Show the hard paywall - user must subscribe to continue
          const result = await presentPaywall();
          console.log('Paywall result:', result);
          // If user didn't purchase, keep showing paywall (by calling again)
          if (!result) {
            // User closed paywall without purchasing - show it again
            // This creates a loop until user subscribes
            while (!(await checkPremiumStatus())) {
              console.log('User still not premium, showing paywall again');
              await presentPaywall();
            }
          }
        }
      } catch (error) {
        console.error('Error checking premium status:', error);
      } finally {
        setIsCheckingPremium(false);
      }
    };

    if (fontsLoaded) {
      checkOnboarding().then((isComplete) => {
        SplashScreen.hideAsync();
        initializeAudio();
        checkAndShowPaywallIfNeeded(isComplete);
      });
    }
  }, [fontsLoaded]);

  // Set up notification listeners
  useEffect(() => {
    // Native-only: expo-notifications' listeners no-op on web and
    // getLastNotificationResponseAsync() throws there, so skip on web.
    if (Platform.OS === 'web') return;

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
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (response) {
        console.log('App opened from notification:', response);
        handleAlarmNotificationSafe(response.notification);
      }
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
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      console.log('Onboarding complete, hiding overlay');

      // Check if user became premium and create the demo alarm
      const isPremium = await checkPremiumStatus();
      if (isPremium) {
        const pendingAlarm = await getPendingDemoAlarm();
        if (pendingAlarm) {
          console.log('User is premium, will create alarm from demo settings');
          // Store the pending alarm flag for AlarmContext to pick up
          await AsyncStorage.setItem('@create_pending_alarm', 'true');
        }
      }

      setShowOnboarding(false);
      setIsOnboardingComplete(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      setShowOnboarding(false);
    }
  };

  if (!fontsLoaded || isOnboardingComplete === null) {
    return null;
  }

  // Show onboarding as a full-screen overlay
  if (showOnboarding) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.onboardingContainer}>
          <Onboarding onComplete={handleOnboardingComplete} />
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <AlarmProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="alarm/[id]"
            options={{
              presentation: 'card',
              animation: 'slide_from_bottom',
              animationDuration: 200, // Faster animation
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="alarm/sounds"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
              animationDuration: 250,
              headerShown: false,
              gestureEnabled: true,
              gestureDirection: 'horizontal',
            }}
          />
          <Stack.Screen
            name="alarm-ring"
            options={{
              presentation: 'fullScreenModal',
              headerShown: false,
              gestureEnabled: false,
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="game"
            options={{
              presentation: 'fullScreenModal',
              headerShown: false,
              gestureEnabled: false,
            }}
          />
        </Stack>
      </AlarmProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  onboardingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
