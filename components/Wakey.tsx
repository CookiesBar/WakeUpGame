// Pop Wakey: the v3 mascot. Body parts are separate SVG layers moved with native transforms;
// the eyes are paths rebuilt every frame from a mood vector, so moods MORPH instead of swapping
// drawings (same method as Lazy Leo's leo.tsx). Canvas: design "Wakey v3 Mascot", page App v3.
import { useIsFocused } from 'expo-router';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { Pop } from '@/constants/pop';

// Curves first: worklets capture module constants when they are created.
const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1);
const EASE_IN_OUT = Easing.bezierFn(0.77, 0, 0.175, 1);

const { ink: INK, blue: BLUE, sun: SUN, mist: MIST, white: WHITE } = Pop;
const W = 400;
const H = 440;
const EYE_Y = 236;
const EYES = [168, 232] as const;
const MORPH = 380;
/** Idle loop; blink and glance timings divide it so the loop never jumps (Leo's). */
const PERIOD = 9600;

export type Mood = 'awake' | 'sleepy' | 'ringing' | 'happy' | 'snoozed' | 'proud' | 'think';
/** 0 eye w, 1 eye h, 2 lid top, 3 lid bottom, 4 tilt°, 5 pupil x, 6 pupil y, 7 pupil r, 8 star, 9 shut curve, 10 z, 11 shock, 12 sparkle */
export type MoodVector = readonly number[];

export const MOODS: Record<Mood, MoodVector> = {
  awake: [35, 39, -39, 39, 0, 0, 0, 17, 0, -6, 0, 0, 0],
  think: [35, 39, -39, 39, 0, -9, -14, 17, 0, -6, 0, 0, 0],
  sleepy: [35, 39, 3, 39, 0, -2, 19, 17, 0, -6, 1, 0, 0],
  snoozed: [35, 39, -6, 39, -7, 15, 6, 17, 0, -6, 0, 0, 0],
  ringing: [38, 44, -44, 44, 0, 0, 0, 8, 0, -6, 0, 1, 0],
  happy: [35, 39, 14, 14, 0, 0, 0, 17, 0, 16, 0, 0, 0],
  proud: [35, 39, -39, 39, 0, 0, 0, 23, 1, -6, 0, 0, 1],
};

/** A mood between two others, for states that change continuously (walk progress, a hold). */
export const mixMoods = (a: Mood, b: Mood, t: number): number[] => MOODS[a].map((v, i) => v + (MOODS[b][i] - v) * t);

type Key = readonly [number, number, 'out'?];
const BLINK: readonly Key[] = [
  [0, 0], [2100, 0], [2210, 1], [2250, 1], [2440, 0, 'out'],
  [5600, 0], [5710, 1], [5750, 1], [5940, 0, 'out'], [6080, 0], [6190, 1], [6230, 1], [6420, 0, 'out'], [PERIOD, 0],
];
const LOOK_X: readonly Key[] = [[0, 0], [2150, 0], [2650, -6], [3900, -6], [4400, 0], [5650, 0], [6150, 6], [7700, 6], [8200, 0], [PERIOD, 0]];
const LOOK_Y: readonly Key[] = [[0, 0], [2150, 0], [2650, 1], [3900, 1], [4400, 0], [5650, 0], [6150, -3], [7700, -3], [8200, 0], [PERIOD, 0]];

function track(t: number, keys: readonly Key[]): number {
  'worklet';
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const p = k1[0] > k0[0] ? (t - k0[0]) / (k1[0] - k0[0]) : 1;
      return k0[1] + (k1[1] - k0[1]) * (k1[2] === 'out' ? EASE_OUT(p) : EASE_IN_OUT(p));
    }
  }
  return keys[keys.length - 1][1];
}

/** An ellipse (cx, cy, rx, ry) cut by two horizontal lid lines (offsets from cy), rotated about (ox, oy). */
function band(cx: number, cy: number, rx: number, ry: number, top: number, bot: number, ox: number, oy: number, deg: number): string {
  'worklet';
  const t = Math.max(-ry, Math.min(ry, top));
  const b = Math.max(-ry, Math.min(ry, bot));
  if (b - t < 0.6) return 'M0 0';
  const rad = (deg * Math.PI) / 180;
  const cs = Math.cos(rad);
  const sn = Math.sin(rad);
  const P = (x: number, y: number) => {
    const dx = x - ox;
    const dy = y - oy;
    return `${(ox + dx * cs - dy * sn).toFixed(2)} ${(oy + dx * sn + dy * cs).toFixed(2)}`;
  };
  const wt = rx * Math.sqrt(Math.max(0, 1 - (t / ry) * (t / ry)));
  const wb = rx * Math.sqrt(Math.max(0, 1 - (b / ry) * (b / ry)));
  const A = `A${rx.toFixed(2)} ${ry.toFixed(2)} ${deg.toFixed(2)} 0 1 `;
  return `M${P(cx - wt, cy + t)}L${P(cx + wt, cy + t)}${A}${P(cx + wb, cy + b)}L${P(cx - wb, cy + b)}${A}${P(cx - wt, cy + t)}Z`;
}

/** A round pupil that pinches into a 4-point star as `star` goes 0 to 1. */
function starPupil(x: number, y: number, r: number, star: number): string {
  'worklet';
  const c = r * 0.914 * (1 - star) + 3 * star;
  const f = (n: number) => n.toFixed(2);
  return `M${f(x)} ${f(y - r)}Q${f(x + c)} ${f(y - c)} ${f(x + r)} ${f(y)}Q${f(x + c)} ${f(y + c)} ${f(x)} ${f(y + r)}Q${f(x - c)} ${f(y + c)} ${f(x - r)} ${f(y)}Q${f(x - c)} ${f(y - c)} ${f(x)} ${f(y - r)}Z`;
}

type Arms = 'down' | 'wave' | 'cheer';
const ARM_PATHS: Record<Arms, [string, [number, number], [number, number], string, [number, number], [number, number]]> = {
  // left path, left hand, left shoulder, right path, right hand, right shoulder
  down: ['M82 276Q58 288 46 308', [40, 316], [82, 276], 'M318 276Q342 288 354 308', [360, 316], [318, 276]],
  wave: ['M82 276Q58 288 46 308', [40, 316], [82, 276], 'M318 226Q340 206 348 178', [352, 170], [318, 226]],
  cheer: ['M82 226Q60 206 52 178', [48, 170], [82, 226], 'M318 226Q340 206 348 178', [352, 170], [318, 226]],
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A looping clock 0..period ms; frozen at 0 (a calm resting frame) when not live. */
function useLoopClock(period: number, live: boolean): SharedValue<number> {
  const clock = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(clock);
    clock.value = 0;
    if (!live) return;
    clock.value = withRepeat(
      withTiming(period, { duration: period, easing: Easing.linear, reduceMotion: ReduceMotion.Never }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
    return () => cancelAnimation(clock);
  }, [live, period, clock]);
  return clock;
}

/** One full-size SVG layer, moved as a whole by a native transform. */
function Layer({ size, style, children }: { size: number; style?: ComponentProps<typeof Animated.View>['style']; children: ReactNode }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width={size} height={(size * H) / W} viewBox={`0 0 ${W} ${H}`}>
        {children}
      </Svg>
    </Animated.View>
  );
}

function Bell({ x, a }: { x: number; a: number }) {
  const body = 'M-52 -16Q-55 -25 -46 -28C-44 -62 -26 -80 0 -80C26 -80 44 -62 46 -28Q55 -25 52 -16Z';
  return (
    <>
      <G transform={`translate(${x + 1} 130) rotate(${a})`}>
        <Rect x={-6} y={-24} width={12} height={38} rx={4} fill={INK} />
        <Circle cy={-90} r={11} fill={INK} />
        <Path d={body} fill={INK} stroke={INK} strokeWidth={11} />
      </G>
      <G transform={`translate(${x} 126) rotate(${a})`}>
        <Rect x={-6} y={-24} width={12} height={38} rx={4} fill={INK} />
        <Circle cy={-90} r={11} fill={INK} />
        <Path d={body} fill={SUN} stroke={INK} strokeWidth={11} strokeLinejoin="round" />
      </G>
    </>
  );
}

function Limb({ d, hand }: { d: string; hand: [number, number] }) {
  return (
    <>
      <Path d={d} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" transform="translate(1 3)" />
      <Path d={d} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />
      <Circle cx={hand[0] + 1} cy={hand[1] + 4} r={22} fill={INK} stroke={INK} strokeWidth={9} />
      <Circle cx={hand[0]} cy={hand[1]} r={22} fill={WHITE} stroke={INK} strokeWidth={9} />
    </>
  );
}

function Leg({ x1, x2, foot }: { x1: number; x2: number; foot: number }) {
  const d = `M${x1} 362L${x2} 394`;
  return (
    <>
      <Path d={d} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" transform="translate(1 3)" />
      <Path d={d} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />
      <Ellipse cx={foot + 1} cy={408} rx={30} ry={15} fill={INK} stroke={INK} strokeWidth={9} />
      <Ellipse cx={foot} cy={404} rx={30} ry={15} fill={WHITE} stroke={INK} strokeWidth={9} />
    </>
  );
}

export interface WakeyProps {
  /** A named mood, or a vector from `mixMoods` for in-between states. Changes morph in 380 ms. */
  mood?: Mood | MoodVector;
  size?: number;
  arms?: Arms;
  /** How hard he rings, 0 to 1 (bells, shake, shock lines, flailing arms). */
  ring?: number;
  /** Counts steps: each change lifts the next foot. */
  steps?: number;
  /** Change it to make him wave once. */
  wave?: number;
  /** Extra pupil offset in px (a target he watches, e.g. the time wheel spinning). */
  lookX?: SharedValue<number>;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export default function Wakey({
  mood = 'awake',
  size = 200,
  arms = 'wave',
  ring = 0,
  steps = 0,
  wave = 0,
  lookX,
  onPress,
  accessibilityLabel,
}: WakeyProps) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const live = !reduced && focused;
  const t = useLoopClock(PERIOD, live);
  const k = size / W;

  // --- mood morph -----------------------------------------------------------------
  const target = typeof mood === 'string' ? MOODS[mood] : mood;
  const targetKey = target.map(v => v.toFixed(2)).join(',');
  const from = useSharedValue<number[]>([...target]);
  const to = useSharedValue<number[]>([...target]);
  const p = useSharedValue(MORPH);
  useEffect(() => {
    const next = targetKey.split(',').map(Number);
    if (reduced) {
      from.value = next;
      to.value = next;
      p.value = MORPH;
      return;
    }
    // Interruptible: start from wherever the last morph had got to.
    const e = EASE_OUT(Math.min(1, p.value / MORPH));
    from.value = from.value.map((v, i) => v + (to.value[i] - v) * e);
    to.value = next;
    p.value = 0;
    p.value = withTiming(MORPH, { duration: MORPH, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
  }, [targetKey, reduced, from, to, p]);

  // --- ringing, steps, wave ----------------------------------------------------
  const amp = useSharedValue(ring);
  useEffect(() => {
    amp.value = withTiming(reduced ? 0 : ring, { duration: 300 });
  }, [ring, reduced, amp]);
  const lift = useSharedValue(0);
  const footSide = useSharedValue(0); // 1 = left foot steps
  useEffect(() => {
    if (steps === 0 || reduced) return;
    footSide.value = steps % 2;
    lift.value = withSequence(withTiming(1, { duration: 130 }), withTiming(0, { duration: 130 }));
  }, [steps, reduced, lift, footSide]);
  const waveT = useSharedValue(1);
  useEffect(() => {
    if (wave === 0 || reduced) return;
    waveT.value = 0;
    waveT.value = withTiming(1, { duration: 900, easing: Easing.linear });
  }, [wave, reduced, waveT]);

  const ms = (tt: number) => {
    'worklet';
    return tt / 1000;
  };

  // --- eye worklets --------------------------------------------------------------
  const vec = () => {
    'worklet';
    const e = EASE_OUT(Math.min(1, p.value / MORPH));
    return from.value.map((v, i) => v + (to.value[i] - v) * e);
  };
  const eyeAt = (j: number) => {
    'worklet';
    const v = vec();
    const tt = t.value;
    const blink = v[9] < 0 && tt > 0 ? track(tt, BLINK) : 0;
    let top = v[2];
    let bot = v[3];
    const m = top + 0.6 * (bot - top);
    top += blink * (m - top);
    bot -= blink * (bot - m);
    const gaze = 1 - v[8];
    let px = v[5] + gaze * track(tt, LOOK_X) + (lookX ? lookX.value : 0);
    let py = v[6] + gaze * track(tt, LOOK_Y);
    // Ringing: the pupils jitter with the bells.
    px += amp.value * 3 * Math.sin(ms(tt) * 2 * Math.PI * 11);
    const reach = Math.min(v[0], v[1]) - v[7] * 0.55;
    const d = Math.hypot(px, py);
    if (d > reach) {
      px = (px / d) * reach;
      py = (py / d) * reach;
    }
    return { cx: EYES[j], rx: v[0], ry: v[1], top, bot, deg: v[4], px, py, pr: v[7], star: v[8], curve: v[9] };
  };
  const white = (j: number) => () => {
    'worklet';
    const e = eyeAt(j);
    return { d: band(e.cx, EYE_Y, e.rx, e.ry, e.top, e.bot, e.cx, EYE_Y, e.deg) };
  };
  const pupil = (j: number) => () => {
    'worklet';
    const e = eyeAt(j);
    if (e.star > 0.001) return { d: starPupil(e.cx + e.px, EYE_Y + e.py, e.pr, e.star) };
    // A round pupil is cut by the same lid lines as the eye, so lids hide it without a clip path.
    return { d: band(e.cx + e.px, EYE_Y + e.py, e.pr, e.pr, e.top - e.py, e.bot - e.py, e.cx, EYE_Y, e.deg) };
  };
  const shut = (j: number) => () => {
    'worklet';
    const e = eyeAt(j);
    const closure = 1 - (Math.min(e.ry, e.bot) - Math.max(-e.ry, e.top)) / (2 * e.ry);
    const y = EYE_Y + (e.top + e.bot) / 2;
    const w = 0.62 * e.rx;
    return {
      d: `M${(e.cx - w).toFixed(2)} ${y.toFixed(2)}Q${e.cx} ${(y - 2 * e.curve).toFixed(2)} ${(e.cx + w).toFixed(2)} ${y.toFixed(2)}`,
      strokeOpacity: Math.max(0, Math.min(1, (closure - 0.86) / 0.14)),
    };
  };
  const dropL = useAnimatedProps(white(0));
  const dropR = useAnimatedProps(white(1));
  const lineL = useAnimatedProps(white(0));
  const lineR = useAnimatedProps(white(1));
  const fillL = useAnimatedProps(white(0));
  const fillR = useAnimatedProps(white(1));
  const pupilL = useAnimatedProps(pupil(0));
  const pupilR = useAnimatedProps(pupil(1));
  const shutL = useAnimatedProps(shut(0));
  const shutR = useAnimatedProps(shut(1));

  // --- body layers -----------------------------------------------------------------
  const [armL, handL, shL, armR, handR, shR] = ARM_PATHS[arms];
  const ringDeg = (sign: number, hz: number, deg: number) => {
    'worklet';
    return sign * amp.value * deg * Math.sin(ms(t.value) * 2 * Math.PI * hz);
  };
  const whole = useAnimatedStyle(() => ({ transform: [{ rotate: `${ringDeg(1, 9, 2)}deg` }] }));
  const bellL = useAnimatedStyle(() => ({ transform: [{ rotate: `${ringDeg(1, 7, 16)}deg` }] }));
  const bellR = useAnimatedStyle(() => ({ transform: [{ rotate: `${ringDeg(-1, 7, 16)}deg` }] }));
  const armLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${ringDeg(1, 3, 8)}deg` }] }));
  const armRStyle = useAnimatedStyle(() => {
    const w = waveT.value < 1 ? 14 * Math.sin(waveT.value * Math.PI * 3) * (1 - waveT.value) : 0;
    return { transform: [{ rotate: `${ringDeg(-1, 3, 8) + w}deg` }] };
  });
  const legL = useAnimatedStyle(() => ({ transform: [{ translateY: -14 * k * lift.value * footSide.value }] }));
  const legR = useAnimatedStyle(() => ({ transform: [{ translateY: -14 * k * lift.value * (1 - footSide.value) }] }));
  const zStyle = useAnimatedStyle(() => ({ opacity: vec()[10] }));
  const shockStyle = useAnimatedStyle(() => ({ opacity: Math.max(vec()[11], amp.value) }));
  const sparkStyle = useAnimatedStyle(() => ({ opacity: vec()[12] }));

  const origin = (x: number, y: number) => ({ transformOrigin: [x * k, y * k, 0] as [number, number, number] });
  const box = { width: size, height: (size * H) / W };

  const art = (
      <>
        <Layer size={size} style={legL}>
          <Leg x1={182} x2={177} foot={166} />
        </Layer>
        <Layer size={size} style={legR}>
          <Leg x1={218} x2={223} foot={234} />
        </Layer>
        <Layer size={size} style={[origin(124, 126), bellL]}>
          <Bell x={124} a={-30} />
        </Layer>
        <Layer size={size} style={[origin(276, 126), bellR]}>
          <Bell x={276} a={30} />
        </Layer>
        <Layer size={size} style={[origin(shL[0], shL[1]), armLStyle]}>
          <Limb d={armL} hand={handL} />
        </Layer>
        <Layer size={size} style={[origin(shR[0], shR[1]), armRStyle]}>
          <Limb d={armR} hand={handR} />
        </Layer>
        <Layer size={size}>
          <Circle cx={202} cy={244} r={132} fill={INK} stroke={INK} strokeWidth={16} />
          <Circle cx={200} cy={238} r={132} fill={BLUE} stroke={INK} strokeWidth={16} />
          <Circle cx={200} cy={238} r={94} fill={WHITE} stroke={INK} strokeWidth={12} />
          <G transform="translate(0 5)">
            <AnimatedPath animatedProps={dropL} fill={INK} stroke={INK} strokeWidth={11} strokeLinejoin="round" />
            <AnimatedPath animatedProps={dropR} fill={INK} stroke={INK} strokeWidth={11} strokeLinejoin="round" />
          </G>
          <AnimatedPath animatedProps={lineL} fill={INK} stroke={INK} strokeWidth={11} strokeLinejoin="round" />
          <AnimatedPath animatedProps={lineR} fill={INK} stroke={INK} strokeWidth={11} strokeLinejoin="round" />
          <AnimatedPath animatedProps={fillL} fill={MIST} />
          <AnimatedPath animatedProps={fillR} fill={MIST} />
          <AnimatedPath animatedProps={pupilL} fill={INK} />
          <AnimatedPath animatedProps={pupilR} fill={INK} />
          <AnimatedPath animatedProps={shutL} fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
          <AnimatedPath animatedProps={shutR} fill="none" stroke={INK} strokeWidth={14} strokeLinecap="round" />
        </Layer>
        <Layer size={size} style={zStyle}>
          <Path d="M318 104H344L318 130H344" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M352 68H370L352 86H370" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
        </Layer>
        <Layer size={size} style={shockStyle}>
          <G stroke={INK} strokeWidth={8} strokeLinecap="round">
            <Path d="M34 92L54 104" />
            <Path d="M24 128L48 130" />
            <Path d="M48 60L62 78" />
            <Path d="M366 92L346 104" />
            <Path d="M376 128L352 130" />
            <Path d="M352 60L338 78" />
          </G>
        </Layer>
        <Layer size={size} style={sparkStyle}>
          <G fill={INK}>
            <Path d="M304 43Q307 55 319 58Q307 61 304 73Q301 61 289 58Q301 55 304 43Z" />
            <Path d="M96 42Q99 49 106 52Q99 55 96 62Q93 55 86 52Q93 49 96 42Z" />
            <Path d="M386 227Q389 233 395 236Q389 239 386 245Q383 239 377 236Q383 233 386 227Z" />
          </G>
        </Layer>
      </>
  );

  const body = (
    <Animated.View style={[box, origin(200, 400), whole]} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {art}
    </Animated.View>
  );
  if (!onPress) return <View style={box}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={box} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {body}
    </Pressable>
  );
}
