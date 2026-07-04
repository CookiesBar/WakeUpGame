import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';

function formatClock(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function RingScreen() {
  const { label, time, soundId } = useLocalSearchParams<{
    label?: string;
    time?: string;
    soundId?: string;
  }>();

  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const startChallenge = () => {
    router.replace({
      pathname: '/game',
      params: { soundId: soundId ?? '' },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text style={styles.clock}>{formatClock(time ?? '')}</Text>
        <Text style={styles.label}>{label || 'Wake Up!'}</Text>
      </View>

      <View style={styles.center}>
        <Animated.View style={[styles.iconGlow, pulseStyle]}>
          <Ionicons name="alarm" size={96} color={Colors.onAccent} />
        </Animated.View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.hint}>
          Complete the wake-up challenge to turn off the alarm.
        </Text>
        <Pressable style={styles.cta} onPress={startChallenge}>
          <Text style={styles.ctaText}>Start challenge</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'space-between',
    paddingVertical: Spacing.xxl,
  },
  top: { alignItems: 'center', gap: Spacing.sm },
  clock: {
    fontSize: FontSize.display,
    fontFamily: FontFamily.bold,
    color: Colors.onAccent,
  },
  label: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.medium,
    color: Colors.accentSoft,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  iconGlow: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { paddingHorizontal: Spacing.xl, gap: Spacing.lg, alignItems: 'center' },
  hint: {
    textAlign: 'center',
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: Colors.accentSoft,
  },
  cta: {
    width: '100%',
    backgroundColor: Colors.onAccent,
    paddingVertical: Spacing.lg,
    borderRadius: 999,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.bold,
    color: Colors.primary,
  },
});
