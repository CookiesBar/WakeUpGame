// The curved time wheel: minute ticks on a wide arc you drag 1:1, or flick to travel hours.
// Release projects the flick (Apple's deceleration formula), rounds to a whole minute, then a
// spring that keeps the finger's velocity lands it. A tick every 5 min, a bump every hour.
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PopView } from '@/components/pop';
import { LINE, Pop, PopFont } from '@/constants/pop';

const R = 420; // arc radius
const RAD = (0.4 * Math.PI) / 180; // 0.4° per minute
const PPM = R * RAD; // px per minute at the top of the arc
const TOP = 96; // y of the arc's top inside the card
const SLOTS = 63; // ticks either side of the needle (the arc shows about ±61 min)
const DECEL = 0.997; // a touch snappier than scroll (0.998)
// response 0.4 s, damping ratio 0.8: the flick earned a little overshoot.
const SPRING = { mass: 1, stiffness: (2 * Math.PI / 0.4) ** 2, damping: (4 * Math.PI * 0.8) / 0.4 };
const HEIGHT = 200;
const TICK_W = 3.5;
const TICK_H = 34;

const wrap = (m: number) => {
  'worklet';
  return ((Math.round(m) % 1440) + 1440) % 1440;
};

function Tick({ slot, pos, cx }: { slot: number; pos: SharedValue<number>; cx: number }) {
  const style = useAnimatedStyle(() => {
    const m = Math.floor(pos.value) + slot;
    const a = (m - pos.value) * RAD;
    const mm = ((m % 1440) + 1440) % 1440;
    const hour = mm % 60 === 0;
    const five = mm % 5 === 0;
    const fade = Math.pow(Math.max(0, Math.cos(a)), 10) * (hour ? 1 : five ? 0.9 : 0.5);
    return {
      opacity: fade,
      transform: [
        { translateX: cx + R * Math.sin(a) - TICK_W / 2 },
        { translateY: TOP + R * (1 - Math.cos(a)) },
        { rotate: `${a}rad` },
        { scaleX: (hour ? 3.5 : five ? 2.5 : 1.5) / TICK_W },
        { scaleY: (hour ? 34 : five ? 20 : 10) / TICK_H },
      ],
    };
  });
  return <Animated.View style={[styles.tick, style]} />;
}

function HourLabel({ k, base, pos, cx, text }: { k: number; base: SharedValue<number>; pos: SharedValue<number>; cx: number; text: string }) {
  const style = useAnimatedStyle(() => {
    const a = ((base.value + k) * 60 - pos.value) * RAD;
    const lr = R - 60;
    return {
      opacity: Math.abs(a) > 0.5 ? 0 : Math.pow(Math.cos(a), 8),
      transform: [
        { translateX: cx + lr * Math.sin(a) - 40 },
        { translateY: TOP + R - lr * Math.cos(a) - 12 },
        { rotate: `${a}rad` },
      ],
    };
  });
  return (
    <Animated.Text style={[styles.label, style]} numberOfLines={1}>
      {text}
    </Animated.Text>
  );
}

export interface TimeWheelProps {
  /** Minutes after midnight, 0..1439. */
  minutes: number;
  onChange: (minutes: number) => void;
  width: number;
  /** Pupil offset for a Wakey watching the wheel: leans the way the ticks travel. */
  look?: SharedValue<number>;
  hourLabel: (hour: number) => string;
  hint: string;
  accessibilityLabel: string;
  accessibilityValue: string;
}

export default function TimeWheel({ minutes, onChange, width, look, hourLabel, hint, accessibilityLabel, accessibilityValue }: TimeWheelProps) {
  const reduced = useReducedMotion();
  const pos = useSharedValue(minutes);
  const start = useSharedValue(minutes);
  const base = useSharedValue(Math.floor(minutes / 60));
  const bump = useSharedValue(1);
  const [baseHour, setBaseHour] = useState(Math.floor(minutes / 60));
  const cx = (width - 2 * LINE) / 2;

  // The parent's value changed (alarm loaded): jump there unless it is already where we are.
  useEffect(() => {
    if (wrap(pos.value) === minutes) return;
    cancelAnimation(pos);
    pos.value = minutes;
  }, [minutes, pos]);

  // ponytail: one setState per crossed minute, trailing-throttled to ~30 fps while it spins.
  const emitAt = useRef(0);
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticAt = useRef(0);
  const onMinute = useCallback(
    (cur: number, prev: number) => {
      const now = Date.now();
      if (now - hapticAt.current > 30) {
        const lo = Math.min(cur, prev);
        const hi = Math.max(cur, prev);
        const hour = Math.floor(hi / 60) * 60 > lo;
        const five = Math.floor(hi / 5) * 5 > lo;
        if (hour) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        else if (five) Haptics.selectionAsync().catch(() => {});
        if (hour || five) hapticAt.current = now;
      }
      const value = ((cur % 1440) + 1440) % 1440;
      if (trailing.current) clearTimeout(trailing.current);
      if (now - emitAt.current > 32) {
        emitAt.current = now;
        onChange(value);
      } else {
        trailing.current = setTimeout(() => {
          emitAt.current = Date.now();
          onChange(value);
        }, 40);
      }
    },
    [onChange],
  );
  useEffect(() => () => {
    if (trailing.current) clearTimeout(trailing.current);
  }, []);
  const landed = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
  }, []);
  const onHour = useCallback((h: number) => setBaseHour(h), []);

  useAnimatedReaction(
    () => Math.round(pos.value),
    (cur, prev) => {
      if (prev === null || cur === prev) return;
      runOnJS(onMinute)(cur, prev);
    },
  );
  useAnimatedReaction(
    () => Math.floor(pos.value / 60),
    (h, prev) => {
      if (h === prev) return;
      base.value = h;
      if (prev !== null) bump.value = withSequence(withTiming(1.3, { duration: 90 }), withTiming(1, { duration: 140 }));
      runOnJS(onHour)(h);
    },
  );

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onBegin(() => {
      cancelAnimation(pos); // grab it mid-flight
    })
    .onStart(() => {
      start.value = pos.value;
    })
    .onUpdate(e => {
      pos.value = start.value - e.translationX / PPM;
      if (look) look.value = Math.max(-16, Math.min(16, e.velocityX * 0.02));
    })
    .onEnd(e => {
      const v = -e.velocityX / PPM; // minutes per second
      const target = Math.round(pos.value + ((v / 1000) * DECEL) / (1 - DECEL));
      if (reduced) pos.value = target;
      else
        pos.value = withSpring(target, { ...SPRING, velocity: v }, finished => {
          if (finished) runOnJS(landed)();
        });
      if (look) look.value = withTiming(0, { duration: 600 });
    })
    .onFinalize((_, success) => {
      // A touch that never became a drag (or got cancelled) still lands on a whole minute.
      if (!success) pos.value = reduced ? Math.round(pos.value) : withSpring(Math.round(pos.value), SPRING);
    });

  const head = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const step = (delta: number) => {
    cancelAnimation(pos);
    pos.value = Math.round(pos.value) + delta;
  };

  return (
    <PopView style={[styles.card, { width }]} depth={5}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={StyleSheet.absoluteFill}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ text: accessibilityValue }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={e => step(e.nativeEvent.actionName === 'increment' ? 5 : -5)}
        >
          {Array.from({ length: SLOTS * 2 + 1 }, (_, i) => (
            <Tick key={i} slot={i - SLOTS} pos={pos} cx={cx} />
          ))}
          {[-1, 0, 1, 2].map(k => (
            <HourLabel key={k} k={k} base={base} pos={pos} cx={cx} text={hourLabel((((baseHour + k) % 24) + 24) % 24)} />
          ))}
          <View style={[styles.needle, { left: cx - 4 }]} pointerEvents="none" />
          <Animated.View style={[styles.head, { left: cx - 12 }, head]} pointerEvents="none" />
          <Text style={styles.hint} pointerEvents="none">
            {hint}
          </Text>
        </Animated.View>
      </GestureDetector>
    </PopView>
  );
}

const styles = StyleSheet.create({
  card: { height: HEIGHT, borderRadius: 30, backgroundColor: Pop.blue, overflow: 'hidden' },
  tick: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: TICK_W,
    height: TICK_H,
    borderRadius: 2,
    backgroundColor: Pop.white,
    transformOrigin: [TICK_W / 2, 0, 0],
  },
  label: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 80,
    textAlign: 'center',
    fontFamily: PopFont.heavy,
    fontSize: 18,
    color: Pop.white,
  },
  needle: {
    position: 'absolute',
    top: 22,
    width: 8,
    height: 92,
    borderRadius: 999,
    borderWidth: LINE,
    borderColor: Pop.ink,
    backgroundColor: Pop.sun,
  },
  head: {
    position: 'absolute',
    top: 10,
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: LINE,
    borderColor: Pop.ink,
    backgroundColor: Pop.sun,
  },
  hint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 12,
    textAlign: 'center',
    fontFamily: PopFont.bold,
    fontSize: 12,
    color: Pop.onBlue,
  },
});
