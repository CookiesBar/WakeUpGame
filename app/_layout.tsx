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

  const handledIds = useRef<Set<string>>(new Set());
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

    const handleSafe = (notification: Notifications.Notification) => {
      const id = notification.request.identifier;
      if (handledIds.current.has(id)) return;
      handledIds.current.add(id);
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
      <AlarmProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="profile" options={{ animation: 'none' }} />
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
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
