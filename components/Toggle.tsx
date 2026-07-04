import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

const W = 58;
const H = 34;
const K = 26;

/** Chunky pill toggle with a springy knob (Wakey design). */
export default function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const anim = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: checked ? 1 : 0,
      useNativeDriver: false,
      friction: 7,
      tension: 80,
    }).start();
  }, [checked, anim]);

  const left = anim.interpolate({ inputRange: [0, 1], outputRange: [4, W - K - 4] });
  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.ink200, Colors.primary],
  });

  return (
    <Pressable onPress={() => onChange(!checked)} hitSlop={6}>
      <Animated.View style={[styles.track, { backgroundColor: bg }]}>
        <Animated.View style={[styles.knob, { left }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: W,
    height: H,
    borderRadius: 999,
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    width: K,
    height: K,
    borderRadius: K / 2,
    backgroundColor: Colors.white,
    shadowColor: '#0B1B3B',
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
