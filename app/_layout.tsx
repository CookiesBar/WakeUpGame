import {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AlarmProvider } from '@/contexts/AlarmContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { BURST_WINDOW_MS, cancelAlarmBurst } from '@/utils/notifications';
import { configureRevenueCat } from '@/utils/revenueCat';
import { initializeAudio, playAlarmSound } from '@/utils/sounds';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

/** Route an incoming alarm notification to the full-screen ring experience. */
function handleAlarmNotification(notification: Notifications.Notification) {
  const data = notification.request.content.data as {
    alarmId?: string;
    label?: string;
    time?: string;
    soundId?: string | null;
  };
  if (!data?.alarmId) return;

  // The app is now handling the alarm (looping sound + ring screen), so the
  // remaining OS-level burst notifications would only double up on it.
  cancelAlarmBurst(data.alarmId).catch(() => undefined);

  playAlarmSound(data.soundId ?? undefined);
  router.push({
    pathname: '/ring',
    params: {
      alarmId: data.alarmId,
      label: data.label ?? '',
      time: data.time ?? '',
      soundId: data.soundId ?? '',
    },
  });
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  /** alarmId → last time we handled it; burst follow-ups share the alarmId. */
  const lastHandledAt = useRef<Map<string, number>>(new Map());
  const receivedSub = useRef<Notifications.EventSubscription | null>(null);
  const responseSub = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (!fontsLoaded) return;
    (async () => {
      await configureRevenueCat(); // configured, not gating (paywall is a later phase)
      await initializeAudio();
      await SplashScreen.hideAsync();
    })();
  }, [fontsLoaded]);

  useEffect(() => {
    if (Platform.OS === 'web') return; // notifications are native-only

    // Dedupe per alarm within one ring window: the base notification and its
    // burst follow-ups all carry the same alarmId but distinct identifiers.
    const handleSafe = (notification: Notifications.Notification) => {
      const alarmId = (notification.request.content.data as { alarmId?: string })?.alarmId;
      if (!alarmId) return;
      const now = Date.now();
      const last = lastHandledAt.current.get(alarmId);
      if (last !== undefined && now - last < BURST_WINDOW_MS) return;
      lastHandledAt.current.set(alarmId, now);
      handleAlarmNotification(notification);
    };

    receivedSub.current = Notifications.addNotificationReceivedListener(handleSafe);
    responseSub.current = Notifications.addNotificationResponseReceivedListener((r) =>
      handleSafe(r.notification)
    );
    Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) handleSafe(r.notification);
    });

    return () => {
      receivedSub.current?.remove();
      responseSub.current?.remove();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.container}>
      <LocaleProvider>
        <AlarmProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen
              name="alarm/[id]"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="ring"
              options={{
                presentation: 'fullScreenModal',
                gestureEnabled: false,
                animation: 'fade',
              }}
            />
            <Stack.Screen
              name="game"
              options={{
                presentation: 'fullScreenModal',
                gestureEnabled: false,
                animation: 'fade',
              }}
            />
          </Stack>
        </AlarmProvider>
      </LocaleProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
