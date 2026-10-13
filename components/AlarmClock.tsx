import { StyleSheet, Text, View } from 'react-native';
import { Colors, FontFamily } from '@/constants/theme';

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const BORDER = 8;
/** 60 dashes round a 12-hour face: one per 12 minutes. */
const DASHES = 60;

/** Point on a circle of radius r around (c, c); `turn` 0 = 12 o'clock, 1 = full circle clockwise. */
const at = (c: number, r: number, turn: number) => ({
  x: c + r * Math.sin(turn * 2 * Math.PI),
  y: c - r * Math.cos(turn * 2 * Math.PI),
});

export interface ClockAlarm {
  /** Minutes after midnight. */
  minutes: number;
  /** Already rang (greys its dash). */
  passed: boolean;
}

/**
 * Analog clock face with a dash every 12 minutes. A dash holding an alarm is
 * longer and dark; grey once every alarm on it has rung. 12-hour dial: AM and PM share a dash.
 */
export default function AlarmClock({
  size,
  now,
  alarms,
  label,
}: {
  size: number;
  now: Date;
  alarms: ClockAlarm[];
  /** Spoken summary, e.g. "Alarms on Tuesday: 6:45 AM, 7:00 AM". */
  label: string;
}) {
  // Children are laid out inside the border.
  const inner = size - 2 * BORDER;
  const c = inner / 2;

  // Dash index → true while any of its alarms is still to come.
  const marked = new Map<number, boolean>();
  for (const a of alarms) {
    const i = Math.round((a.minutes % 720) / 12) % DASHES;
    marked.set(i, (marked.get(i) ?? false) || !a.passed);
  }

  const dash = (i: number) => {
    const alarm = marked.get(i);
    const hour = i % 5 === 0;
    const [from, width, color] =
      alarm !== undefined
        ? [0.72, 5, alarm ? Colors.ink900 : Colors.ink200]
        : hour
          ? [0.83, 3, Colors.ink400]
          : [0.9, 1.5, Colors.ink200];
    const to = 0.97;
    const length = c * (to - from);
    const mid = at(c, c * ((from + to) / 2), i / DASHES);
    return (
      <View
        key={i}
        style={{
          position: 'absolute',
          left: mid.x - width / 2,
          top: mid.y - length / 2,
          width,
          height: length,
          borderRadius: width / 2,
          backgroundColor: color,
          transform: [{ rotate: `${(i / DASHES) * 360}deg` }],
        }}
      />
    );
  };

  const hand = (turn: number, length: number, width: number, color: string) => (
    <View
      style={{
        position: 'absolute',
        left: c - width / 2,
        top: c - length,
        width,
        height: length,
        borderRadius: width / 2,
        backgroundColor: color,
        transformOrigin: '50% 100%',
        transform: [{ rotate: `${turn * 360}deg` }],
      }}
    />
  );

  return (
    <View
      style={[styles.face, { width: size, height: size, borderRadius: size / 2 }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {Array.from({ length: DASHES }, (_, i) => dash(i))}

      {HOURS.map((h, i) => {
        const p = at(c, c * 0.6, i / 12);
        const box = inner * 0.14;
        return (
          <View key={h} style={[styles.numeral, { left: p.x - box / 2, top: p.y - box / 2, width: box, height: box }]}>
            <Text style={[styles.numeralText, { fontSize: inner * 0.075 }]}>{h}</Text>
          </View>
        );
      })}

      {hand(((now.getHours() % 12) + now.getMinutes() / 60) / 12, c * 0.42, 8, Colors.ink900)}
      {hand(now.getMinutes() / 60, c * 0.62, 5, Colors.primary)}
      <View style={[styles.pin, { left: c - 8, top: c - 8 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    backgroundColor: Colors.white,
    borderWidth: BORDER,
    borderColor: Colors.primary,
    shadowColor: '#0063F3',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  numeral: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  numeralText: { fontFamily: FontFamily.displayBold, color: Colors.ink400 },
  pin: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.white,
    borderWidth: 4,
    borderColor: Colors.ink900,
  },
});
