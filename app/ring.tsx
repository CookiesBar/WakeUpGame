import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { Accelerometer, Pedometer } from 'expo-sensors';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Dimensions, StyleSheet, Text, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Pressable from '@/components/Pressable';
import Mascot from '@/components/Mascot';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { makeProblem, type MathLevel } from '@/utils/math';
import { recordWakeAndMaybeAskReview } from '@/utils/review';
import { stepsOf } from '@/utils/routines';
import { hhmm, nextFire } from '@/utils/schedule';
import { setAlarmVolume, stopAlarmSound } from '@/utils/sounds';
import { firstRing as firstRingStats, LEVEL_UP_AFTER, ON_TIME_MS, streak } from '@/utils/stats';
import { createStepDetector } from '@/utils/stepDetector';
import {
  type Alarm,
  DEFAULT_MATH_LEVEL,
  DEFAULT_STEPS,
  logWake,
  saveAlarm,
  STEP_OPTIONS,
} from '@/utils/storage';
import { formatTime, use24h } from '@/utils/time';

/** No new step for this long → alarm back to full volume + "Keep moving!". */
const IDLE_MS = 15_000;
/** Volume just before the goal; the alarm fades from 1 toward this as the mission progresses. */
const MIN_VOLUME = 0.3;
/** Problems to solve in the math mission. */
const MATH_PROBLEMS = 3;

const volumeFor = (progress: number) => 1 - (1 - MIN_VOLUME) * progress;

/**
 * Steps since mount. Uses the OS pedometer (CMPedometer / Android step counter)
 * when available and permitted, otherwise an accelerometer peak detector — the
 * alarm must always be dismissable, even with Motion permission denied.
 */
function useSteps(): number {
  const [steps, setSteps] = useState(0);

  useEffect(() => {
    let sub: { remove(): void } | undefined;
    let cancelled = false;

    (async () => {
      const pedometer =
        (await Pedometer.isAvailableAsync().catch(() => false)) &&
        (await Pedometer.getPermissionsAsync().catch(() => null))?.granted;
      if (cancelled) return;

      if (pedometer) {
        sub = Pedometer.watchStepCount((r) => setSteps(r.steps));
        return;
      }

      const detect = createStepDetector();
      try {
        Accelerometer.setUpdateInterval(50);
        sub = Accelerometer.addListener(({ x, y, z }) => {
          if (detect(x, y, z, Date.now())) setSteps((s) => s + 1);
        });
      } catch (err) {
        console.error('No step source available:', err); // web / sensorless devices
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  return steps;
}

/** One notch harder: math level first, then more steps. null = already at the top. */
function harder(alarm: Alarm): Alarm | null {
  const mission = alarm.mission ?? 'walk';
  const level = alarm.mathLevel ?? DEFAULT_MATH_LEVEL;
  if ((mission === 'math' || mission === 'both') && level < 2) return { ...alarm, mathLevel: (level + 1) as MathLevel };
  if (mission === 'walk' || mission === 'both') {
    const steps = STEP_OPTIONS.find((s) => s > (alarm.steps ?? DEFAULT_STEPS));
    if (steps) return { ...alarm, steps };
  }
  return null;
}

interface Result {
  minutes: number;
  streak: number;
  onTime: number;
  total: number;
  /** On-time wakes still needed before the next level; null when level-up is off or maxed. */
  levelLeft: number | null;
  leveledUp: boolean;
}

export default function RingScreen() {
  const { alarmId, label, ringAt } = useLocalSearchParams<{
    alarmId?: string;
    label?: string;
    ringAt?: string;
  }>();
  const { t } = useLocale();
  const { alarms, routines, dismissAlarm, refreshAlarms, effective } = useAlarms();
  useKeepAwake();
  const h24 = use24h();
  const [shownAt] = useState(() => new Date());
  const clock = formatTime(hhmm(shownAt), h24);

  const alarm = alarms.find((a) => a.id === alarmId);
  const routine = routines.find((r) => r.id === alarm?.routineId);
  const mission = alarm?.mission ?? 'walk';
  // 'both' walks first: out of bed, then the brain. 'none' just needs the button.
  const phases = mission === 'both' ? (['walk', 'math'] as const) : mission === 'none' ? [] : ([mission] as const);
  const [phase, setPhase] = useState(-1); // -1 = Wakey's intro
  const next = useCallback(() => setPhase((p) => p + 1), []);
  const done = phase >= phases.length;
  const [result, setResult] = useState<Result | null>(null);

  // Migrated routines share their alarm's label; say it once.
  const title =
    [...new Set([routine?.name.trim(), alarm?.label || label].filter(Boolean))].join(' · ') || t('ring.defaultLabel');

  // No escaping the mission with the Android back button.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!done) return;
    stopAlarmSound();
    if (alarmId) dismissAlarm(alarmId).catch(() => undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    (async () => {
      const firstRing = Number(ringAt) || shownAt.getTime();
      const now = Date.now();
      const late = now - firstRing > ON_TIME_MS;
      const log = await logWake({ at: now, late });
      let levelLeft: number | null = null;
      let leveledUp = false;
      if (alarm && routine?.levelUp && harder(alarm)) {
        const progress = late ? 0 : (alarm.levelProgress ?? 0) + 1;
        const bumped = progress >= LEVEL_UP_AFTER ? harder(alarm) : null;
        leveledUp = !!bumped;
        // Difficulty isn't part of the notification, so storage alone is enough.
        await saveAlarm({ ...(bumped ?? alarm), levelProgress: bumped ? 0 : progress });
        levelLeft = bumped ? (harder(bumped) ? LEVEL_UP_AFTER : null) : LEVEL_UP_AFTER - progress;
        refreshAlarms();
      }
      const stats = firstRingStats(log, new Date(now));
      setResult({
        minutes: Math.max(0, Math.round((now - firstRing) / 60_000)),
        streak: streak(log, new Date(now)),
        ...stats,
        levelLeft,
        leveledUp,
      });
    })().catch((err) => console.error('recording wake failed:', err));
    // Run once when the challenge is finished.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // The routine's next alarm within a few hours, e.g. "07:00 Out of bed" after "06:45 Wake up".
  const after = routine
    ? stepsOf(routine, alarms)
        .filter((a) => a.id !== alarmId)
        .map((a) => ({ a, at: nextFire(effective(a), shownAt) }))
        .filter(({ at }) => at && at.getTime() - shownAt.getTime() < 4 * 3_600_000)
        .sort((x, y) => x.at!.getTime() - y.at!.getTime())[0]
    : undefined;

  const leave = () => {
    router.canGoBack() ? router.back() : router.replace('/');
    // After leaving the ring screen, so the sheet lands on the home screen.
    setTimeout(recordWakeAndMaybeAskReview, 600);
  };

  if (phase === -1) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <Text style={styles.label} numberOfLines={1}>{title}</Text>
          <Text style={styles.clock}>{`${clock.display} ${clock.meridiem}`.trim()}</Text>
        </View>
        <View style={styles.center}>
          <Bobbing>
            <View style={styles.spotlight}>
              <Mascot mood="alarm" size={210} />
            </View>
          </Bobbing>
          <Text style={styles.intro}>{t(`ring.intro_${mission}`, { count: alarm?.steps ?? DEFAULT_STEPS })}</Text>
        </View>
        <View style={styles.bottom}>
          <Pressable style={styles.bigButton} onPress={next} accessibilityRole="button">
            <Text style={styles.bigButtonText}>{mission === 'none' ? t('ring.imUp') : t('ring.beat')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text style={styles.clock}>{`${clock.display} ${clock.meridiem}`.trim()}</Text>
        <Text style={styles.label} numberOfLines={1}>{title}</Text>
      </View>

      {done ? (
        <>
          <View style={styles.center}>
            <Mascot mood="shake" size={150} />
            <Text style={styles.completeTitle}>{t('ring.win')}</Text>
            {result && (
              <>
                <Text style={styles.status}>
                  {t('ring.upAt', { time: `${clock.display} ${clock.meridiem}`.trim(), m: result.minutes })}
                </Text>
                <View style={styles.tiles}>
                  <View style={styles.tile}>
                    <Text style={styles.tileValue}>{result.streak}</Text>
                    <Text style={styles.tileLabel}>{t('ring.streak')}</Text>
                  </View>
                  <View style={styles.tile}>
                    <Text style={styles.tileValue}>{`${result.onTime}/${result.total}`}</Text>
                    <Text style={styles.tileLabel}>{t('ring.firstRing')}</Text>
                  </View>
                </View>
                {result.leveledUp ? (
                  <Text style={styles.level}>{t('ring.leveledUp')}</Text>
                ) : result.levelLeft !== null ? (
                  <Text style={styles.level}>{t('ring.harderIn', { count: result.levelLeft })}</Text>
                ) : null}
                {after?.at && (
                  <Text style={styles.nextStep}>
                    {t('ring.next', {
                      time: formatTime(hhmm(after.at), h24).display,
                      label: after.a.label || t('common.alarmFallback'),
                    })}
                  </Text>
                )}
              </>
            )}
          </View>
          <View style={styles.bottom}>
            <Pressable style={styles.bigButton} onPress={leave} accessibilityRole="button">
              <Text style={styles.bigButtonText}>{t('ring.imUp')}</Text>
            </Pressable>
          </View>
          <ConfettiCannon
            count={120}
            origin={{ x: Dimensions.get('window').width / 2, y: 0 }}
            autoStart
            fadeOut
            explosionSpeed={350}
            fallSpeed={2500}
          />
        </>
      ) : phases[phase] === 'walk' ? (
        <WalkMission goal={alarm?.steps ?? DEFAULT_STEPS} onDone={next} />
      ) : (
        <MathMission level={alarm?.mathLevel ?? DEFAULT_MATH_LEVEL} onDone={next} />
      )}
    </SafeAreaView>
  );
}

function Bobbing({ children }: { children: ReactNode }) {
  const bob = useSharedValue(1);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1.06, { duration: 500, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [bob]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: bob.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function ProgressBar({ progress }: { progress: number }) {
  const bar = useSharedValue(0);
  useEffect(() => {
    bar.value = withTiming(progress, { duration: 400, easing: Easing.out(Easing.cubic) });
  }, [progress, bar]);
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, barStyle]} />
    </View>
  );
}

function WalkMission({ goal, onDone }: { goal: number; onDone: () => void }) {
  const { t } = useLocale();
  const steps = useSteps();
  const [devBonus, setDevBonus] = useState(0);
  const walked = Math.min(steps + devBonus, goal);
  const progress = walked / goal;

  const [idle, setIdle] = useState(false);
  const lastStepAt = useRef(Date.now());

  const finished = useRef(false);
  useEffect(() => {
    if (walked < goal || finished.current) return;
    finished.current = true;
    onDone();
  }, [walked, goal, onDone]);

  useEffect(() => {
    if (walked === 0) return;
    lastStepAt.current = Date.now();
    setIdle(false);
    Haptics.selectionAsync().catch(() => {});
  }, [walked]);

  useEffect(() => {
    const timer = setInterval(() => setIdle(Date.now() - lastStepAt.current > IDLE_MS), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (idle) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [idle]);

  useEffect(() => {
    setAlarmVolume(idle ? 1 : volumeFor(progress));
  }, [idle, progress]);

  const bob = useSharedValue(1);
  useEffect(() => {
    bob.value = withRepeat(
      withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [bob]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ scale: bob.value }] }));

  const status =
    walked === 0
      ? t('ring.startWalking')
      : idle
        ? t('ring.keepMoving')
        : t('ring.stepsLeft', { count: goal - walked });

  return (
    <>
      <View style={styles.center}>
        <Animated.View style={bobStyle}>
          <Mascot mood={walked === 0 ? 'alarm' : 'wakeup'} size={170} />
        </Animated.View>
        <View style={styles.counter}>
          <Text style={styles.count}>{walked}</Text>
          <Text style={styles.countOf}>{t('ring.stepsOf', { count: goal })}</Text>
        </View>
        <ProgressBar progress={progress} />
      </View>

      <View style={styles.bottom}>
        <Text
          style={[styles.status, idle && walked > 0 && styles.statusIdle]}
          accessibilityLiveRegion="polite"
        >
          {status}
        </Text>
        {__DEV__ && (
          <Pressable style={styles.devButton} onPress={() => setDevBonus((b) => b + 10)}>
            <Text style={styles.devText}>+10 steps (dev)</Text>
          </Pressable>
        )}
      </View>
    </>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'] as const;

function MathMission({ level, onDone }: { level: MathLevel; onDone: () => void }) {
  const { t } = useLocale();
  const [problem, setProblem] = useState(() => makeProblem(level));
  const [solved, setSolved] = useState(0);
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);

  // Back to full volume when math follows the walk, then fades per problem solved.
  useEffect(() => {
    setAlarmVolume(volumeFor(solved / MATH_PROBLEMS));
  }, [solved]);

  const press = (key: (typeof KEYS)[number]) => {
    Haptics.selectionAsync().catch(() => {});
    setWrong(false);
    if (key === 'del') return setInput((s) => s.slice(0, -1));
    if (key !== 'ok') return setInput((s) => (s.length < 4 ? s + key : s));
    if (!input) return;
    setInput('');
    if (Number(input) !== problem.answer) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setWrong(true);
      return;
    }
    if (solved + 1 >= MATH_PROBLEMS) return onDone();
    setSolved(solved + 1);
    setProblem(makeProblem(level));
  };

  return (
    <>
      <View style={styles.center}>
        <Text style={styles.countOf}>
          {t('ring.mathOf', { n: solved + 1, count: MATH_PROBLEMS })}
        </Text>
        <Text style={styles.problem} numberOfLines={1} adjustsFontSizeToFit>
          {problem.text} =
        </Text>
        <View style={[styles.answerBox, wrong && styles.answerBoxWrong]}>
          <Text style={styles.answer}>{input || '?'}</Text>
        </View>
        <ProgressBar progress={solved / MATH_PROBLEMS} />
      </View>

      <View style={styles.bottom}>
        <Text style={[styles.status, wrong && styles.statusIdle]} accessibilityLiveRegion="polite">
          {wrong ? t('ring.mathWrong') : t('ring.mathHint')}
        </Text>
        <View style={styles.keypad}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              style={({ pressed }) => [
                styles.key,
                key === 'ok' && styles.keyOk,
                pressed && styles.keyPressed,
              ]}
              onPress={() => press(key)}
              accessibilityRole="button"
              accessibilityLabel={
                key === 'del' ? t('ring.mathDelete') : key === 'ok' ? t('ring.mathCheck') : key
              }
            >
              {key === 'del' ? (
                <Ionicons name="backspace-outline" size={26} color={Colors.onBrand} />
              ) : key === 'ok' ? (
                <Ionicons name="checkmark" size={30} color={Colors.ink900} />
              ) : (
                <Text style={styles.keyText}>{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'space-between',
    paddingVertical: Spacing.xxl,
  },
  top: { alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.xl },
  spotlight: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    textAlign: 'center',
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.h3,
    color: Colors.onBrand,
    marginTop: Spacing.xl,
  },
  bigButton: {
    alignSelf: 'stretch',
    height: 64,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigButtonText: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h3, color: Colors.onAccent },
  tiles: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg, alignSelf: 'stretch' },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  tileValue: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h1, color: Colors.onBrand },
  tileLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.blue100, textAlign: 'center' },
  level: {
    textAlign: 'center',
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
    color: Colors.yellow100,
    marginTop: Spacing.lg,
  },
  nextStep: {
    textAlign: 'center',
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.onBrand,
    marginTop: Spacing.md,
  },
  clock: { fontFamily: FontFamily.displayBold, fontSize: FontSize.display, color: Colors.onBrand },
  label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.lg, color: Colors.blue100 },

  center: { alignItems: 'center', paddingHorizontal: Spacing['3xl'] },
  counter: { alignItems: 'center', marginTop: Spacing.md },
  count: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.clock,
    lineHeight: FontSize.clock + 4,
    color: Colors.onBrand,
    fontVariant: ['tabular-nums'],
  },
  countOf: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.blue100 },
  completeTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.h1,
    color: Colors.onBrand,
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  track: {
    alignSelf: 'stretch',
    height: 14,
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: BorderRadius.pill, backgroundColor: Colors.accent },

  problem: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.title,
    color: Colors.onBrand,
    marginTop: Spacing.sm,
    fontVariant: ['tabular-nums'],
  },
  answerBox: {
    minWidth: 140,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  answerBoxWrong: { borderColor: Colors.accent },
  answer: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.h1,
    color: Colors.onBrand,
    fontVariant: ['tabular-nums'],
  },

  bottom: { alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, minHeight: 72 },
  status: {
    textAlign: 'center',
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.lg,
    color: Colors.onBrand,
  },
  statusIdle: { color: Colors.accent, fontFamily: FontFamily.bodyBlack, fontSize: FontSize.h3 },
  devButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  devText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.onBrand },

  keypad: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.sm,
  },
  key: {
    width: '31.5%',
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyOk: { backgroundColor: Colors.accent },
  keyPressed: { opacity: 0.6 },
  keyText: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h2, color: Colors.onBrand },
});
