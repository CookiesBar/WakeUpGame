// Alarm time on Apple-style drums in a white card: hour · minute (· AM/PM), one Mist band across them.
// A 12-hour clock's hour drum spans 24 h, so rolling 11 → 12 flips AM/PM like iOS.
// The drums are ~86 animated rows; building them while the editor slides up made it stutter. Until `ready`,
// the card shows a still copy of each drum's visible rows (same spots, same type); the drums then fade in over it.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import WheelPicker from '@/components/WheelPicker';
import { ARRIVE, W, WFont } from '@/constants/white';

const ROW = 36;
const HEIGHT = 180; // = ROW × 5 visible rows, so the centre row sits at HEIGHT / 2
const pad = (n: number) => String(n).padStart(2, '0');
const H24 = Array.from({ length: 24 }, (_, i) => pad(i));
const H12 = Array.from({ length: 12 }, (_, i) => String(i || 12));
const MINS = Array.from({ length: 60 }, (_, i) => pad(i));
const AP = ['AM', 'PM'];
const COLORS = [W.ink, 'rgba(11,13,16,0.3)'] as const;

const mod = (a: number, n: number) => ((a % n) + n) % n;
/** Rows at -3…3 from the centre: further out they pass the ±90° edge and vanish. */
const OFFSETS = [-3, -2, -1, 0, 1, 2, 3];
// WheelPicker's cylinder at rest (its Row: radius = HEIGHT / 2, one row = ROW / radius rad), as plain styles.
const ROW_LOOK = OFFSETS.map(d => {
  const radius = HEIGHT / 2;
  const a = d * (ROW / radius);
  return {
    opacity: 0.35 + 0.65 * Math.cos(a),
    color: d === 0 ? COLORS[0] : COLORS[1],
    transform: [{ perspective: 700 }, { translateY: radius * Math.sin(a) }, { rotateX: `${-a}rad` }],
  };
});

export interface TimeWheelProps {
  /** Minutes after midnight, 0..1439. */
  minutes: number;
  onChange: (minutes: number) => void;
  twelveHour: boolean;
  accessibilityLabel: string;
  /** False while the screen is still arriving: show the still card, build the drums after. */
  ready?: boolean;
}

export default function TimeWheel({ minutes, onChange, twelveHour, accessibilityLabel, ready = true }: TimeWheelProps) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const common = { itemHeight: ROW, style: styles.wheel, textStyle: styles.text, colors: COLORS, accessibilityLabel };
  // The drums fade in over the still copy, and the copy goes only when the fade has really finished on screen
  // (not after a guessed delay: building the drums can take longer than any guess on a slow or debug build).
  const [settled, setSettled] = useState(false);
  const shown = useSharedValue(0);
  useEffect(() => {
    if (!ready) return;
    shown.value = withTiming(1, { duration: 180, easing: ARRIVE }, done => {
      if (done) runOnJS(setSettled)(true);
    });
  }, [ready, shown]);
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
  // Each drum's visible rows, by offset from the centre: the same rows the live drums show at rest.
  const near = (pick: (d: number) => string | undefined) => OFFSETS.map(d => [d, pick(d)] as const).filter((r): r is readonly [number, string] => !!r[1]);
  const still = [
    near(d => (twelveHour ? H12[mod(h + d, 12)] : H24[mod(h + d, 24)])),
    near(d => MINS[mod(m + d, 60)]),
    ...(twelveHour ? [near(d => AP[(h < 12 ? 0 : 1) + d])] : []),
  ];
  return (
    <View style={styles.card}>
      <View style={styles.band} pointerEvents="none" />
      {/* The still time stays underneath until the drums have faded in over it, so the time never blinks out. */}
      {!settled && (
        <View style={[styles.wheels, styles.fill]}>
          {still.map((rows, i) => (
            <View key={i} style={[styles.wheel, styles.stillCol]}>
              {rows.map(([d, v]) => (
                <Text key={d} style={[styles.stillRow, styles.text, ROW_LOOK[d + 3]]}>{v}</Text>
              ))}
            </View>
          ))}
        </View>
      )}
      {ready && (
        <Animated.View style={[styles.wheels, styles.fill, fade]}>
          <WheelPicker {...common} data={twelveHour ? H12 : H24} cycle={24} selectedIndex={h} onIndexChange={i => onChange(i * 60 + m)} />
          <WheelPicker {...common} data={MINS} selectedIndex={m} onIndexChange={i => onChange(h * 60 + i)} />
          {twelveHour && (
            <WheelPicker
              {...common}
              data={AP}
              infinite={false}
              selectedIndex={h < 12 ? 0 : 1}
              onIndexChange={i => onChange(((h % 12) + 12 * i) * 60 + m)}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { height: HEIGHT, borderRadius: 24, backgroundColor: W.paper, overflow: 'hidden', justifyContent: 'center' },
  band: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '50%',
    height: ROW,
    marginTop: -ROW / 2,
    borderRadius: 10,
    backgroundColor: W.mist,
  },
  wheels: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center' },
  wheel: { width: 72 },
  // Matches WheelPicker's rows exactly, so the swap to the live drums doesn't move anything.
  stillCol: { height: HEIGHT },
  stillRow: { position: 'absolute', left: 0, right: 0, top: HEIGHT / 2 - ROW / 2, height: ROW, lineHeight: ROW, textAlign: 'center', fontVariant: ['tabular-nums'] },
  text: { fontFamily: WFont.semibold, fontSize: 26, letterSpacing: -0.26 },
});
