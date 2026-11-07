// The paywall's hero: one night-to-morning loop seen through the arched window from the mascot sheet (pic1.svg).
// Night: the moon and twinkling stars in the window, the room dark, Wakey's face asleep with drifting Zzz.
// Dawn (slow, ~5 s): the moon sinks out of the window while the sun rises into it, the sky and the room lighten together.
// Morning: Wakey's bells ring (eyes open, normal pupils), then he looks around. Dusk: back to the moon, and he sleeps.
// Face only (no body). The phases run on a JS timer (Wakey's mood is a prop); the sky, room and discs follow one shared
// `day` value, so they stay in step. Reduce Motion: a still morning with Wakey awake.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import Wakey, { type Mood } from '@/components/Wakey';
import { WFont } from '@/constants/white';
import { bell, loop, seeded, useLoopClock, wave } from '@/utils/motion';

// Curves first: worklets capture what they reference when they are created.
const SKY_CURVE = Easing.bezier(0.45, 0, 0.55, 1); // a gentle, even sunrise
const NEVER = ReduceMotion.Never;

type Phase = 'night' | 'dawn' | 'ring' | 'awake' | 'dusk';
const PHASES: readonly (readonly [Phase, number])[] = [
  ['night', 3600],
  ['dawn', 5200],
  ['ring', 2400],
  ['awake', 3800],
  ['dusk', 4000],
];
const FIRST_NIGHT = 1400; // the first night is short, so the sunrise starts soon after the paywall opens
const MOOD: Record<Phase, Mood> = { night: 'sleepy', dawn: 'sleepy', ring: 'ringing', awake: 'awake', dusk: 'sleepy' };

/** Twinkle periods: each divides the 12 s clock, so the loop never jumps. */
const TWINKLE = [1500, 2000, 2400, 3000];
const STARS = Array.from({ length: 9 }, (_, i) => ({ x: 0.12 + seeded(i, 1) * 0.76, y: 0.1 + seeded(i, 2) * 0.5, r: 0.8 + seeded(i, 3) * 1.1 }));

/** The sheet's window: 155.38 × 228.1, a 4 px dark frame, a 4 px light rim, then glass (a semicircle on a rectangle). */
const WIN = { w: 155.38, h: 228.1, glass: 8 };
const FRAME = 'M77.69 4C118.39 4 151.38 36.99 151.38 77.69V224.1H4V77.69C4 36.99 36.99 4 77.69 4ZM77.69 0C34.85 0 0 34.85 0 77.69V228.1H155.38V77.69C155.38 34.85 120.53 0 77.69 0Z';
const RIM = 'M77.69 8C116.12 8 147.38 39.26 147.38 77.69V220.1H8V77.69C8 39.26 39.26 8 77.69 8ZM77.69 4C36.99 4 4 36.99 4 77.69V224.1H151.38V77.69C151.38 36.99 118.39 4 77.69 4Z';

export default function DayNight({ height, accessibilityLabel }: { height: number; accessibilityLabel: string }) {
  const reduced = useReducedMotion();
  const live = !reduced;
  const [phase, setPhase] = useState<Phase>(live ? 'night' : 'awake');
  const day = useSharedValue(live ? 0 : 1); // 0 night, 1 morning
  const zz = useSharedValue(live ? 1 : 0); // the Zzz
  const ringing = useSharedValue(0);
  const t = useLoopClock(12000, live); // twinkles, Zzz drift, sound arcs

  // The phase clock.
  useEffect(() => {
    if (!live) return;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const next = (ms: number) => {
      timer = setTimeout(() => {
        i = (i + 1) % PHASES.length;
        setPhase(PHASES[i][0]);
        next(PHASES[i][1]);
      }, ms);
    };
    next(FIRST_NIGHT);
    return () => clearTimeout(timer);
  }, [live]);

  useEffect(() => {
    if (!live) return;
    const d = PHASES.find(p => p[0] === phase)![1];
    const sky = (to: number) => withTiming(to, { duration: d, easing: SKY_CURVE, reduceMotion: NEVER });
    const fade = (to: number, delay = 0) => withDelay(delay, withTiming(to, { duration: 600, easing: SKY_CURVE, reduceMotion: NEVER }), NEVER);
    if (phase === 'dawn') {
      day.value = sky(1);
      zz.value = fade(0, d * 0.6);
    } else if (phase === 'dusk') {
      day.value = sky(0);
      zz.value = fade(1, d * 0.65);
    }
    ringing.value = fade(phase === 'ring' ? 1 : 0);
  }, [phase, live, day, zz, ringing]);

  // Morning: the bells ring in bursts, then he glances at the window and around.
  const [ring, setRing] = useState(0);
  const lookX = useSharedValue(0);
  useEffect(() => {
    if (phase === 'ring') {
      setRing(1);
      const timer = setInterval(() => setRing(r => (r ? 0 : 1)), 460);
      return () => clearInterval(timer);
    }
    if (phase === 'awake' && live) {
      let timer: ReturnType<typeof setTimeout>;
      let first = true;
      const glance = () => {
        const to = first ? -12 : (Math.random() * 2 - 1) * 12; // first toward the window (his right, our left)
        first = false;
        lookX.value = withTiming(to, { duration: 460, easing: SKY_CURVE, reduceMotion: NEVER });
        timer = setTimeout(glance, 900 + Math.random() * 700);
      };
      glance();
      return () => {
        clearTimeout(timer);
        lookX.value = withTiming(0, { duration: 460, easing: SKY_CURVE, reduceMotion: NEVER });
      };
    }
  }, [phase, live, lookX]);

  // Window size from the scene height; glass is the frame's inside.
  const winH = Math.round(height * 0.8);
  const k = winH / WIN.h;
  const winW = WIN.w * k;
  const glassW = (WIN.w - 2 * WIN.glass) * k;
  const glassH = (WIN.h - 2 * WIN.glass) * k;
  const disc = Math.round(glassW * 0.34);
  const travel = glassH * 0.75; // how far the moon sinks and the sun rises

  // Room and sky cross-fade with `day`; the dawn glow peaks halfway.
  const dayLayer = useAnimatedStyle(() => ({ opacity: day.value }));
  const dawnLayer = useAnimatedStyle(() => ({ opacity: Math.min(1, 4 * day.value * (1 - day.value)) }));
  const moon = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - 1.5 * day.value), transform: [{ translateY: travel * day.value }] }));
  const sun = useAnimatedStyle(() => ({ opacity: Math.min(1, day.value * 1.6), transform: [{ translateY: travel * (1 - day.value) }] }));
  const sunGlow = useAnimatedStyle(() => ({ opacity: 0.55 * day.value }));

  const face = Math.round(height * 0.62);
  return (
    <View style={[styles.scene, { height }]} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {/* The room */}
      <View style={[StyleSheet.absoluteFill, styles.roomNight]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.roomDay, dayLayer]} />

      {/* The window: glass (sky, stars, moon, sun) clipped to the arch, then the sheet's frame on top */}
      <View style={[styles.window, { width: winW, height: winH, left: height * 0.2, top: (height - winH) / 2 }]}>
        <View style={[styles.glass, { left: WIN.glass * k, top: WIN.glass * k, width: glassW, height: glassH, borderTopLeftRadius: glassW / 2, borderTopRightRadius: glassW / 2 }]}>
          <Sky colors={['#0B1240', '#2B3172']} />
          <Animated.View style={[StyleSheet.absoluteFill, dawnLayer]}>
            <Sky colors={['#5463B8', '#F7B07A']} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, dayLayer]}>
            <Sky colors={['#FFE27A', '#FFF7D6']} />
          </Animated.View>
          {STARS.map((s, i) => (
            <Star key={i} t={t} day={day} i={i} style={{ left: s.x * glassW, top: s.y * glassH, width: s.r * 2, height: s.r * 2, borderRadius: s.r }} />
          ))}
          <Animated.View style={[styles.disc, styles.moon, { width: disc, height: disc, borderRadius: disc / 2, left: glassW * 0.58, top: glassH * 0.12 }, moon]}>
            <View style={[styles.crater, { width: disc * 0.22, height: disc * 0.22, left: disc * 0.22, top: disc * 0.3 }]} />
            <View style={[styles.crater, { width: disc * 0.14, height: disc * 0.14, left: disc * 0.56, top: disc * 0.58 }]} />
          </Animated.View>
          <Animated.View style={[styles.disc, { width: disc * 1.5, height: disc * 1.5, left: glassW * 0.3 - disc * 0.75, top: glassH * 0.2 - disc * 0.25 }, sun]}>
            <Animated.View style={[styles.sunGlow, { borderRadius: disc }, sunGlow]} />
            <View style={[styles.sun, { width: disc, height: disc, borderRadius: disc / 2, left: disc * 0.25, top: disc * 0.25 }]} />
          </Animated.View>
        </View>
        <Svg style={StyleSheet.absoluteFill} width={winW} height={winH} viewBox={`0 0 ${WIN.w} ${WIN.h}`}>
          <Path d={FRAME} fill="#3069CE" />
          <Path d={RIM} fill="#54A8FF" />
        </Svg>
      </View>

      {/* Wakey's face, Zzz and sound arcs around it */}
      <View style={[styles.wakey, { right: height * 0.3, top: (height - face) / 2 + height * 0.04 }]}>
        <Wakey head size={face} mood={MOOD[phase]} ring={ring} lookX={lookX} />
        <View style={[styles.zzz, { left: face * 0.82, top: -face * 0.06 }]} pointerEvents="none">
          {[0, 1, 2].map(i => (
            <Z key={i} i={i} t={t} zz={zz} day={day} />
          ))}
        </View>
        <Arcs side={-1} t={t} on={ringing} style={{ left: -face * 0.2, top: face * 0.02 }} />
        <Arcs side={1} t={t} on={ringing} style={{ left: face * 1.02, top: face * 0.02 }} />
      </View>
    </View>
  );
}

function Sky({ colors }: { colors: [string, string] }) {
  const id = `sky${colors[0].slice(1)}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors[0]} />
          <Stop offset="1" stopColor={colors[1]} />
        </LinearGradient>
      </Defs>
      <Rect width="10" height="10" fill={`url(#${id})`} />
    </Svg>
  );
}

function Star({ t, day, i, style }: { t: SharedValue<number>; day: SharedValue<number>; i: number; style: object }) {
  const anim = useAnimatedStyle(() => ({ opacity: (1 - day.value) * (0.35 + 0.65 * (0.5 + 0.5 * wave(t.value, TWINKLE[i % 4], seeded(i, 4)))) }));
  return <Animated.View style={[styles.star, style, anim]} />;
}

/** One "z": drifts up and out from his head, growing, fading in and out (white at night, ink by day). */
function Z({ i, t, zz, day }: { i: number; t: SharedValue<number>; zz: SharedValue<number>; day: SharedValue<number> }) {
  const anim = useAnimatedStyle(() => {
    const p = loop(t.value, 2400, i / 3);
    return {
      opacity: zz.value * bell(p),
      color: day.value > 0.5 ? '#3B4560' : '#FFFFFF',
      transform: [{ translateX: 4 + 18 * p }, { translateY: -30 * p }, { scale: 0.6 + 0.6 * p }],
    };
  });
  return <Animated.Text style={[styles.z, anim]}>z</Animated.Text>;
}

/** Three sound arcs beside a bell, pulsing outward while he rings. */
function Arcs({ side, t, on, style }: { side: 1 | -1; t: SharedValue<number>; on: SharedValue<number>; style: object }) {
  const anim = useAnimatedStyle(() => {
    const k = 0.5 + 0.5 * wave(t.value, 200);
    return { opacity: on.value * (0.55 + 0.45 * k), transform: [{ translateX: side * 3 * k }] };
  });
  return (
    <Animated.View style={[styles.arcs, style, anim]} pointerEvents="none">
      <Svg width={22} height={34} viewBox="0 0 22 34" style={side < 0 ? styles.flip : undefined}>
        {[8, 14, 20].map(r => (
          <Path key={r} d={arc(r)} stroke="#2D6CE7" strokeWidth={2.6} strokeLinecap="round" fill="none" />
        ))}
      </Svg>
    </Animated.View>
  );
}
/** An arc of radius r opening to the right, ±38° around the horizontal, centred at (0, 17). */
const arc = (r: number) => {
  const a = (38 * Math.PI) / 180;
  const x = r * Math.cos(a), y = r * Math.sin(a);
  return `M ${x.toFixed(2)} ${(17 - y).toFixed(2)} A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${(17 + y).toFixed(2)}`;
};

const styles = StyleSheet.create({
  scene: { overflow: 'hidden', borderRadius: 26 },
  roomNight: { backgroundColor: '#1D2452' },
  roomDay: { backgroundColor: '#E6EEFF' },
  window: { position: 'absolute' },
  glass: { position: 'absolute', overflow: 'hidden' },
  star: { position: 'absolute', backgroundColor: '#FFFFFF' },
  disc: { position: 'absolute' },
  moon: { backgroundColor: '#F4F1E6' },
  crater: { position: 'absolute', borderRadius: 999, backgroundColor: '#E2DDCB' },
  sun: { position: 'absolute', backgroundColor: '#FFBC00' },
  sunGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFD36B' },
  wakey: { position: 'absolute' },
  zzz: { position: 'absolute', width: 40, height: 40 },
  z: { position: 'absolute', left: 0, bottom: 0, fontFamily: WFont.heavy, fontSize: 18 },
  arcs: { position: 'absolute' },
  flip: { transform: [{ scaleX: -1 }] },
});
