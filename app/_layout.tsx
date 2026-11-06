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
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Onboarding from '@/components/Onboarding';
import PaywallGate from '@/components/PaywallGate';
import { Colors as WakeyColors } from '@/constants/wakeyTheme';
import { AlarmProvider } from '@/contexts/AlarmContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import {
  answerWakeCheck,
  BACKUP_WINDOW_MS,
  processWakeChecks,
  setupWakeCheckButtons,
  stopAlarmKitAlert,
  takeAlarmKitAnswers,
  takeRingAgain,
  WAKE_NO,
  WAKE_YES,
} from '@/utils/notifications';
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

type RingData = { alarmId: string; soundUri?: string; gradualVolume?: boolean; label?: string };

const ringData = (notification: Notifications.Notification): RingData => {
  const data = notification.request.content.data ?? {};
  return {
    alarmId: data.alarmId as string,
    soundUri: data.soundUri as string | undefined,
    gradualVolume: data.gradualVolume === true,
    label: data.label as string | undefined,
  };
};

// Open the full-screen ring + wake-up game
const openRing = ({ alarmId, soundUri, gradualVolume, label }: RingData) => {
  // Play alarm sound; the in-app sound replaces a ringing AlarmKit alert
  stopAlarmKitAlert();
  playAlarmSound(soundUri, gradualVolume === true);
  router.push({ pathname: '/ring', params: { alarmId, label: label ?? '' } });
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
  // ring → when we last handled it. A ring's backup notifications share alarmId and
  // time, so dedupe on both: re-timing the alarm (or its next ring) starts fresh.
  const lastHandledAt = useRef<Map<string, number>>(new Map());
  // A tap that launches the app arrives before the Stack is mounted: hold it until then.
  const navReady = useRef(false);
  const pendingRing = useRef<RingData | null>(null);

  const [locked, setLocked] = useState(false);

  // Handle alarm notification with deduplication
  const handleAlarmNotificationSafe = (notification: Notifications.Notification) => {
    // The alarm ringing again after an unanswered "Still awake?": the whole game.
    const again = notification.request.content.data?.ringAgainId as string | undefined;
    if (again) {
      ringAgain({ ...ringData(notification), alarmId: again });
      return;
    }
    // "Still awake?" ringing while the app is open (or tapped) = awake.
    if (notification.request.content.data?.checkAlarmId) {
      processWakeChecks();
      return;
    }
    const alarmId = notification.request.content.data?.alarmId as string | undefined;
    if (!alarmId) return;

    const ring = `${alarmId}@${notification.request.content.data?.time ?? ''}`;
    const now = Date.now();
    const last = lastHandledAt.current.get(ring);
    if (last !== undefined && now - last < BACKUP_WINDOW_MS) {
      console.log('Alarm already being handled, skipping:', alarmId);
      return;
    }

    lastHandledAt.current.set(ring, now);
    console.log('Handling notification for alarm:', alarmId);

    queueRing(ringData(notification));
  };

  const queueRing = (data: RingData) => {
    if (navReady.current) openRing(data);
    else pendingRing.current = data;
  };

  // Its notification, the app opening while it rings, and the next 30 s burst all ask: open the game once.
  const ringAgain = (data: RingData) => {
    const key = `${data.alarmId}@again`;
    const last = lastHandledAt.current.get(key);
    if (last !== undefined && Date.now() - last < BACKUP_WINDOW_MS) return;
    lastHandledAt.current.set(key, Date.now());
    queueRing(data);
  };

  // "Still awake?" Yes / No. No: the wake-up game again, now.
  const answer = (checkAlarmId: string, awake: boolean) =>
    answerWakeCheck(checkAlarmId, awake).then(alarm => {
      if (alarm) queueRing({ alarmId: alarm.id, soundUri: alarm.soundUri ?? undefined, gradualVolume: alarm.gradualVolume, label: alarm.label });
    });

  const handleResponse = (response: Notifications.NotificationResponse) => {
    const checkAlarmId = response.notification.request.content.data?.checkAlarmId as string | undefined;
    if (checkAlarmId && (response.actionIdentifier === WAKE_YES || response.actionIdentifier === WAKE_NO)) {
      answer(checkAlarmId, response.actionIdentifier === WAKE_YES);
      return;
    }
    handleAlarmNotificationSafe(response.notification);
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

  // Yes / No tapped on a "Still awake?" AlarmKit alert waits natively until the app reads it. Then settle the
  // checks: one that rang out unanswered while its alarm still rings again opens the game.
  useEffect(() => {
    const collect = () => {
      takeAlarmKitAnswers().forEach(([checkAlarmId, awake]) => answer(checkAlarmId, awake));
      processWakeChecks().then(() =>
        takeRingAgain().forEach(alarm =>
          ringAgain({ alarmId: alarm.id, soundUri: alarm.soundUri ?? undefined, gradualVolume: alarm.gradualVolume, label: alarm.label }),
        ),
      );
    };
    collect();
    let again: ReturnType<typeof setTimeout> | undefined;
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      collect();
      // ponytail: No opens the app and its intent can land just after 'active', so look once more.
      // A native event would close this race for good if 1.5 s ever proves too short.
      clearTimeout(again);
      again = setTimeout(collect, 1500);
    });
    return () => {
      sub.remove();
      clearTimeout(again);
    };
    // Once: `answer` only reaches refs and module functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up notification listeners
  useEffect(() => {
    setupWakeCheckButtons();
    // When notification is received while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      handleAlarmNotificationSafe(notification);
    });

    // When user interacts with notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      handleResponse(response);
    });

    // Check if app was opened from notification (only on initial mount)
    // The last response survives app restarts, so without the age check every
    // cold start re-opened the ring screen for an alarm dismissed long ago.
    Notifications.getLastNotificationResponseAsync().then(response => {
      // iOS reports `date` in seconds, Android in ms.
      const date = response?.notification.date ?? 0;
      const deliveredAt = date < 1e12 ? date * 1000 : date;
      if (response && Date.now() - deliveredAt < BACKUP_WINDOW_MS) {
        console.log('App opened from notification:', response);
        handleResponse(response);
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

  // The Stack below renders once fonts and onboarding are settled: run a held tap then.
  const stackMounted = !!fontsLoaded && isOnboardingComplete === true && !showOnboarding;
  useEffect(() => {
    navReady.current = stackMounted;
    if (stackMounted && pendingRing.current) {
      openRing(pendingRing.current);
      pendingRing.current = null;
    }
  }, [stackMounted]);

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
                animation: 'slide_from_bottom', // at the system's default speed, like Settings' push (no custom duration)
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
          {locked && <PaywallOverlay onUnlocked={() => setLocked(false)} />}
        </AlarmProvider>
      </GestureHandlerRootView>
    </LocaleProvider>
  );
}

// Its own component so only this re-renders on a route change, not the whole app mid-transition.
function PaywallOverlay({ onUnlocked }: { onUnlocked: () => void }) {
  // Never cover the ring screen: a non-subscriber couldn't stop the alarm.
  if (usePathname() === '/ring') return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <PaywallGate onUnlocked={onUnlocked} />
    </View>
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
