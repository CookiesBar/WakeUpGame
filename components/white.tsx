// v3 white kit: a tap that answers on touch-down, the native switch, the streak flame and week row, the black button.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, Switch, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { ARRIVE, W, WFont } from '@/constants/white';
import { strings, t } from '@/i18n';
import type { DayMark, StreakInfo } from '@/utils/stats';

type TapProps = Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children?: ReactNode };

/** Any tap target: scales to 0.97 on touch-down (100 ms), springs back on release (no bounce). */
export function Tap({ style, children, onPressIn, onPressOut, ...rest }: TapProps) {
  const down = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.03 * down.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      style={[style, anim]}
      onPressIn={e => {
        down.value = withTiming(1, { duration: 100, easing: ARRIVE });
        onPressIn?.(e);
      }}
      onPressOut={e => {
        down.value = withSpring(0, { duration: 300, dampingRatio: 1 });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Entrance: 200 ms fade with an 8 px rise. Reanimated skips it under Reduce Motion. */
export const rise = (delay = 0) => () => {
  'worklet';
  const timing = { duration: 200, easing: ARRIVE };
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
    animations: {
      opacity: withDelay(delay, withTiming(1, timing)),
      transform: [{ translateY: withDelay(delay, withTiming(0, timing)) }],
    },
  };
};

/** The main button: Wakey's CTA blue, the same as the onboarding Cta (or greyed out while it can't be used). */
export function CtaButton({ label, icon, onPress, disabled, style }: { label: string; icon?: ReactNode; onPress: () => void; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Tap style={[styles.cta, disabled && styles.ctaOff, style]} onPress={onPress} disabled={disabled} accessibilityState={{ disabled }}>
      {icon}
      <Text style={[styles.ctaText, disabled && styles.ctaTextOff]}>{label}</Text>
    </Tap>
  );
}

/**
 * iOS's own switch in Wakey Blue, with a selection tick. It holds the flipped value until `value` catches up:
 * RN's Switch snaps back to the old prop otherwise while an async toggle (saving, scheduling) runs.
 */
export function WSwitch({ value, onValueChange, accessibilityLabel }: { value: boolean; onValueChange: (v: boolean) => void; accessibilityLabel: string }) {
  const [on, setOn] = useState(value);
  useEffect(() => setOn(value), [value]);
  return (
    <Switch
      value={on}
      onValueChange={v => {
        Haptics.selectionAsync().catch(() => {});
        setOn(v);
        onValueChange(v);
      }}
      trackColor={{ false: W.hair, true: W.blue }}
      ios_backgroundColor={W.hair}
      thumbColor={W.paper}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

/** The streak's mark. Amber belongs to the streak only. */
export function Flame({ size = 18 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path d="M12 22c-4.1 0-7-2.8-7-6.6 0-3.1 2-5.2 3.6-7 .3 1.7 1.3 2.9 2.6 3.4-.2-3.6 1.3-6.7 4.2-9.1.4 3.1 1.7 4.9 3.2 6.6 1.3 1.5 2.4 3.2 2.4 5.8 0 4-3.6 6.9-9 6.9z" fill={W.sun} />
      <Path d="M12 22c-1.9 0-3.2-1.3-3.2-3.1 0-1.6 1-2.6 2-3.6.2 1 .8 1.6 1.5 1.8 0-1.6.6-2.9 1.7-3.9.5 2.6 2.4 3.4 2.4 5.6 0 1.9-1.8 3.2-4.4 3.2z" fill="#FFD27A" />
    </Svg>
  );
}

function Dot({ mark, size }: { mark: DayMark; size: number }) {
  const base = { width: size, height: size, borderRadius: 999, alignItems: 'center', justifyContent: 'center' } as const;
  if (mark === 'done') return <View style={[base, { backgroundColor: W.sunSoft }]}><Flame size={Math.round(size * 0.56)} /></View>;
  if (mark === 'rest') return <View style={[base, { backgroundColor: W.mist }]}><Ionicons name="moon-outline" size={size * 0.5} color={W.graphite} /></View>;
  return <View style={[base, { backgroundColor: W.paper, borderWidth: 1.5, borderColor: W.hair }]} />;
}

/**
 * This week, Monday first: a flame for each morning that kept the streak, a moon for the rest day.
 * Today carries an amber ring.
 * The +1 screen: `todayLit` false keeps today unlit; when it turns true, the slot lights (its fill fades in and one
 * soft amber glow spreads and fades). `todayRef` is today's dot, so the flying flame can find it.
 */
export function WeekDots({ info, size = 32, todayLit, todayRef }: { info: StreakInfo; size?: number; todayLit?: boolean; todayRef?: Ref<ComponentRef<typeof View>> }) {
  const lit = useSharedValue(todayLit === false ? 0 : 1);
  useEffect(() => {
    if (todayLit) lit.value = withTiming(1, { duration: 600, easing: ARRIVE });
  }, [todayLit, lit]);
  const todayIn = useAnimatedStyle(() => ({ opacity: Math.min(1, lit.value * 2.4) })); // the fill lands in ~250 ms
  const glow = useAnimatedStyle(() => ({ opacity: lit.value < 1 ? 0.55 * (1 - lit.value) * Math.min(1, lit.value * 8) : 0, transform: [{ scale: 1 + 0.7 * lit.value }] }));
  const lighting = todayLit !== undefined;
  const { short } = strings().days; // Sunday first
  return (
    <View style={styles.week}>
      {info.week.map((mark, i) => {
        const today = i === info.today;
        const day = (i + 1) % 7;
        return (
          <View key={i} style={styles.day} accessible accessibilityLabel={`${short[day]}, ${t(`home.mark_${mark}`)}`}>
            <View ref={today ? todayRef : undefined} collapsable={false}>
              {today && lighting && <Animated.View style={[styles.glow, { borderRadius: size }, glow]} />}
              {today && <View style={styles.ring} />}
              {today && lighting ? (
                <View>
                  <Dot mark="open" size={size} />
                  <Animated.View style={[StyleSheet.absoluteFill, todayIn]}>
                    <Dot mark={mark} size={size} />
                  </Animated.View>
                </View>
              ) : (
                <Dot mark={mark} size={size} />
              )}
            </View>
            <Text style={[styles.letter, today && styles.letterToday]}>{short[day].slice(0, 2)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cta: { height: 56, borderRadius: 999, backgroundColor: W.cta, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaOff: { backgroundColor: W.hair },
  ctaText: { fontFamily: WFont.semibold, fontSize: 17, color: W.paper },
  ctaTextOff: { color: W.graphite },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { width: 36, alignItems: 'center', gap: 6 },
  ring: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderRadius: 999, borderWidth: 2, borderColor: W.sun },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: W.sun },
  letter: { fontFamily: WFont.semibold, fontSize: 12, lineHeight: 16, color: W.graphite },
  letterToday: { fontFamily: WFont.bold, color: W.ink },
});
