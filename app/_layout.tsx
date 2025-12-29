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
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Onboarding from '@/components/Onboarding';
import { Colors } from '@/constants/theme';
import { AlarmProvider } from '@/contexts/AlarmContext';
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

    if (fontsLoaded) {
      checkOnboarding().then(() => {
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
              headerShown: false,
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
