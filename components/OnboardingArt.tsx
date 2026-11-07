// Onboarding pictures: the App Store header's ringing wordmark, the stage tray every step draws in, and the small
// motion graphics that show what each setting does (walk, the two math levels, the Still awake? check, sounds,
// and the Allow tap). Motion: ease-out arrivals (ARRIVE), no bounce; loops only where they explain something.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import Wakey, { type Mood } from '@/components/Wakey';
import { ARRIVE, W, WFont } from '@/constants/white';
import { useLocale } from '@/contexts/LocaleContext';
import { formatClock } from '@/utils/clockFormat';
import { makeProblem, type MathLevel } from '@/utils/math';
import { bell, loop, useLoopClock, wave } from '@/utils/motion';

// Curves and data first: worklets capture what they reference when they are created.
const LEAVE = Easing.bezier(0.55, 0, 1, 0.45);
const NEVER = ReduceMotion.Never;
const timing = (ms: number) => ({ duration: ms, easing: ARRIVE, reduceMotion: NEVER });

/** Arrive from below with a fade (a new number, a new card). */
const upIn = (dy = 10, ms = 280) => () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: dy }] },
    animations: { opacity: withTiming(1, { duration: ms, easing: ARRIVE }), transform: [{ translateY: withTiming(0, { duration: ms, easing: ARRIVE }) }] },
  };
};
/** Leave upward with a fade. */
const upOut = (dy = 10, ms = 180) => () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: { opacity: withTiming(0, { duration: ms, easing: LEAVE }), transform: [{ translateY: withTiming(-dy, { duration: ms, easing: LEAVE }) }] },
  };
};

// ───────────────────────── The wordmark (App Store product page header) ─────────────────────────

/** "Wakey" in Fredoka Bold (wght 700, wdth 105), as one path in font units: baseline y = 0, cap height 700. */
const WORD = 'M308 8Q276 8 258 -5Q240 -17 232 -32Q224 -48 222 -53L27 -570Q11 -618 22 -643Q33 -668 85 -686Q119 -698 140 -696Q160 -695 174 -679Q188 -662 200 -629L319 -317L416 -624Q419 -634 427 -650Q435 -666 453 -679Q471 -691 504 -691Q541 -691 559 -677Q578 -663 585 -647Q593 -631 596 -623L693 -315L812 -629Q824 -662 837 -678Q851 -695 872 -697Q894 -700 928 -687Q964 -674 979 -659Q995 -644 995 -623Q996 -602 985 -570L791 -53Q788 -47 781 -32Q773 -17 756 -5Q738 8 704 8Q670 8 651 -6Q632 -21 624 -37Q617 -53 615 -57L506 -379L397 -58Q395 -52 387 -36Q379 -20 361 -6Q343 8 308 8ZM1488 7Q1443 7 1421 -9Q1400 -26 1400 -45H1415Q1409 -36 1392 -24Q1375 -12 1347 -2Q1319 7 1278 7Q1226 7 1181 -13Q1136 -33 1102 -69Q1068 -104 1049 -150Q1030 -196 1030 -247Q1030 -298 1049 -343Q1068 -388 1103 -423Q1137 -458 1182 -478Q1226 -498 1278 -498Q1318 -498 1346 -488Q1373 -479 1390 -466Q1407 -453 1413 -443H1401Q1400 -468 1422 -484Q1443 -499 1489 -499Q1534 -499 1552 -486Q1571 -472 1575 -451Q1579 -430 1579 -408V-83Q1579 -61 1575 -40Q1571 -19 1552 -6Q1534 7 1488 7ZM1303 -170Q1329 -170 1348 -180Q1367 -191 1377 -208Q1388 -225 1388 -246Q1388 -268 1377 -285Q1367 -301 1348 -312Q1328 -322 1301 -322Q1275 -322 1255 -312Q1235 -301 1224 -284Q1213 -267 1213 -245Q1213 -224 1225 -207Q1236 -191 1256 -180Q1276 -170 1303 -170ZM2106 -157Q2142 -125 2144 -96Q2147 -66 2113 -28Q2087 1 2068 9Q2049 17 2030 9Q2011 0 1983 -21L1830 -135V-81Q1830 -59 1826 -38Q1822 -17 1804 -4Q1785 9 1739 9Q1694 9 1675 -4Q1656 -18 1653 -39Q1649 -60 1649 -82V-639Q1649 -662 1653 -682Q1657 -703 1676 -716Q1695 -730 1740 -730Q1785 -730 1804 -716Q1822 -703 1826 -682Q1830 -661 1830 -638V-362L1946 -447Q1971 -467 1993 -476Q2014 -484 2034 -477Q2054 -470 2076 -444Q2113 -400 2111 -373Q2108 -345 2074 -314L1970 -245ZM2463 20Q2381 20 2326 -4Q2270 -29 2236 -68Q2203 -108 2187 -154Q2172 -200 2172 -243Q2172 -321 2208 -381Q2244 -441 2309 -475Q2375 -509 2464 -509Q2532 -509 2580 -489Q2628 -469 2657 -439Q2687 -408 2700 -373Q2714 -338 2714 -308Q2714 -251 2686 -221Q2658 -192 2614 -192H2362Q2366 -176 2380 -164Q2394 -151 2417 -144Q2441 -137 2472 -137Q2500 -137 2520 -140Q2540 -143 2553 -147Q2567 -152 2578 -157Q2588 -161 2598 -164Q2607 -167 2617 -167Q2635 -167 2650 -156Q2665 -145 2677 -121Q2684 -108 2687 -97Q2690 -86 2690 -75Q2690 -45 2663 -24Q2635 -3 2585 9Q2535 20 2463 20ZM2362 -286H2514Q2528 -286 2535 -291Q2542 -296 2542 -309Q2542 -323 2533 -332Q2523 -341 2505 -346Q2487 -351 2460 -351Q2429 -351 2408 -342Q2386 -332 2375 -317Q2364 -303 2362 -286ZM2913 210Q2865 186 2858 159Q2851 133 2874 91L3144 -452Q3166 -498 3191 -506Q3215 -514 3264 -492Q3311 -468 3318 -443Q3326 -418 3305 -377L3033 171Q3011 217 2986 225Q2962 234 2913 210ZM3012 -12 2765 -366Q2738 -405 2743 -432Q2747 -458 2790 -486Q2836 -516 2861 -511Q2887 -505 2915 -464L3083 -224Z';
const WORD_W = 3340;
const ABOVE = 1300; // font units above the baseline: room for the bell
const BELOW = 240; // the y's tail
const BELL = { w: 595, h: 565, x: 425, y: -686, tilt: 16 }; // pivot = bottom centre of the rim, sitting on the W

/** The header's ring: 1.6 s of every 3 s (80 ms attack, hold, 500 ms ease-out), first ring 0.9 s in. */
function ringEnv(ms: number): number {
  'worklet';
  const t = ((((ms - 900) % 3000) + 3000) % 3000) / 1000;
  if (t < 0.08) return t / 0.08;
  if (t < 1.1) return 1;
  if (t < 1.6) {
    const u = (t - 1.1) / 0.5;
    return 1 - u * u * (3 - 2 * u);
  }
  return 0;
}

/**
 * The App Store header's logo: the white wordmark with a yellow alarm bell on the W. Every 3 s the bell rings
 * (11 Hz), the word wobbles with it and sound arcs pulse out on both sides. `width` is the word's width; the arcs
 * sit outside it. Reduce Motion: still, bell at rest.
 */
export function WakeyLogo({ width }: { width: number }) {
  const reduced = useReducedMotion();
  const t = useLoopClock(60000, !reduced); // a whole number of every cycle below, so the loop never jumps
  const k = width / WORD_W;
  const h = (ABOVE + BELOW) * k;
  const base = ABOVE * k; // baseline, from the top
  const bw = BELL.w * k, bh = BELL.h * k;

  const logo = useAnimatedStyle(() => {
    const e = ringEnv(t.value);
    const ph = (2 * Math.PI * 11 * t.value) / 1000;
    const oy = base - h / 2; // rotate about the baseline's middle
    return { transform: [{ translateX: 2 * e * Math.sin(ph) }, { translateY: oy }, { rotate: `${-3.2 * e * Math.sin(ph * 0.5 + 0.6)}deg` }, { translateY: -oy }] };
  }, [base, h]);
  const bellTurn = useAnimatedStyle(() => {
    const e = ringEnv(t.value);
    const ph = (2 * Math.PI * 11 * t.value) / 1000;
    return { transform: [{ translateY: bh / 2 }, { rotate: `${-(BELL.tilt + 13 * e * Math.sin(ph))}deg` }, { translateY: -bh / 2 }] };
  }, [bh]);

  // Entrance: the word settles in, then the bell drops onto the W.
  const inP = useSharedValue(reduced ? 1 : 0);
  const bellP = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    inP.value = withTiming(1, timing(700));
    bellP.value = withDelay(260, withTiming(1, timing(520)), NEVER);
  }, [reduced, inP, bellP]);
  const enter = useAnimatedStyle(() => ({ opacity: inP.value, transform: [{ scale: 0.94 + 0.06 * inP.value }] }));
  const bellIn = useAnimatedStyle(() => ({ opacity: bellP.value, transform: [{ translateY: -14 * (1 - bellP.value) }] }));

  return (
    <Animated.View style={[{ width, height: h }, enter]}>
      <SoundArcs t={t} side={-1} style={{ right: width + 10, top: base - 330 * k - 25 }} />
      <SoundArcs t={t} side={1} style={{ left: width + 10, top: base - 330 * k - 25 }} />
      <Animated.View style={[StyleSheet.absoluteFill, logo]}>
        <Animated.View style={[{ position: 'absolute', left: (BELL.x - BELL.w / 2) * k, top: base + (BELL.y - BELL.h) * k, width: bw, height: bh }, bellIn]}>
          <Animated.View style={[StyleSheet.absoluteFill, bellTurn]}>
            <Bell width={bw} height={bh} />
          </Animated.View>
        </Animated.View>
        {/* A soft drop under the word, like the header's */}
        <Svg style={[StyleSheet.absoluteFill, styles.drop]} viewBox={`0 ${-ABOVE} ${WORD_W} ${ABOVE + BELOW}`}>
          <Path d={WORD} fill="rgba(4,10,40,0.14)" />
        </Svg>
        <Svg style={StyleSheet.absoluteFill} viewBox={`0 ${-ABOVE} ${WORD_W} ${ABOVE + BELOW}`}>
          <Path d={WORD} fill="#FFFFFF" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

/** The header's alarm bell: dark-gold knob, stem and rim, yellow dome with a light shine. Pivot = bottom centre. */
function Bell({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 95">
      <Path d="M41 9a9 9 0 1 0 18 0a9 9 0 1 0 -18 0Z" fill="#C48C00" />
      <Rect x={46} y={12} width={8} height={17} fill="#C48C00" />
      <Path d="M6 79.8A44 58.9 0 0 1 94 79.8Z" fill="#F8B800" />
      <Path d="M29.8 85.7L17.4 67.6A13.2 53 0 0 1 29.8 32.7Z" fill="#FFD65C" />
      <Rect x={0} y={79.8} width={100} height={15.2} rx={7.6} fill="#C48C00" />
    </Svg>
  );
}

function SoundArcs({ t, side, style }: { t: SharedValue<number>; side: 1 | -1; style: object }) {
  const anim = useAnimatedStyle(() => {
    const e = ringEnv(t.value);
    const k = 0.5 + 0.5 * Math.sin((2 * Math.PI * 6 * t.value) / 1000);
    return { opacity: e * (0.55 + 0.45 * k), transform: [{ translateX: side * 4 * k }] };
  });
  return (
    <Animated.View style={[styles.abs, style, anim]} pointerEvents="none">
      <Svg width={40} height={50} viewBox="0 0 40 50" style={side < 0 ? styles.flip : undefined}>
        {[14, 24, 34].map(r => (
          <Path key={r} d={arcPath(r, 2, 25)} stroke="rgba(255,255,255,0.8)" strokeWidth={4} strokeLinecap="round" fill="none" />
        ))}
      </Svg>
    </Animated.View>
  );
}
/** An arc of radius r opening to the right, ±38° around the horizontal, centred at (cx, cy). */
const arcPath = (r: number, cx: number, cy: number) => {
  const a = (38 * Math.PI) / 180;
  const x = cx + r * Math.cos(a), y = r * Math.sin(a);
  return `M ${x.toFixed(2)} ${(cy - y).toFixed(2)} A ${r} ${r} 0 0 1 ${x.toFixed(2)} ${(cy + y).toFixed(2)}`;
};

/** The App Store header's sky, for the welcome screen. */
export function Sky() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10">
      <Defs>
        <LinearGradient id="obSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0A84FF" />
          <Stop offset="0.55" stopColor="#1FA2FF" />
          <Stop offset="1" stopColor="#74D4FF" />
        </LinearGradient>
      </Defs>
      <Rect width="10" height="10" fill="url(#obSky)" />
    </Svg>
  );
}

// ───────────────────────── The stage ─────────────────────────

/** Every step's picture sits in this tray: Paper core inside a faint shell with one hairline (concentric 32/27 radii). */
export function Stage({ height, children, tone = W.paper }: { height: number; children: ReactNode; tone?: string }) {
  return (
    <View style={styles.shell}>
      <View style={[styles.core, { height, backgroundColor: tone }]}>{children}</View>
    </View>
  );
}

// ───────────────────────── Walk ─────────────────────────

/** Wakey walks on a treadmill line while a counter runs to the goal; at the goal he stops and beams, then again. */
export function WalkScene({ goal, height }: { goal: number; height: number }) {
  const reduced = useReducedMotion();
  const [count, setCount] = useState(reduced ? goal : 0);
  useEffect(() => {
    if (reduced) return setCount(goal);
    let n = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      n = n >= goal ? 0 : n + 1;
      setCount(n);
      timer = setTimeout(tick, n >= goal ? 1600 : Math.max(36, 3200 / goal)); // ~3 s to any goal, then a beat at the top
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [goal, reduced]);
  const done = count >= goal;
  const t = useLoopClock(700, !reduced && !done);
  const size = Math.round(height * 0.62);
  return (
    <View style={styles.fill}>
      <View style={styles.counter} accessible accessibilityLabel={`${count} / ${goal}`}>
        <Text style={styles.count}>{count}</Text>
        <Text style={styles.countOf}> / {goal}</Text>
      </View>
      <View style={[styles.walker, { bottom: height * 0.16 }]}>
        <Wakey size={size} walk={!done && !reduced} mood={done ? 'happy' : 'awake'} />
      </View>
      <Treadmill t={t} bottom={height * 0.16} />
    </View>
  );
}

/** Ground dashes sliding right under his feet (he walks left, on the spot). */
function Treadmill({ t, bottom }: { t: SharedValue<number>; bottom: number }) {
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: 28 * loop(t.value, 700) }] }));
  return (
    <View style={[styles.ground, { bottom }]} pointerEvents="none">
      <Animated.View style={[styles.dashes, slide]}>
        {Array.from({ length: 18 }, (_, i) => (
          <View key={i} style={styles.dash} />
        ))}
      </Animated.View>
    </View>
  );
}

// ───────────────────────── Math ─────────────────────────

/** Fixed examples for the two level cards (the stage shows live ones). */
export const MATH_EXAMPLE: Record<MathLevel, string> = { 0: '56 ÷ 7', 2: 'det [7 2; 3 5]' };

/** Wakey thinks over a sum, the answer lands, he beams; a new sum of the chosen level slides in. */
export function MathScene({ level, height }: { level: MathLevel; height: number }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);
  const [shown, setShown] = useState(reduced);
  const problem = useMemo(() => makeProblem(level, seededRand(n * 7 + level)), [level, n]);
  useEffect(() => {
    if (reduced) return;
    setShown(false);
    const a = setTimeout(() => setShown(true), 1500);
    const b = setTimeout(() => setN(x => x + 1), 3000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [n, level, reduced]);
  const look = useSharedValue(0);
  useEffect(() => {
    look.value = withTiming(shown ? 4 : 11, timing(420));
  }, [shown, look]);
  const mood: Mood = shown ? 'happy' : 'think';
  return (
    <View style={[styles.fill, styles.mathRow]}>
      <Wakey head size={Math.round(height * 0.44)} mood={mood} lookX={look} />
      <View style={styles.sumCard}>
        <View style={styles.swap}>
          <Animated.Text key={`${level}-${n}`} entering={upIn()} exiting={upOut()} style={[styles.swapItem, styles.sum]} numberOfLines={1} adjustsFontSizeToFit>
            {problem.text}
          </Animated.Text>
        </View>
        <View style={[styles.answer, shown && styles.answerOn]}>
          {shown ? (
            <Animated.Text key={`a${n}`} entering={upIn(8)} style={[styles.answerText, styles.answerTextOn]}>
              {problem.answer}
            </Animated.Text>
          ) : (
            <Text style={styles.answerText}>?</Text>
          )}
        </View>
      </View>
    </View>
  );
}
/** Deterministic sums per frame, so a re-render never changes the one on screen. */
function seededRand(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ───────────────────────── Still awake? ─────────────────────────

/**
 * How the check works, as a loop on a dawn lock screen: the alarm is off at 6:30 → five minutes later a
 * "Still awake?" notification arrives → either a tap (you're up) or, every other loop, no tap and Wakey rings again.
 */
// Beats: 0 alarm off, 1 five minutes later, 2 the notification, 3 the tap, 4 the outcome. [beat, ms it holds]
const TAP_PLAN: readonly (readonly [number, number])[] = [[0, 1300], [1, 800], [2, 1200], [3, 350], [4, 2200]];
const MISS_PLAN: readonly (readonly [number, number])[] = [[0, 1300], [1, 800], [2, 1900], [4, 2600]];

export function CheckDemo({ height }: { height: number }) {
  const { t } = useLocale();
  const reduced = useReducedMotion();
  const [pos, setPos] = useState(0);
  const [tap, setTap] = useState(true);
  const plan = tap ? TAP_PLAN : MISS_PLAN;
  const beat = reduced ? 2 : plan[pos][0];
  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => {
      if (pos + 1 < plan.length) setPos(pos + 1);
      else {
        setPos(0);
        setTap(x => !x);
      }
    }, plan[pos][1]);
    return () => clearTimeout(timer);
  }, [pos, plan, reduced]);

  const later = beat >= 1;
  const card = beat === 2 || beat === 3 || (beat === 4 && tap);
  const rang = beat === 4 && !tap;
  const [ring, setRing] = useState(0);
  useEffect(() => {
    if (!rang) return;
    setRing(1);
    const timer = setInterval(() => setRing(r => (r ? 0 : 1)), 520);
    return () => clearInterval(timer);
  }, [rang]);
  const clock = formatClock(6, later ? 35 : 30);

  return (
    <View style={styles.fill}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10">
        <Defs>
          <LinearGradient id="obDawn" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#3E4FA0" />
            <Stop offset="1" stopColor="#F2A77A" />
          </LinearGradient>
        </Defs>
        <Rect width="10" height="10" fill="url(#obDawn)" />
      </Svg>

      <View style={styles.lockTop}>
        <View style={styles.lockClock}>
          {/* Only the minute that changes rolls (6:3|0 → 6:3|5); the rest stays put. */}
          <View style={styles.lockTimeBox}>
            <Text style={styles.lockTime}>{clock.time.slice(0, -1)}</Text>
            <View style={styles.lockDigit}>
              <Animated.Text key={clock.time} entering={upIn(14, 340)} exiting={upOut(14, 200)} style={[styles.swapItem, styles.lockTime]}>
                {clock.time.slice(-1)}
              </Animated.Text>
            </View>
          </View>
          {!!clock.ap && <Text style={styles.lockAp}>{clock.ap}</Text>}
        </View>
        <View style={styles.lockCaption}>
          <Animated.View key={rang ? 'again' : later ? 'later' : 'off'} entering={upIn(6)} exiting={upOut(6)} style={styles.swapItem}>
            {!later && <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />}
            <Text style={styles.lockCaptionText}>{rang ? t('onboarding.check.again') : later ? t('onboarding.check.later') : t('onboarding.check.alarmOff')}</Text>
          </Animated.View>
        </View>
      </View>

      {card && (
        <Animated.View entering={upIn(28, 380)} exiting={upOut(10, 200)} style={[styles.note, { bottom: height * 0.1 }]}>
          <Animated.View key={beat === 4 ? 'up' : 'ask'} entering={upIn(6)} style={styles.noteRow}>
            {beat === 4 ? (
              <>
                <View style={[styles.noteIcon, styles.noteIconDone]}>
                  <Ionicons name="checkmark" size={20} color={W.paper} />
                </View>
                <Text style={styles.noteTitle}>{t('onboarding.check.up')}</Text>
              </>
            ) : (
              <>
                <View style={styles.noteIcon}>
                  <Wakey head size={30} mood="awake" />
                </View>
                <View style={styles.noteText}>
                  <Text style={styles.noteTitle} numberOfLines={1}>{t('wakeCheck.title')}</Text>
                  <Text style={styles.noteBody} numberOfLines={1}>{t('wakeCheck.tapBody')}</Text>
                </View>
                <Text style={styles.noteNow}>{t('onboarding.check.now')}</Text>
              </>
            )}
          </Animated.View>
          {beat === 3 && <TapMark />}
        </Animated.View>
      )}

      {rang && (
        <Animated.View entering={upIn(20, 380)} exiting={upOut(6, 200)} style={[styles.ringer, { bottom: height * 0.04 }]}>
          <Wakey size={Math.round(height * 0.5)} alarm mood="alarm" ring={ring} />
        </Animated.View>
      )}
    </View>
  );
}

/** A fingertip lands (press) and leaves a ripple. */
function TapMark() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.quad), reduceMotion: NEVER });
  }, [p]);
  const dot = useAnimatedStyle(() => ({ opacity: p.value < 0.5 ? 1 : 2 - 2 * p.value, transform: [{ scale: 1 - 0.15 * Math.min(1, p.value * 3) }] }));
  const ripple = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.value), transform: [{ scale: 0.6 + 1.2 * p.value }] }));
  return (
    <View style={styles.tap} pointerEvents="none">
      <Animated.View style={[styles.tapRipple, ripple]} />
      <Animated.View style={[styles.tapDot, dot]} />
    </View>
  );
}

// ───────────────────────── Sound ─────────────────────────

/** Five bars: still when quiet, pulsing at the sound's tempo while it plays. */
export function SoundBars({ playing, period, color }: { playing: boolean; period: number; color: string }) {
  const reduced = useReducedMotion();
  const t = useLoopClock(period * 4, playing && !reduced);
  return (
    <View style={styles.bars}>
      {[0.45, 0.8, 1, 0.7, 0.4].map((hgt, i) => (
        <Bar key={i} t={t} i={i} hgt={hgt} period={period} color={color} on={playing} />
      ))}
    </View>
  );
}
function Bar({ t, i, hgt, period, color, on }: { t: SharedValue<number>; i: number; hgt: number; period: number; color: string; on: boolean }) {
  const anim = useAnimatedStyle(() => ({ transform: [{ scaleY: on ? 0.35 + 0.65 * bell(loop(t.value, period, i * 0.17)) : hgt }] }), [on, hgt]);
  return <Animated.View style={[styles.bar, { backgroundColor: color }, anim]} />;
}

/** Wakey asleep until a sound plays: then he rings at its tempo (sound arcs pulsing), then stays up. */
export function SoundScene({ playing, period, woke, height }: { playing: boolean; period: number; woke: boolean; height: number }) {
  const reduced = useReducedMotion();
  const [ring, setRing] = useState(0);
  useEffect(() => {
    if (!playing) return;
    setRing(1);
    const timer = setInterval(() => setRing(r => (r ? 0 : 1)), period);
    return () => clearInterval(timer);
  }, [playing, period]);
  const t = useLoopClock(1200, playing && !reduced);
  const on = useSharedValue(0);
  useEffect(() => {
    on.value = withTiming(playing ? 1 : 0, timing(300));
  }, [playing, on]);
  const size = Math.round(height * 0.66);
  return (
    <View style={[styles.fill, styles.center]}>
      <View>
        <Wakey size={size} mood={playing ? 'ringing' : woke ? 'awake' : 'sleepy'} arms="down" ring={ring} />
        <Pulse t={t} on={on} side={-1} style={{ left: size * 0.02, top: size * 0.08 }} />
        <Pulse t={t} on={on} side={1} style={{ left: size * 0.78, top: size * 0.08 }} />
      </View>
    </View>
  );
}
function Pulse({ t, on, side, style }: { t: SharedValue<number>; on: SharedValue<number>; side: 1 | -1; style: object }) {
  const anim = useAnimatedStyle(() => {
    const k = 0.5 + 0.5 * wave(t.value, 300);
    return { opacity: on.value * (0.5 + 0.5 * k), transform: [{ translateX: side * 3 * k }] };
  });
  return (
    <Animated.View style={[styles.abs, style, anim]} pointerEvents="none">
      <Svg width={26} height={40} viewBox="0 0 26 40" style={side < 0 ? styles.flip : undefined}>
        {[9, 16, 23].map(r => (
          <Path key={r} d={arcPath(r, 1, 20)} stroke={W.blue} strokeWidth={2.6} strokeLinecap="round" fill="none" />
        ))}
      </Svg>
    </Animated.View>
  );
}

// ───────────────────────── Allow ─────────────────────────

/**
 * The system prompt the next tap brings up, drawn small, with a fingertip tapping "Allow" every 2.4 s.
 * iPhone: the iOS alert (two capsules side by side). Android: the permission sheet (two stacked buttons).
 */
export function AllowDialog({ height }: { height: number }) {
  const { t } = useLocale();
  const reduced = useReducedMotion();
  const press = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    let on = true;
    let timer: ReturnType<typeof setTimeout>;
    const cycle = () => {
      press.value = withSequence(
        withTiming(0, { duration: 0, reduceMotion: NEVER }),
        withDelay(700, withTiming(1, { duration: 140, easing: ARRIVE, reduceMotion: NEVER }), NEVER),
        withTiming(2, { duration: 700, easing: ARRIVE, reduceMotion: NEVER }),
      );
      timer = setTimeout(() => on && cycle(), 2400);
    };
    cycle();
    return () => {
      on = false;
      clearTimeout(timer);
    };
  }, [reduced, press]);
  // 0 → 1: the fingertip lands and the button dips; 1 → 2: it lifts and the ripple spreads.
  const btn = useAnimatedStyle(() => ({ transform: [{ scale: 1 - 0.05 * (press.value <= 1 ? press.value : 2 - press.value) }] }));
  const ring = useAnimatedStyle(() => {
    const r = press.value > 1 ? press.value - 1 : 0;
    return { opacity: r > 0 ? 0.55 * (1 - r) : 0, transform: [{ scale: 1 + 0.35 * r }] };
  });
  const finger = useAnimatedStyle(() => {
    const p = press.value;
    const near = p <= 1 ? p : 1;
    return { opacity: p <= 1 ? Math.min(1, p * 3) : 2 - p, transform: [{ translateX: 18 * (1 - near) }, { translateY: 22 * (1 - near) }, { scale: 1 - 0.12 * (p <= 1 ? p : 2 - p) }] };
  });
  const android = Platform.OS === 'android';

  return (
    <View style={[styles.fill, styles.center, styles.dim]}>
      <View style={[styles.dialog, android && styles.dialogAndroid, { maxHeight: height - 24 }]}>
        {android && <Ionicons name="notifications-outline" size={22} color={W.blueText} style={styles.dialogIcon} />}
        <Text style={[styles.dialogTitle, android && styles.dialogTitleAndroid]}>{android ? t('onboarding.notify.dialogTitleAndroid') : t('onboarding.notify.dialogTitle')}</Text>
        {!android && <Text style={styles.dialogBody}>{t('onboarding.notify.dialogBody')}</Text>}
        <View style={[styles.dialogButtons, android && styles.dialogButtonsAndroid]}>
          {!android && (
            <View style={[styles.dialogBtn, styles.dialogBtnGrey]}>
              <Text style={styles.dialogBtnText} numberOfLines={1} adjustsFontSizeToFit>{t('onboarding.notify.dontAllow')}</Text>
            </View>
          )}
          <View style={android ? styles.allowWrapAndroid : styles.allowWrap}>
            <Animated.View style={[styles.allowRing, ring]} />
            <Animated.View style={[styles.dialogBtn, styles.dialogBtnAllow, android && styles.dialogBtnAndroid, btn]}>
              <Text style={[styles.dialogBtnText, styles.dialogBtnTextAllow]} numberOfLines={1} adjustsFontSizeToFit>{t('onboarding.notify.allowBtn')}</Text>
            </Animated.View>
            <Animated.View style={[styles.finger, finger]} pointerEvents="none" />
          </View>
          {android && (
            <View style={[styles.dialogBtn, styles.dialogBtnGrey, styles.dialogBtnAndroid]}>
              <Text style={styles.dialogBtnText} numberOfLines={1} adjustsFontSizeToFit>{t('onboarding.notify.dontAllow')}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  flip: { transform: [{ scaleX: -1 }] },
  drop: { transform: [{ translateY: 3 }] },
  swap: { height: 30, alignSelf: 'stretch' },
  swapItem: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },

  shell: { padding: 5, borderRadius: 32, backgroundColor: 'rgba(11,13,16,0.035)', borderWidth: 1, borderColor: W.hair },
  core: { borderRadius: 27, overflow: 'hidden' },

  counter: { position: 'absolute', top: 16, left: 18, flexDirection: 'row', alignItems: 'baseline' },
  count: { fontFamily: WFont.heavy, fontSize: 30, letterSpacing: -0.6, color: W.ink, fontVariant: ['tabular-nums'] },
  countOf: { fontFamily: WFont.semibold, fontSize: 15, color: W.graphite, fontVariant: ['tabular-nums'] },
  walker: { position: 'absolute', alignSelf: 'center' },
  ground: { position: 'absolute', left: 0, right: 0, height: 2, overflow: 'hidden' },
  dashes: { flexDirection: 'row', gap: 14, marginLeft: -28 },
  dash: { width: 14, height: 2, borderRadius: 1, backgroundColor: W.hair },

  mathRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 14 },
  sumCard: { flex: 1, borderRadius: 20, backgroundColor: W.mist, paddingHorizontal: 16, paddingVertical: 16, gap: 12, alignItems: 'center' },
  sum: { alignSelf: 'stretch', textAlign: 'center', fontFamily: WFont.bold, fontSize: 22, lineHeight: 30, color: W.ink, fontVariant: ['tabular-nums'] },
  answer: { minWidth: 76, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: W.hair, backgroundColor: W.paper, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  answerOn: { borderColor: W.blue, backgroundColor: W.blueSoft },
  answerText: { fontFamily: WFont.bold, fontSize: 20, color: W.dim, fontVariant: ['tabular-nums'] },
  answerTextOn: { color: W.blueText },

  lockTop: { alignItems: 'center', paddingTop: 18, gap: 4 },
  lockClock: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 54, overflow: 'hidden' },
  lockTimeBox: { flexDirection: 'row', height: 54 },
  lockDigit: { width: 29, height: 54, overflow: 'hidden' },
  lockTime: { fontFamily: WFont.heavy, fontSize: 46, lineHeight: 54, letterSpacing: -1, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  lockAp: { marginBottom: 9, fontFamily: WFont.bold, fontSize: 16, color: 'rgba(255,255,255,0.85)' },
  lockCaption: { height: 18, alignSelf: 'stretch' },
  lockCaptionText: { fontFamily: WFont.semibold, fontSize: 13, color: 'rgba(255,255,255,0.92)' },
  note: { position: 'absolute', left: 14, right: 14, minHeight: 62, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.94)', paddingHorizontal: 12, justifyContent: 'center' },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  noteIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: W.blueSoft, alignItems: 'center', justifyContent: 'center' },
  noteIconDone: { backgroundColor: W.blue },
  noteText: { flex: 1 },
  noteTitle: { fontFamily: WFont.bold, fontSize: 15, lineHeight: 20, color: W.ink },
  noteBody: { fontFamily: WFont.medium, fontSize: 13, lineHeight: 18, color: W.graphite },
  noteNow: { alignSelf: 'flex-start', marginTop: 2, fontFamily: WFont.medium, fontSize: 12, color: W.graphite },
  ringer: { position: 'absolute', alignSelf: 'center' },
  tap: { position: 'absolute', left: '42%', top: 12, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  tapDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(11,13,16,0.22)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)' },
  tapRipple: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: W.blue },

  bars: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 22 },
  bar: { width: 4, height: 22, borderRadius: 2 },

  dim: { backgroundColor: '#DCE3EE' },
  dialog: { width: 270, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.97)', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, alignItems: 'center', gap: 6 },
  dialogAndroid: { borderRadius: 24, alignItems: 'stretch' },
  dialogIcon: { alignSelf: 'center' },
  dialogTitle: { textAlign: 'center', fontFamily: WFont.bold, fontSize: 15, lineHeight: 20, color: W.ink },
  dialogTitleAndroid: { fontSize: 16, lineHeight: 22 },
  dialogBody: { textAlign: 'center', fontFamily: WFont.medium, fontSize: 12, lineHeight: 16, color: W.graphite },
  dialogButtons: { marginTop: 8, flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  dialogButtonsAndroid: { flexDirection: 'column', gap: 6 },
  dialogBtn: { flex: 1, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  dialogBtnAndroid: { flex: 0, alignSelf: 'stretch' },
  dialogBtnGrey: { backgroundColor: 'rgba(120,120,128,0.14)' },
  dialogBtnAllow: { backgroundColor: W.cta },
  dialogBtnText: { fontFamily: WFont.semibold, fontSize: 14, color: W.ink },
  dialogBtnTextAllow: { color: W.paper },
  allowWrap: { flex: 1 },
  allowWrapAndroid: { alignSelf: 'stretch' },
  allowRing: { ...StyleSheet.absoluteFill, top: -5, bottom: -5, left: -5, right: -5, borderRadius: 999, borderWidth: 2, borderColor: W.cta },
  finger: { position: 'absolute', right: 4, top: 20, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(11,13,16,0.22)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.95)' },
});
