/**
 * Shared pieces for the onboarding flow: the answers it collects, haptics,
 * and the few building blocks every step uses (title, staggered rise, choice
 * row, springy CTA).
 */
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import type { Mission, Weekday } from '@/utils/storage';

export interface Answers {
  goal: string | null;
  pains: string[];
  /** The days that get a routine, Monday-first order not required. */
  days: Weekday[];
  /** 24h "HH:MM". */
  time: string;
  mission: Mission;
  steps: number;
  wakeCheck: boolean;
}

export const INITIAL_ANSWERS: Answers = {
  goal: null,
  pains: [],
  days: [1, 2, 3, 4, 5],
  time: '07:00',
  mission: 'walk',
  steps: 50,
  wakeCheck: false,
};

export interface StepProps {
  a: Answers;
  set: (patch: Partial<Answers>) => void;
  next: () => void;
}

const ignore = () => {};
export const haptic = {
  tick: () => Haptics.selectionAsync().catch(ignore),
  pop: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore),
  thud: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore),
  win: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore),
  nope: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore),
};

/** Every entrance: a short fade with an 8px lift, lightly staggered. No springs, so nothing bounces. */
export const rise = (i = 0) =>
  FadeInDown.delay(60 + i * 40).duration(260).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] });
/** Plain fade for things that appear in place. */
export const appear = (delay = 0) => FadeIn.delay(delay).duration(220);

/** Minutes after midnight → "HH:MM". */
export const hhmmOf = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

/** A day with this weekday (0 = Sunday), for Intl formatting. */
export const weekdayName = (locale: string, day: Weekday, weekday: 'long' | 'short' = 'short') =>
  new Date(2023, 0, 1 + day).toLocaleDateString(locale, { weekday });

/** A Date at `min` minutes after midnight, for clocks that show a made-up time. */
export const dateAt = (min: number) => new Date(2023, 0, 1, 0, min);

/** Counts from `from` to `to` minutes over `ms` with an ease-out, for clock hands that sweep into place. */
export function useSweep(from: number, to: number, ms: number, delay = 0) {
  const [m, setM] = useState(from);
  useEffect(() => {
    let raf = 0;
    const start = Date.now() + delay;
    const tick = () => {
      const p = Math.min(1, Math.max(0, (Date.now() - start) / ms));
      setM(Math.round(from + (to - from) * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, ms, delay]);
  return m;
}

/** Monday-first order for showing days. */
export const WEEK: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function Title({ children, sub }: { children: string; sub?: string }) {
  return (
    <View style={styles.titleWrap}>
      <Animated.Text entering={rise(0)} style={styles.title} accessibilityRole="header">
        {children}
      </Animated.Text>
      {sub && (
        <Animated.Text entering={rise(1)} style={styles.sub}>
          {sub}
        </Animated.Text>
      )}
    </View>
  );
}

export function Rise({ i, children, style }: { i: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={rise(i)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Pressable that squashes on touch with a spring, the press feedback for every big target. */
export function Squish({
  onPress,
  children,
  style,
  outer,
  disabled,
  ...a11y
}: {
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Layout for the touch target itself (e.g. flex: 1 in a row). */
  outer?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'checkbox' | 'radio' | 'switch';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
}) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={outer}
      onPressIn={() => (s.value = withTiming(0.98, { duration: 80 }))}
      onPressOut={() => (s.value = withTiming(1, { duration: 120 }))}
      accessibilityRole="button"
      {...a11y}
    >
      <Animated.View style={[style, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

/** One answer row: radio (single) or checkbox (multi). Border and fill animate in. */
export function Choice({ label, on, multi, onPress, i }: { label: string; on: boolean; multi?: boolean; onPress: () => void; i: number }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(on ? 1 : 0, { duration: 180 });
  }, [on, p]);
  const box = useAnimatedStyle(() => ({
    borderColor: interpolateColor(p.value, [0, 1], [Colors.ink100, Colors.primary]),
    backgroundColor: interpolateColor(p.value, [0, 1], [Colors.white, Colors.blue50]),
  }));
  const mark = useAnimatedStyle(() => ({ transform: [{ scale: p.value }], opacity: p.value }));
  return (
    <Animated.View entering={rise(i + 2)}>
      <Squish
        onPress={() => {
          haptic.pop();
          onPress();
        }}
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityState={multi ? { checked: on } : { selected: on }}
        accessibilityLabel={label}
      >
        <Animated.View style={[styles.choice, box]}>
          <View style={[styles.mark, multi ? styles.markSquare : styles.markRound, on && styles.markOn]}>
            <Animated.View style={mark}>
              {multi ? (
                <Ionicons name="checkmark" size={16} color={Colors.onBrand} />
              ) : (
                <View style={styles.dot} />
              )}
            </Animated.View>
          </View>
          <Text style={styles.choiceText}>{label}</Text>
        </Animated.View>
      </Squish>
    </Animated.View>
  );
}

/** Bottom call to action. Locked buttons stay visible but faded, then spring awake when unlocked. */
export function Cta({ label, onPress, disabled, ghost, onGhost }: { label: string; onPress: () => void; disabled?: boolean; ghost?: string; onGhost?: () => void }) {
  const on = useSharedValue(disabled ? 0 : 1);
  useEffect(() => {
    on.value = withTiming(disabled ? 0 : 1, { duration: 180 });
  }, [disabled, on]);
  const anim = useAnimatedStyle(() => ({
    opacity: 0.4 + on.value * 0.6,
  }));
  return (
    <Animated.View entering={rise(5)} style={styles.ctaWrap}>
      <Animated.View style={anim}>
        <Squish onPress={onPress} disabled={disabled} style={styles.cta} accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}>
          <Text style={styles.ctaText}>{label}</Text>
        </Squish>
      </Animated.View>
      {ghost && (
        <Pressable onPress={onGhost} style={styles.ghost} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.ghostText}>{ghost}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

export const styles = StyleSheet.create({
  titleWrap: { gap: Spacing.sm },
  title: { fontFamily: FontFamily.displayBold, fontSize: 30, lineHeight: 36, color: Colors.ink900 },
  sub: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textMuted },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 58,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  choiceText: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.ink900 },
  mark: { width: 26, height: 26, borderWidth: 2, borderColor: Colors.ink200, alignItems: 'center', justifyContent: 'center' },
  markRound: { borderRadius: 13 },
  markSquare: { borderRadius: 8 },
  markOn: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.white },
  ctaWrap: { marginTop: 'auto', gap: Spacing.xs, paddingTop: Spacing.md },
  cta: {
    height: 58,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.blue,
  },
  ctaText: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.lg, color: Colors.onBrand },
  ghost: { height: 44, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textMuted },
  card: { backgroundColor: Colors.surfaceCard, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadow.md },
  body: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textBody },
  small: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.textMuted },
});
