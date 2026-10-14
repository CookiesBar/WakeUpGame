/**
 * Onboarding: learn by doing. Each step puts one real home-screen element in
 * the user's hands, and its button stays locked until they've tried it.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import AlarmClock from '@/components/AlarmClock';
import Mascot from '@/components/Mascot';
import Toggle from '@/components/Toggle';
import WheelPicker from '@/components/WheelPicker';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { makeProblem } from '@/utils/math';
import { type Mission, MISSIONS, STEP_OPTIONS } from '@/utils/storage';
import { formatTime, use24h } from '@/utils/time';
import {
  appear,
  Cta,
  dateAt,
  haptic,
  hhmmOf,
  minutesOf,
  Rise,
  rise,
  Squish,
  type StepProps,
  styles as k,
  Title,
  useSweep,
  WEEK,
  weekdayName,
} from './kit';

const BORDER = 8; // AlarmClock's ring width; tap targets sit on its dashes
const show = (min: number, h24: boolean) => {
  const { display, meridiem } = formatTime(hhmmOf(min), h24);
  return meridiem ? `${display} ${meridiem}` : display;
};

/** Soft expanding ring that says "tap here". */
function Pulse({ size = 40 }: { size?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1600 }), -1);
  }, [p]);
  const style = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - p.value), transform: [{ scale: 0.6 + 0.6 * p.value }] }));
  return <Animated.View pointerEvents="none" style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: Colors.accent }, style]} />;
}

// --- 1. The clock ---

const CLOCK_NOW = 6 * 60 + 52;
const CLOCK_ALARMS = [
  { minutes: 6 * 60 + 15, passed: true },
  { minutes: 7 * 60 + 30, passed: false },
  { minutes: 9 * 60, passed: false },
];

export function ClockStep({ next }: StepProps) {
  const { t } = useLocale();
  const h24 = use24h();
  const { width } = useWindowDimensions();
  const size = Math.min(width - 96, 270);
  const minute = useSweep(0, CLOCK_NOW, 1300, 350);
  const [picked, setPicked] = useState<number | null>(null);

  const c = (size - 2 * BORDER) / 2;
  const at = (r: number, min: number) => {
    const turn = Math.round((min % 720) / 12) / 60;
    return { x: size / 2 + r * Math.sin(turn * 2 * Math.PI), y: size / 2 - r * Math.cos(turn * 2 * Math.PI) };
  };
  const bubble = picked !== null ? at(c * 0.42, picked) : null;

  return (
    <>
      <Title>{t('onboarding.clockTitle')}</Title>
      <Animated.View entering={appear(100)} style={[s.clockBox, { width: size, height: size }]}>
        <AlarmClock size={size} now={dateAt(minute)} alarms={CLOCK_ALARMS} label={t('onboarding.clockTitle')} />
        {CLOCK_ALARMS.filter((x) => !x.passed).map((x) => {
          const p = at(c * 0.845, x.minutes);
          return (
            <Pressable
              key={x.minutes}
              onPress={() => {
                haptic.pop();
                setPicked(x.minutes);
              }}
              style={[s.dashHit, { left: p.x - 22, top: p.y - 22 }]}
              accessibilityRole="button"
              accessibilityLabel={show(x.minutes, h24)}
            >
              {picked === null && <Pulse />}
            </Pressable>
          );
        })}
        {bubble && picked !== null && (
          <Animated.View key={picked} entering={appear(0)} pointerEvents="none" style={[s.bubble, { left: bubble.x - 52, top: bubble.y - 18 }]}>
            <Ionicons name="alarm" size={14} color={Colors.accent} />
            <Text style={s.bubbleText}>{show(picked, h24)}</Text>
          </Animated.View>
        )}
      </Animated.View>
      <View style={s.legend}>
        <Rise i={3} style={s.legendRow}>
          <View style={[s.swatch, { backgroundColor: Colors.accent }]} />
          <Text style={k.body}>{t('onboarding.clockUp')}</Text>
        </Rise>
        <Rise i={4} style={s.legendRow}>
          <View style={[s.swatch, { backgroundColor: Colors.ink200 }]} />
          <Text style={k.body}>{t('onboarding.clockRang')}</Text>
        </Rise>
        <Rise i={5} style={s.legendRow}>
          <View style={[s.swatch, { backgroundColor: Colors.primary, height: 4 }]} />
          <Text style={k.body}>{t('onboarding.clockHands')}</Text>
        </Rise>
      </View>
      {picked === null && (
        <Animated.Text entering={FadeIn.delay(1600)} style={[k.small, s.center]}>
          {t('onboarding.clockTap')}
        </Animated.Text>
      )}
      <Cta label={t('onboarding.clockGot')} onPress={next} disabled={picked === null} />
    </>
  );
}

// --- 2. The week row ---

/** Made-up alarms per Monday-first day; the weekend is left empty on purpose. */
const WEEK_ALARMS = [[420], [420, 450], [405], [435, 480], [420], [], []];
const GAP = 4;

export function WeekStep({ next }: StepProps) {
  const { t, locale } = useLocale();
  const h24 = use24h();
  const today = (new Date().getDay() + 6) % 7;
  const [sel, setSel] = useState(today);
  const [cell, setCell] = useState(0);
  const x = useSharedValue(0);
  const monday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - today);
    return d;
  }, [today]);

  useEffect(() => {
    x.value = withTiming(sel * (cell + GAP), { duration: 220 });
  }, [sel, cell, x]);
  const pill = useAnimatedStyle(() => ({ width: cell, transform: [{ translateX: x.value }] }));
  const onLayout = (e: LayoutChangeEvent) => setCell((e.nativeEvent.layout.width - 6 * GAP) / 7);

  const alarms = WEEK_ALARMS[sel].map((minutes) => ({ minutes, passed: sel < today }));

  return (
    <>
      <Title sub={t('onboarding.weekTap')}>{t('onboarding.weekTitle')}</Title>
      <Animated.View entering={appear(100)} style={s.center}>
        <AlarmClock size={200} now={dateAt(6 * 60 + 30)} alarms={alarms} label={t('onboarding.weekTitle')} />
      </Animated.View>
      <Rise i={2}>
        <View style={s.week} onLayout={onLayout}>
          {cell > 0 && <Animated.View style={[s.pill, pill]} />}
          {WEEK.map((wd, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const empty = WEEK_ALARMS[i].length === 0;
            const on = i === sel;
            return (
              <Pressable
                key={wd}
                onPress={() => {
                  haptic.tick();
                  setSel(i);
                }}
                style={[s.dayCell, empty && s.dayEmpty, i === today && s.dayToday, on && s.dayOnBorder]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={d.toLocaleDateString(locale, { weekday: 'long' })}
              >
                <Text style={[s.dayName, on && s.onText]} numberOfLines={1} adjustsFontSizeToFit>
                  {i === today ? t('home.today') : weekdayName(locale, wd)}
                </Text>
                <Text style={[s.dayNum, on && s.onText]}>{d.getDate()}</Text>
                {empty ? (
                  <Ionicons name="add" size={16} color={on ? Colors.onBrand : Colors.ink400} />
                ) : (
                  <Text style={[s.dayFirst, on && s.onText]} numberOfLines={1} adjustsFontSizeToFit>
                    {formatTime(hhmmOf(WEEK_ALARMS[i][0]), h24).display}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </Rise>
      <View style={s.legend}>
        <Rise i={3}>
          <Text style={k.body}>{t('onboarding.weekSelected')}</Text>
        </Rise>
        <Rise i={4}>
          <Text style={k.body}>{t('onboarding.weekToday')}</Text>
        </Rise>
        <Rise i={5}>
          <Text style={k.body}>{t('onboarding.weekEmpty')}</Text>
        </Rise>
      </View>
      <Cta label={t('onboarding.next')} onPress={next} disabled={sel === today} />
    </>
  );
}

// --- 3. Build the first routine (real data) ---

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const ITEM_H = 44;

export function RoutineStep({ a, set, next }: StepProps) {
  const { t, locale } = useLocale();
  const h24 = use24h();
  const total = minutesOf(a.time);
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const setTime = (h: number, m: number) => {
    haptic.tick();
    set({ time: hhmmOf(h * 60 + m) });
  };

  return (
    <>
      <Title sub={t('onboarding.routineSub')}>{t('onboarding.routineTitle')}</Title>
      <Rise i={2} style={s.days}>
        {WEEK.map((wd) => {
          const on = a.days.includes(wd);
          return (
            <Squish
              key={wd}
              onPress={() => {
                haptic.pop();
                set({ days: on ? a.days.filter((d) => d !== wd) : [...a.days, wd] });
              }}
              style={[s.dayChip, on && s.dayChipOn]}
              outer={{ flex: 1 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={weekdayName(locale, wd, 'long')}
            >
              <Text style={[s.dayChipText, on && s.onText]} numberOfLines={1} adjustsFontSizeToFit>
                {weekdayName(locale, wd)}
              </Text>
            </Squish>
          );
        })}
      </Rise>
      <Rise i={3} style={s.wheelWrap}>
        <View style={s.band} />
        <View style={s.wheels}>
          {h24 ? (
            <WheelPicker items={HOURS_24} selectedIndex={hour} onChange={(h) => setTime(h, minute)} itemHeight={ITEM_H} width={64} loop />
          ) : (
            <WheelPicker
              items={HOURS_12}
              selectedIndex={(hour % 12 || 12) - 1}
              onChange={(i) => setTime(((i + 1) % 12) + (hour >= 12 ? 12 : 0), minute)}
              itemHeight={ITEM_H}
              width={64}
              loop
            />
          )}
          <Text style={s.colon}>:</Text>
          <WheelPicker items={MINUTES} selectedIndex={minute} onChange={(m) => setTime(hour, m)} itemHeight={ITEM_H} width={64} loop />
          {!h24 && (
            <WheelPicker items={['AM', 'PM']} selectedIndex={hour >= 12 ? 1 : 0} onChange={(i) => setTime((hour % 12) + (i ? 12 : 0), minute)} itemHeight={ITEM_H} width={64} />
          )}
        </View>
        <LinearGradient colors={[Colors.paper, 'rgba(244,248,255,0)']} style={[s.fade, { top: 0 }]} pointerEvents="none" />
        <LinearGradient colors={['rgba(244,248,255,0)', Colors.paper]} style={[s.fade, { bottom: 0 }]} pointerEvents="none" />
      </Rise>
      <Rise i={4}>
        <Text style={[k.small, s.center]}>{t('onboarding.routineHint')}</Text>
      </Rise>
      <Cta
        label={t('onboarding.routineCta')}
        disabled={a.days.length === 0}
        onPress={next}
      />
    </>
  );
}

// --- 4. How to turn it off ---

/** A tiny looping demo of each mission. */
function Preview({ mission, live }: { mission: Mission; live: boolean }) {
  const [n, setN] = useState(0);
  const wobble = useSharedValue(0);
  useEffect(() => {
    if (!live) {
      setN(mission === 'math' ? 9 : mission === 'walk' ? 50 : 0);
      wobble.value = withTiming(0, { duration: 150 });
      return;
    }
    const id = setInterval(() => setN((v) => v + 1), mission === 'math' ? 320 : 220);
    wobble.value = withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(-1, { duration: 400 })), -1, true);
    return () => clearInterval(id);
  }, [mission, wobble, live]);
  const tilt = useAnimatedStyle(() => ({ transform: [{ rotate: `${wobble.value * 4}deg` }, { translateX: mission === 'walk' ? wobble.value * 2 : 0 }] }));
  const sum = '7 + 8 = 15';

  if (mission === 'math') return <Text style={s.previewMath}>{sum.slice(0, (n % (sum.length + 6)) + 1)}</Text>;
  if (mission === 'both')
    return (
      <View style={s.previewRow}>
        <Ionicons name="footsteps" size={22} color={n % 12 < 6 ? Colors.primary : Colors.ink200} />
        <Ionicons name="arrow-forward" size={14} color={Colors.ink400} />
        <Ionicons name="calculator" size={22} color={n % 12 >= 6 ? Colors.primary : Colors.ink200} />
      </View>
    );
  return (
    <View style={s.previewRow}>
      <Animated.View style={tilt}>
        <Ionicons name={mission === 'walk' ? 'footsteps' : 'notifications'} size={24} color={mission === 'walk' ? Colors.primary : Colors.accent} />
      </Animated.View>
      {mission === 'walk' && <Text style={s.previewCount}>{n % 51}</Text>}
    </View>
  );
}

export function MissionStep({ a, set, next }: StepProps) {
  const { t } = useLocale();
  const walks = a.mission === 'walk' || a.mission === 'both';
  return (
    <>
      <Title sub={t('onboarding.missionSub')}>{t('onboarding.missionTitle')}</Title>
      <View style={s.grid}>
        {MISSIONS.map((m, i) => {
          const on = a.mission === m;
          return (
            <Animated.View key={m} entering={rise(i + 2)} style={s.gridCell}>
              <Squish
                onPress={() => {
                  haptic.pop();
                  set({ mission: m });
                }}
                style={[s.mission, on && s.missionOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t(`alarmEditor.mission_${m}`)}
              >
                <View style={s.preview}>
                  <Preview mission={m} live={on} />
                </View>
                <Text style={s.missionName}>{t(`alarmEditor.mission_${m}`)}</Text>
                <Text style={k.small}>{t(`onboarding.missionDesc_${m}`)}</Text>
                {on && (
                  <Animated.View entering={appear(0)} style={s.missionCheck}>
                    <Ionicons name="checkmark" size={14} color={Colors.onBrand} />
                  </Animated.View>
                )}
              </Squish>
            </Animated.View>
          );
        })}
      </View>
      {walks && (
        <Animated.View entering={rise(0)} exiting={FadeOut.duration(120)} style={s.stepsRow}>
          <Text style={k.body}>{t('onboarding.steps')}</Text>
          {STEP_OPTIONS.map((n) => (
            <Squish
              key={n}
              onPress={() => {
                haptic.tick();
                set({ steps: n });
              }}
              style={[s.chip, a.steps === n && s.chipOn]}
              accessibilityState={{ selected: a.steps === n }}
            >
              <Text style={[s.chipText, a.steps === n && s.onText]}>{n}</Text>
            </Squish>
          ))}
        </Animated.View>
      )}
      <Cta label={t('onboarding.continue')} onPress={next} />
    </>
  );
}

// --- 5. Practice round ---

const PRACTICE_TAPS = 10;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'] as const;

export function Practice({ a, next }: StepProps) {
  const { t } = useLocale();
  const math = a.mission === 'math' || a.mission === 'both';
  const [problem] = useState(() => makeProblem(0));
  const [input, setInput] = useState('');
  const [taps, setTaps] = useState(0);
  const [won, setWon] = useState(false);
  const goal = a.mission === 'none' ? 1 : PRACTICE_TAPS;

  const ring = useSharedValue(0);
  const hop = useSharedValue(0);
  const shake = useSharedValue(0);
  useEffect(() => {
    ring.value = won
      ? withTiming(0, { duration: 150 })
      : withRepeat(withSequence(...[3, -3, 2, -2, 0].map((d) => withTiming(d, { duration: 90 })), withTiming(0, { duration: 1600 })), -1);
  }, [won, ring]);
  const wakey = useAnimatedStyle(() => ({ transform: [{ rotate: `${ring.value}deg` }, { translateY: hop.value }] }));
  const box = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const win = () => {
    haptic.win();
    setWon(true);
  };
  const tapWakey = () => {
    if (math || won) return;
    haptic.pop();
    hop.value = withSequence(withTiming(-6, { duration: 80 }), withTiming(0, { duration: 140 }));
    if (taps + 1 >= goal) win();
    setTaps(taps + 1);
  };
  const press = (key: (typeof KEYS)[number]) => {
    if (won) return;
    haptic.tick();
    if (key === 'del') return setInput((v) => v.slice(0, -1));
    if (key !== 'ok') return setInput((v) => (v.length < 4 ? v + key : v));
    if (Number(input) === problem.answer) return win();
    haptic.nope();
    setInput('');
    shake.value = withSequence(...[-5, 5, -3, 0].map((d) => withTiming(d, { duration: 50 })));
  };

  return (
    <>
      <Rise i={0} style={s.practiceHead}>
        <Pressable onPress={tapWakey} disabled={math} accessible={!math} accessibilityRole="button" accessibilityLabel={t('onboarding.practiceWalk', { count: goal - taps })}>
          <Animated.View style={wakey}>
            <Mascot mood={won ? 'happy' : 'alarm'} size={110} />
          </Animated.View>
          {!math && !won && <View style={s.pulseOnWakey}><Pulse size={100} /></View>}
        </Pressable>
        <Text style={k.title}>{won ? t('ring.win') : t('onboarding.practiceTitle')}</Text>
      </Rise>

      {math ? (
        <>
          <Animated.View style={[k.card, s.problem, box]}>
            <Text style={s.problemText}>{problem.text} =</Text>
            <View style={[s.answer, won && { borderColor: Colors.green500 }]}>
              <Text style={s.answerText}>{input || '?'}</Text>
            </View>
          </Animated.View>
          <View style={s.keypad}>
            {KEYS.map((key) => (
              <Squish
                key={key}
                onPress={() => press(key)}
                style={[s.key, key === 'ok' && s.keyOk]}
                outer={s.keyCell}
                accessibilityLabel={key === 'del' ? t('ring.mathDelete') : key === 'ok' ? t('ring.mathCheck') : key}
              >
                {key === 'del' ? (
                  <Ionicons name="backspace-outline" size={22} color={Colors.ink700} />
                ) : key === 'ok' ? (
                  <Ionicons name="checkmark" size={24} color={Colors.onAccent} />
                ) : (
                  <Text style={s.keyText}>{key}</Text>
                )}
              </Squish>
            ))}
          </View>
        </>
      ) : (
        <View style={s.tapInfo}>
          {won ? (
            <Animated.View entering={appear(0)}>
              <Ionicons name="trophy" size={72} color={Colors.accent} />
            </Animated.View>
          ) : (
            <Text style={s.tapCount}>{goal - taps}</Text>
          )}
          <Text style={[k.body, s.center]}>{t('onboarding.practiceWalk', { count: goal })}</Text>
        </View>
      )}

      <Cta label={t('onboarding.next')} onPress={next} disabled={!won} ghost={won ? undefined : t('onboarding.practiceSkip')} onGhost={next} />
    </>
  );
}

// --- 6. Change just this day ---

type Change = number | 'skip' | null;
const STEP_MIN = 15;

export function DayStep({ a, next }: StepProps) {
  const { t, locale } = useLocale();
  const h24 = use24h();
  const days = WEEK.filter((d) => a.days.includes(d));
  const first = days[0] ?? 1;
  const base = minutesOf(a.time);
  const [change, setChange] = useState<Change>(null);
  const [tried, setTried] = useState(false);
  const shown = typeof change === 'number' ? base + change : base;
  const apply = (c: Change) => {
    haptic.pop();
    setChange(c);
    setTried(true);
  };
  const dayName = weekdayName(locale, first, 'long');

  return (
    <>
      <Title sub={t('onboarding.dayTry')}>{t('onboarding.dayTitle')}</Title>
      <Rise i={2} style={[k.card, s.dayCard]}>
        <View style={s.timeRow}>
          <View style={s.timeClip}>
            <Animated.Text
              key={`${shown}-${change === 'skip'}`}
              entering={FadeInDown.duration(200).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })}
              exiting={FadeOutUp.duration(120)}
              style={[s.bigTime, change === 'skip' && s.struck]}
            >
              {show(shown, h24)}
            </Animated.Text>
          </View>
          {typeof change === 'number' && change !== 0 && (
            <Animated.Text entering={appear(0)} style={s.was}>
              {formatTime(a.time, h24).display}
            </Animated.Text>
          )}
          <Text style={s.routineName} numberOfLines={1}>
            {t('routines.defaultName', { day: dayName })}
          </Text>
        </View>
        <View style={s.chips}>
          <Squish onPress={() => apply(change === 'skip' ? null : 'skip')} style={[s.chip, change === 'skip' && s.chipOn]}>
            <Text style={[s.chipText, change === 'skip' && s.onText]}>{change === 'skip' ? t('day.unskip') : t('day.skip')}</Text>
          </Squish>
          {change !== 'skip' && (
            <>
              <Squish onPress={() => apply((typeof change === 'number' ? change : 0) - STEP_MIN)} style={s.chip}>
                <Text style={s.chipText}>{t('day.earlier')}</Text>
              </Squish>
              <Squish onPress={() => apply((typeof change === 'number' ? change : 0) + STEP_MIN)} style={[s.chip, !tried && s.chipHint]}>
                <Text style={s.chipText}>{t('day.later')}</Text>
                {!tried && (
                  <View style={s.chipPulse} pointerEvents="none">
                    <Pulse size={60} />
                  </View>
                )}
              </Squish>
            </>
          )}
          {change !== null && (
            <Squish onPress={() => apply(null)} style={s.chip}>
              <Text style={s.chipText}>{t('day.reset')}</Text>
            </Squish>
          )}
        </View>
      </Rise>

      <Rise i={3}>
        <Text style={k.body}>{t('onboarding.dayStays', { day: dayName, time: show(base, h24) })}</Text>
      </Rise>
      <Rise i={4} style={s.miniWeek}>
        {days.map((d, i) => {
          const changed = i === 0 && change !== null;
          return (
            <Animated.View key={`${d}-${changed ? String(change) : ''}`} entering={changed ? appear(0) : undefined} style={[s.miniDay, changed && s.miniDayOn]}>
              <Text style={[s.miniName, changed && s.onText]} numberOfLines={1} adjustsFontSizeToFit>{weekdayName(locale, d)}</Text>
              <Text style={[s.miniTime, changed && s.onText, i === 0 && change === 'skip' && s.struck]} numberOfLines={1} adjustsFontSizeToFit>
                {formatTime(hhmmOf(i === 0 ? shown : base), h24).display}
              </Text>
            </Animated.View>
          );
        })}
      </Rise>
      <Cta label={t('onboarding.next')} onPress={next} disabled={!tried} />
    </>
  );
}

// --- 7. The switch and the Still awake? check ---

export function SwitchStep({ a, set, next }: StepProps) {
  const { t, locale } = useLocale();
  const h24 = use24h();
  const [on, setOn] = useState(true);
  const dim = useSharedValue(1);
  useEffect(() => {
    dim.value = withTiming(on ? 1 : 0.45, { duration: 220 });
  }, [on, dim]);
  const card = useAnimatedStyle(() => ({ opacity: dim.value }));
  const first = WEEK.find((d) => a.days.includes(d)) ?? 1;

  return (
    <>
      <Title>{t('onboarding.switchTitle')}</Title>
      <Rise i={1}>
        <Text style={k.body}>{t('onboarding.switchBody')}</Text>
      </Rise>
      <Rise i={2}>
        <Animated.View style={[k.card, s.switchCard, card]}>
          <View style={{ flex: 1 }}>
            <Text style={s.routineTitle}>{t('routines.defaultName', { day: weekdayName(locale, first, 'long') })}</Text>
            <Text style={k.small}>{show(minutesOf(a.time), h24)}</Text>
          </View>
          <Toggle
            checked={on}
            onChange={(v) => {
              haptic.tick();
              setOn(v);
            }}
          />
        </Animated.View>
      </Rise>
      <Rise i={3}>
        <Text style={[k.body, { marginTop: Spacing.sm }]}>{t('onboarding.wakeBody')}</Text>
      </Rise>
      <Rise i={4} style={[k.card, s.switchCard]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.routineTitle}>{t('alarmEditor.wakeCheck')}</Text>
          <Text style={k.small}>{t('alarmEditor.wakeCheckHint')}</Text>
        </View>
        <Toggle
          checked={a.wakeCheck}
          onChange={(v) => {
            haptic.tick();
            set({ wakeCheck: v });
          }}
        />
      </Rise>
      {a.wakeCheck && (
        <Animated.View entering={rise(4)} exiting={FadeOut.duration(120)} style={s.notif}>
          <View style={s.notifIcon}>
            <Mascot mood="alarm" size={30} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.notifTitle}>{t('wakeCheck.title')}</Text>
            <Text style={k.small}>{t('wakeCheck.body')}</Text>
          </View>
          <Text style={k.small}>{t('onboarding.inFive')}</Text>
        </Animated.View>
      )}
      <Cta label={t('onboarding.next')} onPress={next} />
    </>
  );
}

const s = StyleSheet.create({
  center: { alignSelf: 'center', textAlign: 'center' },
  clockBox: { alignSelf: 'center' },
  dashHit: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bubble: {
    position: 'absolute',
    width: 104,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.ink900,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
  },
  bubbleText: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.md, color: Colors.white, fontVariant: ['tabular-nums'] },
  legend: { gap: Spacing.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  swatch: { width: 24, height: 7, borderRadius: 4 },

  week: { flexDirection: 'row', gap: GAP },
  pill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, ...Shadow.blue },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 2,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.ink100,
  },
  dayEmpty: { borderStyle: 'dashed', borderColor: Colors.ink200 },
  dayToday: { borderColor: Colors.primary, borderStyle: 'solid' },
  dayOnBorder: { borderColor: 'transparent' },
  dayName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textMuted },
  dayNum: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.ink900 },
  dayFirst: { fontVariant: ['tabular-nums'], fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.ink700, height: 16 },
  onText: { color: Colors.onBrand },

  days: { flexDirection: 'row', gap: 6 },
  dayChip: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.ink100,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  dayChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayChipText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.ink700 },
  wheelWrap: { height: ITEM_H * 5, justifyContent: 'center' },
  band: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    height: ITEM_H,
    top: ITEM_H * 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.blue50,
  },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  colon: { fontFamily: FontFamily.displayBold, fontSize: 30, color: Colors.ink900, marginHorizontal: 2 },
  fade: { position: 'absolute', left: 0, right: 0, height: ITEM_H * 1.6 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridCell: { width: '48.5%' },
  mission: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.ink100,
    padding: Spacing.md,
    gap: 4,
    minHeight: 150,
  },
  missionOn: { borderColor: Colors.primary, backgroundColor: Colors.blue50 },
  missionName: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.ink900 },
  missionCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { height: 54, borderRadius: BorderRadius.sm, backgroundColor: Colors.paper, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewMath: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.ink900, fontVariant: ['tabular-nums'] },
  previewCount: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.ink900, fontVariant: ['tabular-nums'], width: 28 },
  stepsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.blue50,
  },
  chipOn: { backgroundColor: Colors.primary },
  chipHint: { borderWidth: 2, borderColor: Colors.accent },
  chipPulse: { position: 'absolute', alignSelf: 'center', left: '50%', marginLeft: -30 },
  chipText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.blue700 },

  practiceHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pulseOnWakey: { position: 'absolute', left: 5, top: 5 },
  problem: { alignItems: 'center', gap: Spacing.sm },
  problemText: { fontFamily: FontFamily.displayBold, fontSize: 40, color: Colors.ink900 },
  answer: { minWidth: 120, borderBottomWidth: 3, borderColor: Colors.primary, alignItems: 'center' },
  answerText: { fontFamily: FontFamily.displayBold, fontSize: 34, color: Colors.ink900, fontVariant: ['tabular-nums'] },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'space-between' },
  keyCell: { width: '31.5%' },
  key: {
    height: 50,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  keyOk: { backgroundColor: Colors.accent },
  keyText: { fontFamily: FontFamily.displayBold, fontSize: 24, color: Colors.ink900 },
  tapInfo: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  tapCount: { fontFamily: FontFamily.displayBold, fontSize: 72, color: Colors.primary, fontVariant: ['tabular-nums'] },

  dayCard: { gap: Spacing.md },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  timeClip: { height: 44, overflow: 'hidden', justifyContent: 'flex-end' },
  bigTime: { fontFamily: FontFamily.displayBold, fontSize: 34, color: Colors.ink900, fontVariant: ['tabular-nums'] },
  struck: { color: Colors.ink400, textDecorationLine: 'line-through' },
  was: { fontFamily: FontFamily.display, fontSize: FontSize.md, color: Colors.ink400, textDecorationLine: 'line-through' },
  routineName: { flex: 1, textAlign: 'right', fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textMuted },
  miniWeek: { flexDirection: 'row', gap: 4 },
  miniDay: {
    flex: 1,
    maxWidth: 64,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink100,
    alignItems: 'center',
  },
  miniDayOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  miniName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textMuted },
  miniTime: { fontFamily: FontFamily.displayBold, fontSize: FontSize.md, color: Colors.ink900, fontVariant: ['tabular-nums'] },

  switchCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  routineTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.ink900 },
  notif: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.ink100,
    ...Shadow.md,
  },
  notifIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.blue50, alignItems: 'center', justifyContent: 'center' },
  notifTitle: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.md, color: Colors.ink900 },
});
