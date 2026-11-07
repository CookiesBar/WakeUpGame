// Wakey, the v3 mascot: a round alarm clock with two bells, a clock-dial face and noodle limbs.
// Art and rules: assets/mascots/face-rig/ (MOTION.md Part 2 wins over everything). Data: ./wakey/rig.ts (generated).
// Layer method: the head, bells and hands are static SVG layers turned by native transforms at their pivots, and
// the limbs are plain views nested at their joints, so nothing redraws while he walks. Only the two small face
// canvases (eyes, mouth) redraw, and only while an expression morphs, the pupils glide or he blinks.
// What moves: expressions morph point by point (380 ms, the rig's fade rule), blinks and glances; `ring` rings the
// bells in one burst; `wave` waves the near hand; `steps` plays the walk with a live face. The hands rest at 8:00.
import { useIsFocused } from 'expo-router';
import { Fragment, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';
import { scheduleOnUI } from 'react-native-worklets';

import { EASE_IN_OUT, EASE_OUT } from '@/utils/motion';

import { ART, EYES, MOUTH, PIVOT, VIEWBOX, WALK, type EyeName, type Family, type MouthName } from './wakey/rig';
import { JOINT, mixPose, solve, standPose, walkPose } from './wakey/walk';

// Curves and data first: worklets capture what they reference when they are created.
const [VX, VY, VW, VH] = VIEWBOX;
const MORPH = 380;
const NEVER = ReduceMotion.Never; // the caller decides (`live`); Reanimated must not skip on its own
const LINEAR = { easing: Easing.linear, reduceMotion: NEVER };
const IN_OUT = { easing: EASE_IN_OUT, reduceMotion: NEVER };
const PERIOD = WALK.tokens.period;
const REST = WALK.restFrameMs; // Reduce Motion holds this walk frame (pic5's stride)
const STEP = PERIOD / 2;

/** Tune here ("calmer" = smaller numbers). Face-rig units, degrees, ms. */
const T = {
  /** Keep walking this long after the last counted step: the iOS pedometer reports in batches every 1-3 s. */
  walkHold: 2500,
  /** Pupil range (the white allows 8 sideways, 11 up or down) and how far `lookX` moves them per unit. */
  pupil: [8, 11] as const,
  look: 0.47,
  /** Idle life while standing: a blink every 2.6-4.6 s (sometimes two), glances that hold 0.9-1.8 s. */
  blinkEvery: [2600, 2000] as const,
  doubleBlink: 0.15,
  blink: WALK.tokens.face.blink, // close, hold, reopen
  glance: { wait: [1200, 1400], hold: [900, 900], x: [2.5, 3.5], y: [-3, 4], glide: 450 },
  /** The `ring` burst (preview.html's): 4 cycles, 5°, 450 ms, under a sine envelope. */
  ring: { deg: 5, cycles: 4, ms: 450 },
  /** While the bells ring, the whole clock rocks on its feet with them, at this share of the bells' angle (an alarm clock going off). */
  rattle: 1,
  /** The `wave`: two waves of the near forearm over 900 ms. */
  wave: { deg: 16, cycles: 2, ms: 900 },
};

/** Standing arms: [far upper°, far elbow°, near upper°, near elbow°], clockwise from hanging down (+ = toward the left). */
type Arms = 'down' | 'wave' | 'cheer';
const ARMS: Record<Arms, readonly number[]> = {
  down: [8, 10, -8, 8],
  wave: [8, 10, -130, -40],
  cheer: [125, 30, -125, -30],
};

export type Mood = 'awake' | 'sleepy' | 'ringing' | 'happy' | 'snoozed' | 'proud' | 'think' | 'alarm';
const MOOD_LIST: Mood[] = ['awake', 'sleepy', 'ringing', 'happy', 'snoozed', 'proud', 'think', 'alarm'];
/** Each mood is one rig expression (eyes + mouth) plus how much the idle glances move the pupils. */
const FACE: Record<Mood, { eyes: EyeName; mouth: MouthName; gaze: number }> = {
  awake: { eyes: 'neutral', mouth: 'smile', gaze: 1 },
  think: { eyes: 'look-up', mouth: 'flat', gaze: 0.35 },
  // The rig's half-lid and squint read as annoyed at app sizes: asleep (pic 1) and a downcast look stay gentle.
  sleepy: { eyes: 'asleep', mouth: 'sleepy', gaze: 0 },
  snoozed: { eyes: 'look-down', mouth: 'flat', gaze: 0.4 },
  // Normal open eyes, not 'surprised-wide': its small pupils looked odd while the bells ring (user, 2026-11-07).
  ringing: { eyes: 'neutral', mouth: 'open-shout', gaze: 0.5 },
  happy: { eyes: 'happy-closed', mouth: 'open-shout', gaze: 0 },
  proud: { eyes: 'happy-closed', mouth: 'smile', gaze: 0 },
  // The sheet's Alarm pose: eyes squeezed shut under wavy brows, shouting (its SNOOZE plate is left out).
  alarm: { eyes: 'scrunched', mouth: 'open-shout', gaze: 0 },
};

/**
 * The sheet's Alarm pose (mascot sheet, pose-alarm.svg: the rig's own art moved by ALARM.offset): arms flung out
 * and up, the far leg kicked out, standing on the near foot. Body-pose targets in face-rig units (see walk.ts Pose).
 * `b` (-1..1) is the ring burst: the arms flap and the kicked leg flutters with it.
 */
const ALARM = {
  offset: [-60.3, -28.5], // pose-alarm.svg → face-rig units
  arms: [113, 14, -103, -10],
  kick: [17, 340],
  stand: [236, 389],
  flap: [10, 28], // upper arm°, elbow° at the burst's peak
  flutter: 6,
};
function alarmPose(b: number): number[] {
  'worklet';
  const [lu, le, ru, re] = ALARM.arms;
  const [fu, fe] = ALARM.flap;
  const f = ALARM.flutter * b;
  return [0, 0, 0, ALARM.kick[0] - f, ALARM.kick[1] - f, 0, ALARM.stand[0], ALARM.stand[1], 0, lu + fu * b, le + fe * b, ru - fu * b, re - fe * b, 0, 0, 0, 1];
}
/** The pose's shake lines by the bells and its two lightning bolts, in pose-alarm.svg units. */
const ALARM_SUN = '#FFBC00';
const ALARM_LINES = [
  'M70.0222 83.4902C70.0222 83.4902 57.8121 106.54 65.9621 124.41',
  'M178.292 53.8008C178.292 53.8008 210.242 63.8908 202.092 77.1208',
  'M272.812 56.8496C272.812 56.8496 254.451 68.5396 262.011 86.6196',
  'M376.062 133.27C376.062 133.27 371.192 164.479 347.432 159.609',
];
const ALARM_BOLTS = [
  'M411.752 33.1602L377.252 47.2502L392.942 66.9502L361.632 83.8501L410.692 74.5302L396.852 51.2302L425.452 44.1102L411.752 33.1602Z',
  'M19.9426 272.309L57.0825 269.149L47.9825 245.669L82.9026 238.869L33.3026 233.129L39.5626 259.499L10.1426 257.769L19.9426 272.309Z',
];
/** Weights over the moods (in MOOD_LIST order). Blended moods blend the rig shapes point by point. */
export type MoodVector = readonly number[];
export const MOODS = MOOD_LIST.reduce((o, m) => ({ ...o, [m]: MOOD_LIST.map(x => (x === m ? 1 : 0)) }), {} as Record<Mood, MoodVector>);
/** A mood between two others, for states that change continuously (walk progress, a hold). */
export const mixMoods = (a: Mood, b: Mood, t: number): number[] => MOODS[a].map((v, i) => v + (MOODS[b][i] - v) * t);

/** Per target path: its numbers, then its opacity (rig.ts layout). */
type Shapes = number[][];
function blend<N extends string>(fam: Family<N>, parts: readonly (readonly [N, number])[]): Shapes {
  const sum = parts.reduce((s, [, w]) => s + w, 0) || 1;
  return fam.shapes[parts[0][0]].map((row, i) => row.map((_, j) => parts.reduce((s, [n, w]) => s + fam.shapes[n][i][j] * w, 0) / sum));
}
const moodParts = <K extends 'eyes' | 'mouth'>(v: readonly number[], key: K) =>
  MOOD_LIST.map((m, i) => [FACE[m][key], v[i] ?? 0] as const).filter(([, w]) => w > 0.001) as unknown as readonly (readonly [(typeof FACE)[Mood][K], number])[];
const one = <N extends string>(fam: Family<N>, n: N) => blend(fam, [[n, 1]]);
const WALK_FACE = { neutral: one(EYES, 'neutral'), happy: one(EYES, 'happy-closed'), smile: one(MOUTH, 'smile'), open: one(MOUTH, 'open-shout') };
const idx = (fam: Family<string>, id: string) => fam.targets.indexOf(id);

function clamp01(x: number): number {
  'worklet';
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
/** Value j of a morph from a to b at eased progress e. The last value is opacity: it rises over the last 40%, falls over the first 40%. */
function morphAt(a: number[], b: number[], j: number, e: number): number {
  'worklet';
  const n = b.length - 1;
  if (j < n) return a[j] + (b[j] - a[j]) * e;
  return a[n] + (b[n] - a[n]) * (b[n] > a[n] ? clamp01((e - 0.6) / 0.4) : clamp01(e / 0.4));
}
function morphAll(from: Shapes, to: Shapes, p: number): Shapes {
  'worklet';
  const e = EASE_IN_OUT(p);
  return to.map((b, i) => b.map((_, j) => morphAt(from[i], b, j, e)));
}
/** An SVG path from a command signature ('MCCCCZ') and its numbers, every point moved by (dx, dy). */
function pathOf(cmds: string, n: number[], dx: number, dy: number): string {
  'worklet';
  let s = '';
  let j = 0;
  for (let c = 0; c < cmds.length; c++) {
    const ch = cmds[c];
    const pts = ch === 'C' ? 3 : ch === 'Z' ? 0 : 1;
    s += ch;
    for (let q = 0; q < pts; q++, j += 2) s += `${q ? ' ' : ''}${(n[j] + dx).toFixed(2)} ${(n[j + 1] + dy).toFixed(2)}`;
  }
  return s;
}

type Morph = { from: SharedValue<Shapes>; to: SharedValue<Shapes>; p: SharedValue<number> };
function useMorph(initial: Shapes) {
  const from = useSharedValue(initial);
  const to = useSharedValue(initial);
  const p = useSharedValue(1);
  return useRef({
    m: { from, to, p } as Morph,
    /** Morph to `next` in 380 ms from wherever the face is now (or jump there). */
    go(next: Shapes, animate: boolean) {
      scheduleOnUI(
        (n: Shapes, anim: boolean) => {
          'worklet';
          from.value = anim ? morphAll(from.value, to.value, p.value) : n;
          to.value = n;
          p.value = anim ? 0 : 1;
          if (anim) p.value = withTiming(1, { duration: MORPH, ...LINEAR });
        },
        next,
        animate,
      );
    },
  }).current;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
type Look = { gx: SharedValue<number>; gy: SharedValue<number>; look?: SharedValue<number> };

/** One live rig path. `pupil` glides it, `blink` closes it toward the blink-closed shape, `clip` drops paint and opacity. */
function Shape({ m, fam, i, pupil, blink, clip }: { m: Morph; fam: Family<string>; i: number; pupil?: Look; blink?: SharedValue<number>; clip?: boolean }) {
  const cmds = fam.cmds[i];
  const closed = blink ? EYES.shapes['blink-closed'][i] : null;
  const [px, py] = T.pupil;
  const props = useAnimatedProps(() => {
    const e = EASE_IN_OUT(m.p.value);
    const a = m.from.value[i];
    const b = m.to.value[i];
    let n = b.map((_, j) => morphAt(a, b, j, e));
    if (blink && closed) {
      const k = blink.value;
      if (k > 0) n = n.map((v, j) => (j < n.length - 1 ? v + (closed[j] - v) * k : morphAt(n, closed, j, k)));
    }
    let dx = 0;
    let dy = 0;
    if (pupil) {
      const look = pupil.look ? pupil.look.value : 0;
      // While he watches a target, the idle glances step aside.
      dx = pupil.gx.value * (1 - Math.min(1, Math.abs(look) / 6)) + look * T.look;
      dy = pupil.gy.value;
      const over = Math.hypot(dx / px, dy / py);
      if (over > 1) {
        dx /= over;
        dy /= over;
      }
    }
    const d = pathOf(cmds, n, dx, dy);
    return { d, opacity: clip ? 1 : n[n.length - 1] };
  });
  return <AnimatedPath animatedProps={props} {...(clip ? {} : { fill: 'none', ...fam.style[i] })} />;
}

type Box = readonly [number, number, number, number];
type AnyStyle = ComponentProps<typeof Animated.View>['style'];
/** A layer of the body: an SVG cropped to `box` (face-rig units), moved as a whole by a native transform. */
function Layer({ k, box = VIEWBOX, style, children }: { k: number; box?: Box; style?: AnyStyle; children: ReactNode }) {
  const [x, y, w, h] = box;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg style={{ position: 'absolute', left: (x - VX) * k, top: (y - VY) * k }} width={w * k} height={h * k} viewBox={`${x} ${y} ${w} ${h}`}>
        {children}
      </Svg>
    </Animated.View>
  );
}
const paths = (list: readonly (readonly [string, string])[]) => list.map(([d, fill], i) => <Path key={i} d={d} fill={fill} />);
/** Crops of the two face canvases: they redraw while the face moves, so they stay small. */
const EYE_BOX: Box = [80, 105, 140, 92];
const MOUTH_BOX: Box = [110, 185, 80, 66];

/** A round-capped noodle `len` px long hanging from its joint (x, y, in its parent's px), turned at the joint by `style`. */
function Bone({ x, y, len, w, color, style, children }: { x: number; y: number; len: number; w: number; color: string; style: AnyStyle; children?: ReactNode }) {
  return (
    <Animated.View style={[{ position: 'absolute', left: x - w / 2, top: y - w / 2, width: w, height: len + w, borderRadius: w / 2, backgroundColor: color, transformOrigin: [w / 2, w / 2, 0] }, style]}>
      {children}
    </Animated.View>
  );
}
/** A foot: a short noodle pointing left from the ankle at the end of its shin. */
function Foot({ len, f, w, color, style }: { len: number; f: number; w: number; color: string; style: AnyStyle }) {
  return <Animated.View style={[{ position: 'absolute', left: -f, top: len, width: f + w, height: w, borderRadius: w / 2, backgroundColor: color, transformOrigin: [f + w / 2, w / 2, 0] }, style]} />;
}

function useTurn(pose: SharedValue<number[]>, i: number) {
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${pose.value[i]}deg` }] }));
}
function burstAt(p: number, amp: number): number {
  'worklet';
  if (p >= 1) return 0;
  return amp * T.ring.deg * Math.sin(p * T.ring.cycles * 2 * Math.PI) * Math.sin(p * Math.PI);
}

export interface WakeyProps {
  /** A named mood, or a vector from `mixMoods` for in-between states. Changes morph in 380 ms. */
  mood?: Mood | MoodVector;
  size?: number;
  /** Standing arms. While he walks, the arms swing with the walk instead. */
  arms?: Arms;
  /** How hard he rings, 0 to 1: each rise rings the bells once (one short burst, then rest). */
  ring?: number;
  /** Counts steps: while it keeps changing he walks; when it stops he finishes the step and stands. */
  steps?: number;
  /** Walk regardless of `steps`: the user is moving (motion detected) even between pedometer reports. */
  walk?: boolean;
  /** The sheet's Alarm pose instead of standing (`arms` is ignored); with `ring`, every burst shakes it and flashes its shake lines. Pair with mood "alarm". */
  alarm?: boolean;
  /** Change it to make him wave once. */
  wave?: number;
  /** Extra pupil offset (±14 is a strong glance), e.g. toward the key you hit. */
  lookX?: SharedValue<number>;
  /** Face only (streak card, the sum): no body or limbs, cropped to the head; `size` is its width. */
  head?: boolean;
  /** Point the clock hands at this time instead of resting at 8:00 (the streak card shows the real time). */
  time?: Date;
  onPress?: () => void;
  accessibilityLabel?: string;
}

/** The head-only crop in face-rig units: bells to chin. */
const HEAD: Box = [13, 11, 300, 304];

export default function Wakey({ mood = 'awake', size = 200, arms = 'wave', ring = 0, steps = 0, walk = false, alarm = false, wave = 0, lookX, head = false, time, onPress, accessibilityLabel }: WakeyProps) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const live = !reduced && focused;
  const k = size / (head ? HEAD[2] : VW);
  const uid = useId().replace(/\W/g, '');

  // --- walking: while `steps` keeps changing, or while the caller says the user is moving ---
  const [stepping, setStepping] = useState(false);
  useEffect(() => {
    if (!steps) return setStepping(false);
    setStepping(true);
    const timer = setTimeout(() => setStepping(false), T.walkHold);
    return () => clearTimeout(timer);
  }, [steps]);
  const walking = stepping || walk;

  const clock = useSharedValue(reduced ? REST : 0); // walk time, ms
  const walkW = useSharedValue(0); // 0 standing, 1 walking
  useEffect(() => {
    cancelAnimation(clock);
    cancelAnimation(walkW);
    if (reduced) {
      clock.value = REST;
      walkW.value = walking ? 1 : 0;
      return;
    }
    if (!focused) return; // off screen: hold still where he is
    if (walking) {
      // withRepeat restarts from the start value each lap: a whole period later, so the pose is the same.
      const t0 = clock.value;
      clock.value = withRepeat(withTiming(t0 + PERIOD, { duration: PERIOD, ...LINEAR }), -1, false, undefined, NEVER);
      walkW.value = withTiming(1, { duration: MORPH, ...IN_OUT });
    } else if (walkW.value > 0) {
      // Finish the step (walk on to the next heel strike), then settle into standing.
      const t0 = clock.value;
      const end = Math.ceil(t0 / STEP) * STEP;
      clock.value = withTiming(end, { duration: end - t0, ...LINEAR });
      walkW.value = withDelay(end - t0, withTiming(0, { duration: MORPH, ...IN_OUT }), NEVER);
    }
  }, [walking, reduced, focused, clock, walkW]);

  // --- arms, wave, ring ---------------------------------------------------------------------
  const armFrom = useSharedValue<readonly number[]>(ARMS[arms]);
  const armTo = useSharedValue<readonly number[]>(ARMS[arms]);
  const armP = useSharedValue(1);
  useEffect(() => {
    const next = ARMS[arms];
    scheduleOnUI(
      (n: readonly number[], anim: boolean) => {
        'worklet';
        const e = EASE_IN_OUT(armP.value);
        armFrom.value = anim ? armTo.value.map((v, i) => armFrom.value[i] + (v - armFrom.value[i]) * e) : n;
        armTo.value = n;
        armP.value = anim ? 0 : 1;
        if (anim) armP.value = withTiming(1, { duration: MORPH, ...LINEAR });
      },
      next,
      live,
    );
  }, [arms, live, armFrom, armTo, armP]);

  const waveT = useSharedValue(1);
  useEffect(() => {
    if (!wave || !live) return;
    waveT.value = 0;
    waveT.value = withTiming(1, { duration: T.wave.ms, ...LINEAR });
  }, [wave, live, waveT]);

  const burst = useSharedValue(1);
  const burstAmp = useSharedValue(0);
  const lastRing = useRef(0);
  useEffect(() => {
    const rose = ring > lastRing.current + 0.05;
    lastRing.current = ring;
    if (!rose || !live) return;
    burstAmp.value = ring;
    burst.value = 0;
    burst.value = withTiming(1, { duration: T.ring.ms, ...LINEAR });
  }, [ring, live, burst, burstAmp]);

  // --- the body: one pose a frame, solved to joint rotations -------------------------------
  const pose = useDerivedValue(() => {
    const e = EASE_IN_OUT(armP.value);
    const a = armTo.value.map((v, i) => armFrom.value[i] + (v - armFrom.value[i]) * e);
    const q = waveT.value;
    if (q < 1) a[3] += T.wave.deg * Math.sin(q * T.wave.cycles * 2 * Math.PI) * Math.sin(q * Math.PI);
    const w = walkW.value;
    const stand = alarm ? alarmPose(burstAt(burst.value, burstAmp.value) / T.ring.deg) : standPose(a);
    return solve(w > 0 ? mixPose(stand, walkPose(clock.value), w) : stand);
  });
  const [PX, PY] = PIVOT.hub;
  const body = useAnimatedStyle(() => ({ transform: [{ translateX: pose.value[0] * k }, { translateY: pose.value[1] * k }, { rotate: `${pose.value[2]}deg` }] }), [k]);
  const rattle = useAnimatedStyle(() => ({ transform: [{ rotate: `${T.rattle * burstAt(burst.value, burstAmp.value)}deg` }] }));
  // The Alarm pose's shake lines flash with each burst; still (Reduce Motion), they just stay, as on the sheet.
  const flash = useAnimatedStyle(() => ({ opacity: live ? (burst.value < 1 ? burstAmp.value * Math.sin(burst.value * Math.PI) : 0) : 1 }), [live]);
  const thighL = useTurn(pose, 3);
  const shinL = useTurn(pose, 4);
  const footL = useTurn(pose, 5);
  const thighR = useTurn(pose, 6);
  const shinR = useTurn(pose, 7);
  const footR = useTurn(pose, 8);
  const upperL = useTurn(pose, 9);
  const foreL = useTurn(pose, 10);
  const upperR = useTurn(pose, 11);
  const foreR = useTurn(pose, 12);
  const bellL = useAnimatedStyle(() => ({ transform: [{ rotate: `${pose.value[13] + burstAt(burst.value, burstAmp.value)}deg` }] }));
  const bellR = useAnimatedStyle(() => ({ transform: [{ rotate: `${pose.value[14] - burstAt(burst.value, burstAmp.value)}deg` }] }));
  const SH = JOINT.shadow;
  const shadow = useAnimatedStyle(() => ({ transform: [{ translateX: pose.value[15] * k }, { scaleX: pose.value[16] }] }), [k]);

  // --- the face: mood (or the live walk face), blinks, glances ------------------------------
  const vec = typeof mood === 'string' ? MOODS[mood] : mood;
  const moodKey = vec.map(v => v.toFixed(3)).join(',');
  const gazeAmt = MOOD_LIST.reduce((s, m, i) => s + (vec[i] ?? 0) * FACE[m].gaze, 0);
  const shut = (e: EyeName) => e === 'happy-closed' || e === 'asleep' || e === 'scrunched';
  const blinkable = MOOD_LIST.reduce((s, m, i) => s + (vec[i] ?? 0) * (shut(FACE[m].eyes) ? 0 : 1), 0) > 0.5;
  const eyes = useMorph(blend(EYES, moodParts(vec, 'eyes')));
  const mouth = useMorph(blend(MOUTH, moodParts(vec, 'mouth')));
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const blink = useSharedValue(0);
  const walkFace = live && walking;

  useEffect(() => {
    if (walking) {
      // The walk has its own face: live below, or held still (neutral, closed smile) under Reduce Motion / off screen.
      if (!live) {
        eyes.go(WALK_FACE.neutral, false);
        mouth.go(WALK_FACE.smile, false);
      }
      return;
    }
    const v = moodKey.split(',').map(Number);
    eyes.go(blend(EYES, moodParts(v, 'eyes')), live);
    mouth.go(blend(MOUTH, moodParts(v, 'mouth')), live);
  }, [moodKey, walking, live, eyes, mouth]);

  useEffect(() => {
    const glide = (x: number, y: number, ms: number) => {
      gx.value = withTiming(x, { duration: ms, ...IN_OUT });
      gy.value = withTiming(y, { duration: ms, ...IN_OUT });
    };
    if (!live) {
      cancelAnimation(gx);
      cancelAnimation(gy);
      cancelAnimation(blink);
      gx.value = 0;
      gy.value = 0;
      blink.value = 0;
      return;
    }
    let on = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(() => on && fn(), ms));
    const rnd = (a: number, span: number) => a + Math.random() * span;
    const [close, hold, open] = T.blink;
    const blinkOnce = () => {
      blink.value = withSequence(
        withTiming(1, { duration: close, ...IN_OUT }),
        withTiming(1, { duration: hold, ...LINEAR }),
        withTiming(0, { duration: open, easing: EASE_OUT, reduceMotion: NEVER }),
      );
    };

    if (walkFace) {
      // The live walk face (walk-cycle.json "face" rules), on its own clock: eyes and mouth change independently.
      type Eye = { happy: boolean; gx: number; gy: number };
      let cur: Eye = { happy: false, gx: 0, gy: 0 };
      let lastBlink = -Infinity;
      eyes.go(WALK_FACE.neutral, true);
      mouth.go(WALK_FACE.smile, true);
      glide(0, 0, MORPH);
      const gazeFrom = (prev: { gx: number; gy: number }): Eye => {
        if ((prev.gx !== 0 || prev.gy !== 0) && Math.random() < 0.2) return { happy: false, gx: 0, gy: 0 };
        for (;;) {
          const g = { happy: false, gx: rnd(-8, 14), gy: rnd(-7, 15) };
          if (Math.hypot(g.gx - prev.gx, g.gy - prev.gy) >= 4.5) return g;
        }
      };
      const eyeStep = () => {
        const holdMs = cur.happy ? rnd(1300, 900) : rnd(1100, 1300);
        if (!cur.happy && Date.now() - lastBlink > 2600 && holdMs > 900) {
          later(rnd(300, holdMs - 700), () => {
            lastBlink = Date.now();
            blinkOnce();
          });
        }
        later(holdMs, () => {
          const next = cur.happy ? gazeFrom({ gx: 9, gy: 9 }) : Math.random() < 0.32 ? { happy: true, gx: 0, gy: 0 } : gazeFrom(cur);
          const swap = next.happy !== cur.happy;
          if (swap) eyes.go(next.happy ? WALK_FACE.happy : WALK_FACE.neutral, true);
          glide(next.gx, next.gy, swap ? MORPH : T.glance.glide);
          cur = next;
          later(swap ? MORPH : T.glance.glide, eyeStep);
        });
      };
      eyeStep();
      let openMouth = false;
      const mouthStep = () =>
        later(openMouth ? rnd(1100, 1400) : rnd(1700, 2000), () => {
          openMouth = !openMouth;
          mouth.go(openMouth ? WALK_FACE.open : WALK_FACE.smile, true);
          later(MORPH, mouthStep);
        });
      mouthStep();
    } else {
      // Standing: blinks every few seconds and calm glances, scaled by the mood.
      glide(0, 0, MORPH);
      if (blinkable) {
        const blinkStep = () =>
          later(rnd(T.blinkEvery[0], T.blinkEvery[1]), () => {
            blinkOnce();
            if (Math.random() < T.doubleBlink) later(close + hold + open + 120, blinkOnce);
            blinkStep();
          });
        blinkStep();
      }
      if (gazeAmt > 0.05) {
        const { wait, hold: h, x, y, glide: ms } = T.glance;
        const glanceStep = () =>
          later(rnd(wait[0], wait[1]), () => {
            const side = Math.random() < 0.5 ? -1 : 1;
            glide(side * rnd(x[0], x[1]) * gazeAmt, rnd(y[0], y[1]) * gazeAmt, ms);
            later(ms + rnd(h[0], h[1]), () => {
              glide(0, 0, ms);
              later(ms, glanceStep);
            });
          });
        glanceStep();
      }
    }
    return () => {
      on = false;
      timers.forEach(clearTimeout);
    };
  }, [live, walkFace, blinkable, gazeAmt, eyes, mouth, gx, gy, blink]);

  // --- layout -------------------------------------------------------------------------------
  const px = (x: number) => (x - VX) * k;
  const py = (y: number) => (y - VY) * k;
  const origin = (x: number, y: number) => ({ transformOrigin: [px(x), py(y), 0] as [number, number, number] });
  const look: Look = { gx, gy, look: lookX };
  const { leg, arm } = JOINT;
  const legView = (i: 0 | 1, thigh: AnyStyle, shin: AnyStyle, foot: AnyStyle) => {
    const [x, y] = JOINT.hip[i];
    const w = leg.width * k;
    return (
      <Bone x={px(x)} y={py(y)} len={leg.len * k} w={w} color={leg.colour} style={thigh}>
        <Bone x={w / 2} y={leg.len * k + w / 2} len={leg.len * k} w={w} color={leg.colour} style={shin}>
          <Foot len={leg.len * k} f={leg.foot * k} w={w} color={leg.colour} style={foot} />
        </Bone>
      </Bone>
    );
  };
  const armView = (i: 0 | 1, upper: AnyStyle, fore: AnyStyle) => {
    const [x, y] = JOINT.shoulder[i];
    const w = arm.width * k;
    return (
      <Bone x={px(x)} y={py(y)} len={arm.upper * k} w={w} color={arm.colour} style={upper}>
        <Bone x={w / 2} y={arm.upper * k + w / 2} len={arm.fore * k} w={w} color={arm.colour} style={fore} />
      </Bone>
    );
  };
  const eye = (side: 'left' | 'right') => {
    const t = (part: string) => idx(EYES, `eye-${side}-${part}`);
    return (
      <G key={side}>
        <Shape m={eyes.m} fam={EYES} i={t('white-shape')} />
        <G clipPath={`url(#${uid}${side}w)`}>
          <Shape m={eyes.m} fam={EYES} i={t('pupil-shape')} pupil={look} />
        </G>
        <G clipPath={`url(#${uid}${side}l)`}>
          <Shape m={eyes.m} fam={EYES} i={t('lid-skin')} blink={blink} />
        </G>
        <Shape m={eyes.m} fam={EYES} i={t('lash')} blink={blink} />
        <Shape m={eyes.m} fam={EYES} i={t('brow-shape')} />
      </G>
    );
  };
  const box = head ? { width: size, height: (size * HEAD[3]) / HEAD[2] } : { width: size, height: (size * VH) / VW };
  // Head only: the whole figure's frame, shifted so the crop lands in the box.
  const frame = head
    ? { position: 'absolute' as const, left: (VX - HEAD[0]) * k, top: (VY - HEAD[1]) * k, width: VW * k, height: VH * k }
    : StyleSheet.absoluteFill;

  // The hands rest at 8:00 (clear of the face), or show `time`. A real time can point anywhere, so then the
  // hands go under the eyes and mouth instead of over them.
  const turn = time ? [((time.getHours() % 12) + time.getMinutes() / 60) * 30, time.getMinutes() * 6] : [ART.handShort.rest, ART.handLong.rest];
  const hands = (
    <Layer k={k}>
      {[ART.handShort, ART.handLong].map((h, i) => (
        <G key={i} transform={`rotate(${turn[i]} ${PX} ${PY})`}>
          {paths(h.paths)}
        </G>
      ))}
      {paths(ART.hub)}
    </Layer>
  );

  const figure = (
    <View style={[box, head && styles.crop]} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
     <View pointerEvents="none" style={frame}>
      {!head && (
        <Layer k={k} style={[origin(SH.cx, SH.cy), shadow]}>
          <Ellipse cx={SH.cx} cy={SH.cy} rx={SH.rx} ry={SH.ry} fill={SH.colour} fillOpacity={SH.opacity} />
        </Layer>
      )}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, origin(SH.cx, SH.cy), rattle]}>
      {alarm && !head && (
        <Layer k={k} style={flash}>
          <G transform={`translate(${ALARM.offset[0]} ${ALARM.offset[1]})`}>
            {ALARM_LINES.map((d, i) => (
              <Path key={i} d={d} fill="none" stroke={ALARM_SUN} strokeWidth={4} strokeLinecap="round" />
            ))}
            {ALARM_BOLTS.map((d, i) => (
              <Path key={`b${i}`} d={d} fill={ALARM_SUN} />
            ))}
          </G>
        </Layer>
      )}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, origin(PX, PY), body]}>
        {!head && armView(0, upperL, foreL)}
        {!head && legView(0, thighL, shinL, footL)}
        {!head && legView(1, thighR, shinR, footR)}
        <Layer k={k} style={[origin(...PIVOT.bellLeft), bellL]}>{paths(ART.bellLeft)}</Layer>
        <Layer k={k} style={[origin(...PIVOT.bellRight), bellR]}>{paths(ART.bellRight)}</Layer>
        <Layer k={k}>{paths(ART.head)}</Layer>
        {time && hands}
        <Layer k={k} box={EYE_BOX}>
          <Defs>
            {(['left', 'right'] as const).map(side => (
              <Fragment key={side}>
                <ClipPath id={`${uid}${side}w`}>
                  <Shape m={eyes.m} fam={EYES} i={idx(EYES, `eye-${side}-white-shape`)} clip />
                </ClipPath>
                <ClipPath id={`${uid}${side}l`}>
                  <Shape m={eyes.m} fam={EYES} i={idx(EYES, `eye-${side}-lid-clip-shape`)} clip />
                </ClipPath>
              </Fragment>
            ))}
          </Defs>
          {eye('left')}
          {eye('right')}
        </Layer>
        <Layer k={k} box={MOUTH_BOX}>
          <Defs>
            <ClipPath id={`${uid}m`}>
              <Shape m={mouth.m} fam={MOUTH} i={idx(MOUTH, 'mouth-shape')} clip />
            </ClipPath>
          </Defs>
          <Shape m={mouth.m} fam={MOUTH} i={idx(MOUTH, 'mouth-shape')} />
          <G clipPath={`url(#${uid}m)`}>
            <Shape m={mouth.m} fam={MOUTH} i={idx(MOUTH, 'mouth-tongue')} />
          </G>
        </Layer>
        {!time && hands}
        {!head && armView(1, upperR, foreR)}
      </Animated.View>
      </Animated.View>
     </View>
    </View>
  );
  if (!onPress) return figure;
  return (
    <Pressable onPress={onPress} style={box} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {figure}
    </Pressable>
  );
}

const styles = StyleSheet.create({ crop: { overflow: 'hidden' } });
