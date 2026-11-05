// Ring + wake-up game (v3 pop): walk N steps → solve math → you're up. No intro: the game
// starts as soon as it rings. Wakey's eyes follow the game: wide while ringing, calmer with
// every step, thinking during math, stars when you're up.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { Accelerometer, Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Pressable from '@/components/Pressable';
import StreakCard from '@/components/StreakCard';
import Wakey, { mixMoods, type Mood } from '@/components/Wakey';
import { PopButton, PopView } from '@/components/pop';
import { LINE, Pop, PopFont } from '@/constants/pop';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { posthog } from '@/utils/analytics';
import { clockText } from '@/utils/clockFormat';
import { makeProblem, type MathLevel } from '@/utils/math';
import { armWakeCheck, cancelAlarmNotifications, rescheduleRepeatingAlarms } from '@/utils/notifications';
import { recordAlarmCompletion } from '@/utils/rating';
import { setAlarmVolume, stopAlarmSound } from '@/utils/sounds';
import { streakV2, type StreakInfo } from '@/utils/stats';
import { createStepDetector } from '@/utils/stepDetector';
import { getAlarms, logWake } from '@/utils/storage';
import { DEFAULT_MATH_LEVEL, DEFAULT_STEPS } from '@/utils/wakeCheck';

/** No new step for this long → alarm back to full volume + "Keep moving!". */
const IDLE_MS = 15_000;
/** Volume just before the goal; the alarm fades from 1 toward this as the game progresses. */
const MIN_VOLUME = 0.3;
/** Problems to solve in the math phase. */
const MATH_PROBLEMS = 3;
/** Walk first (out of bed), then math (wake the brain). */
const PHASES = ['walk', 'math'] as const;
const PHASE_ICON = { walk: 'footsteps', math: 'calculator' } as const;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

const volumeFor = (progress: number) => 1 - (1 - MIN_VOLUME) * progress;

/** Calm entrance: 250 ms fade with an 8 px lift. Reanimated skips it under Reduce Motion. */
export const rise = (delay = 0) => () => {
    'worklet';
    const timing = { duration: 250, easing: Easing.out(Easing.cubic) };
    return {
        initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
        animations: {
            opacity: withDelay(delay, withTiming(1, timing)),
            transform: [{ translateY: withDelay(delay, withTiming(0, timing)) }],
        },
    };
};

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
                (await Pedometer.requestPermissionsAsync().catch(() => null))?.granted;
            if (cancelled) return;

            if (pedometer) {
                sub = Pedometer.watchStepCount(r => setSteps(r.steps));
                return;
            }

            const detect = createStepDetector();
            try {
                Accelerometer.setUpdateInterval(50);
                sub = Accelerometer.addListener(({ x, y, z }) => {
                    if (detect(x, y, z, Date.now())) setSteps(s => s + 1);
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

export default function RingScreen() {
    // steps / math params: dev "Test game" overrides
    const { alarmId, label, steps: stepsParam, math: mathParam } = useLocalSearchParams<{
        alarmId?: string;
        label?: string;
        steps?: string;
        math?: string;
    }>();
    const { t } = useLocale();
    const { alarms, updateAlarm } = useAlarms();
    useKeepAwake();
    const [shownAt] = useState(() => new Date());

    const alarm = alarms.find(a => a.id === alarmId);
    const goal = Number(stepsParam) || alarm?.steps || DEFAULT_STEPS;
    const mathLevel = (mathParam ? Number(mathParam) : alarm?.mathLevel ?? DEFAULT_MATH_LEVEL) as MathLevel;
    const title = alarm?.label || label || t('ring.defaultLabel');

    const [phase, setPhase] = useState(0);
    const next = useCallback(() => setPhase(p => p + 1), []);
    const done = phase >= PHASES.length;
    const [info, setInfo] = useState<StreakInfo | null>(null);
    const [upAt, setUpAt] = useState<Date | null>(null);

    // No escaping the game with the Android back button.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => sub.remove();
    }, []);

    // First step = someone is up. The in-app alarm keeps ringing; stop the backup
    // notifications piling up on top. (Not on mount: the screen can open while they sleep.)
    const engaged = useCallback(() => {
        if (alarmId) cancelAlarmNotifications(alarmId).catch(() => undefined);
    }, [alarmId]);

    /** Re-arm the next occurrence, or switch a one-time alarm off. Returns the stored alarm. */
    const settleAlarm = useCallback(async () => {
        if (!alarmId) return undefined;
        const stored = (await getAlarms()).find(a => a.id === alarmId);
        if (stored?.days.some(d => d)) {
            // The first step cancelled this one's notifications.
            await rescheduleRepeatingAlarms([stored]).catch(() => undefined);
        } else if (stored) {
            // Instead of leaving it on with nothing scheduled.
            await updateAlarm({ ...stored, enabled: false }).catch(() => undefined);
        }
        return stored;
    }, [alarmId, updateAlarm]);

    // Emergency exit for people already awake: a 2 s hold, so it can't be hit half-asleep.
    // No streak, no "Still awake?" check.
    const exitEarly = async () => {
        stopAlarmSound();
        posthog.capture('alarm_exited_early', { phase: PHASES[phase] });
        engaged();
        await settleAlarm().catch(err => console.error('Early exit failed:', err));
        router.dismissTo('/');
    };

    useEffect(() => {
        if (!done) return;
        stopAlarmSound();
        setUpAt(new Date());
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        (async () => {
            const stored = await settleAlarm();
            if (stored && stored.wakeCheck !== false) await armWakeCheck(stored);
            await recordAlarmCompletion();
            const log = await logWake(Date.now());
            setInfo(streakV2(log, new Date()));
        })().catch(err => console.error('Finishing wake-up failed:', err));
        // Run once when the game is finished.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [done]);

    const leave = () => router.dismissTo('/');

    if (done) {
        return (
            <SafeAreaView style={[styles.container, styles.win]} edges={['top', 'bottom']}>
                <Win info={info} upAt={upAt ?? shownAt} onLeave={leave} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.top}>
                <View style={styles.topRow}>
                    <Text style={styles.label} numberOfLines={1}>{title}</Text>
                    <PhaseSteps phase={phase} />
                </View>
                <Text style={styles.clock}>{clockText(shownAt.getHours(), shownAt.getMinutes())}</Text>
            </View>

            {/* Keyed by phase: each phase rises in fresh, nothing slides across the screen. */}
            <Animated.View key={phase} entering={rise()} style={styles.body}>
                {PHASES[phase] === 'walk' ? (
                    <WalkMission goal={goal} onFirstStep={engaged} onDone={next} />
                ) : (
                    <MathMission level={mathLevel} onDone={next} />
                )}
            </Animated.View>
            <Pressable
                style={styles.exit}
                onLongPress={exitEarly}
                delayLongPress={2000}
                accessibilityRole="button"
                accessibilityHint={t('ring.alreadyUp')}
                hitSlop={8}
            >
                <Text style={styles.exitText}>{t('ring.alreadyUp')}</Text>
            </Pressable>
        </SafeAreaView>
    );
}

/** Walk → Math, so the whole game is visible up front (this replaced the intro screen). */
function PhaseSteps({ phase }: { phase: number }) {
    const { t } = useLocale();
    return (
        <View style={styles.steps}>
            {PHASES.map((p, i) => {
                const isDone = i < phase;
                const isNow = i === phase;
                return (
                    <View
                        key={p}
                        style={[styles.step, isNow && styles.stepNow, isDone && styles.stepDone]}
                        accessible
                        accessibilityLabel={t(`ring.${p}`)}
                        accessibilityState={{ selected: isNow, checked: isDone }}
                    >
                        <Ionicons name={isDone ? 'checkmark' : PHASE_ICON[p]} size={14} color={isNow || isDone ? Pop.ink : Pop.onBlue} />
                    </View>
                );
            })}
        </View>
    );
}

function ProgressBar({ progress }: { progress: number }) {
    const bar = useSharedValue(progress);
    useEffect(() => {
        bar.value = withTiming(progress, { duration: 320, easing: EASE_OUT });
    }, [progress, bar]);
    const fill = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
    return (
        <View style={styles.track}>
            <Animated.View style={[styles.fill, fill]} />
        </View>
    );
}

export function WalkMission({ goal, onFirstStep, onDone }: { goal: number; onFirstStep: () => void; onDone: () => void }) {
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

    const started = useRef(false);
    useEffect(() => {
        if (walked === 0) return;
        if (!started.current) {
            started.current = true; // the pedometer can jump 0 → 3, so not `walked === 1`
            onFirstStep();
        }
        lastStepAt.current = Date.now();
        setIdle(false);
        // A light tap every 5 steps: you feel the progress without looking.
        if (walked % 5 === 0 && walked < goal) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, [walked, goal, onFirstStep]);

    useEffect(() => {
        const timer = setInterval(() => setIdle(Date.now() - lastStepAt.current > IDLE_MS), 1000);
        return () => clearInterval(timer);
    }, []);

    // One buzz when the alarm comes back up — not one per step.
    useEffect(() => {
        if (idle) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }, [idle]);

    useEffect(() => {
        setAlarmVolume(idle ? 1 : volumeFor(progress));
    }, [idle, progress]);

    const mode = walked === 0 ? 'start' : idle ? 'idle' : 'go';
    // Wakey rings while you're still and calms down with every step.
    const calm = mode === 'idle' ? 0 : progress;
    const headline = mode === 'start' ? t('ring.walkTitle') : mode === 'idle' ? t('ring.keepMoving') : t('ring.keepWalking');
    const status = mode === 'start' ? t('ring.walkGoal', { count: goal }) : mode === 'idle' ? t('ring.keepMoving') : t('ring.quieter');

    return (
        <>
            <View style={styles.center}>
                <Wakey size={250} arms="cheer" mood={mixMoods('ringing', 'awake', calm)} ring={1 - calm} steps={walked} accessibilityLabel={headline} />
            </View>
            <View style={styles.bottom}>
                <View style={styles.countRow}>
                    <Text style={styles.headline}>{headline}</Text>
                    <Text style={styles.countText} accessibilityLabel={`${walked} ${t('ring.stepsOf', { count: goal })}`}>
                        {walked} / {goal}
                    </Text>
                </View>
                <ProgressBar progress={progress} />
                <Animated.Text key={mode} entering={FadeIn.duration(200)} style={[styles.status, mode === 'idle' && styles.statusAlert]} accessibilityLiveRegion="polite">
                    {status}
                </Animated.Text>
                {__DEV__ && (
                    <Pressable style={styles.devButton} onPress={() => setDevBonus(b => b + 10)}>
                        <Text style={styles.devText}>+10 steps (dev)</Text>
                    </Pressable>
                )}
            </View>
        </>
    );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'] as const;

/** count: problems to solve (the onboarding demo uses 1). */
export function MathMission({ level, onDone, count = MATH_PROBLEMS }: { level: MathLevel; onDone: () => void; count?: number }) {
    const { t } = useLocale();
    const reduced = useReducedMotion();
    const [problem, setProblem] = useState(() => makeProblem(level));
    const [solved, setSolved] = useState(0);
    const [input, setInput] = useState('');
    const [wrong, setWrong] = useState(false);
    const [mood, setMood] = useState<Mood>('think');
    const look = useSharedValue(0);
    const shake = useSharedValue(0);
    const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Back to full volume after the walk, then fades per problem solved.
    useEffect(() => {
        setAlarmVolume(volumeFor(solved / count));
    }, [solved, count]);
    useEffect(() => () => {
        if (moodTimer.current) clearTimeout(moodTimer.current);
    }, []);

    const react = (next: Mood) => {
        setMood(next);
        if (moodTimer.current) clearTimeout(moodTimer.current);
        moodTimer.current = setTimeout(() => setMood('think'), 900);
    };

    const press = (key: (typeof KEYS)[number], col: number) => {
        // Wakey glances at the key you hit.
        look.value = withSequence(withTiming((col - 1) * 14, { duration: 120 }), withDelay(450, withTiming(0, { duration: 300 })));
        setWrong(false);
        if (key === 'del') return setInput(s => s.slice(0, -1));
        if (key !== 'ok') return setInput(s => (s.length < 4 ? s + key : s));
        if (!input) return;
        setInput('');
        if (Number(input) !== problem.answer) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            setWrong(true);
            react('snoozed');
            if (!reduced) shake.value = withSequence(...[10, -8, 6, -4, 0].map(x => withTiming(x, { duration: 84 })));
            return;
        }
        if (solved + 1 >= count) return onDone();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        react('happy');
        setSolved(solved + 1);
        setProblem(makeProblem(level));
    };

    const field = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

    return (
        <>
            <View style={styles.mathTop}>
                <Wakey size={130} arms="down" mood={mood} lookX={look} accessibilityLabel={t('ring.mathAsk')} />
                <PopView style={styles.bubble} containerStyle={styles.bubbleBox} depth={5}>
                    <Text style={styles.ask}>{t('ring.mathOf', { n: solved + 1, count })}</Text>
                    <Animated.Text key={solved} entering={rise()} style={styles.problem} numberOfLines={1} adjustsFontSizeToFit>
                        {problem.text} =
                    </Animated.Text>
                </PopView>
            </View>

            <View style={styles.bottom}>
                <Animated.View style={field}>
                    <PopView style={[styles.answerBox, wrong && styles.answerWrong]} depth={4}>
                        <Text style={[styles.answer, !input && styles.answerEmpty]}>{input || '?'}</Text>
                    </PopView>
                </Animated.View>
                <Text style={[styles.status, wrong && styles.statusAlert]} accessibilityLiveRegion="polite">
                    {wrong ? t('ring.mathWrong') : solved > 0 ? t('ring.right', { count: count - solved }) : t('ring.mathHint')}
                </Text>
                <View style={styles.keypad}>
                    {KEYS.map((key, i) => (
                        <PopButton
                            key={key}
                            containerStyle={styles.keySlot}
                            style={[styles.key, key === 'ok' && styles.keyOk, key === 'del' && styles.keyDel]}
                            onPress={() => press(key, i % 3)}
                            accessibilityLabel={key === 'del' ? t('ring.mathDelete') : key === 'ok' ? t('ring.mathCheck') : key}
                        >
                            {key === 'del' ? (
                                <Ionicons name="backspace-outline" size={26} color={Pop.ink} />
                            ) : key === 'ok' ? (
                                <Ionicons name="checkmark" size={30} color={Pop.white} />
                            ) : (
                                <Text style={styles.keyText}>{key}</Text>
                            )}
                        </PopButton>
                    ))}
                </View>
            </View>
        </>
    );
}

/** You're up: stars in his eyes, the streak rolls over, today's dot fills in. */
function Win({ info, upAt, onLeave }: { info: StreakInfo | null; upAt: Date; onLeave: () => void }) {
    const { t } = useLocale();
    const reduced = useReducedMotion();
    const [mood, setMood] = useState<Mood>('awake');
    const roll = useSharedValue(0);
    useEffect(() => {
        const timer = setTimeout(() => setMood('proud'), reduced ? 0 : 300);
        return () => clearTimeout(timer);
    }, [reduced]);
    useEffect(() => {
        if (!info) return;
        roll.value = reduced ? 1 : withDelay(200, withTiming(1, { duration: 600, easing: EASE_OUT }));
    }, [info, reduced, roll]);
    const rolling = useAnimatedStyle(() => ({ transform: [{ translateY: -ROLL_H * roll.value }] }));
    const count = info?.count ?? 0;

    return (
        <View style={styles.winBody}>
            <Text style={styles.upAt}>{t('ring.upAt', { time: clockText(upAt.getHours(), upAt.getMinutes()) })}</Text>
            <View style={styles.center}>
                <Wakey size={230} arms="cheer" mood={mood} wave={1} accessibilityLabel={t('ring.win')} />
            </View>
            <View style={styles.winRow}>
                <View style={styles.rollBox} accessible accessibilityLabel={`${count} ${t('ring.streak')}`}>
                    <Animated.View style={rolling}>
                        <Text style={styles.rollNum}>{Math.max(0, count - 1)}</Text>
                        <Text style={styles.rollNum}>{count}</Text>
                    </Animated.View>
                </View>
                <View style={styles.winText}>
                    <Text style={styles.winLabel}>{t('ring.streak')}</Text>
                    <Text style={styles.winSub}>{t('ring.streakSaved')}</Text>
                </View>
            </View>
            {info && <StreakCard info={info} showCount={false} containerStyle={styles.winCard} />}
            <PopButton style={styles.leave} containerStyle={styles.leaveBox} depth={5} onPress={onLeave}>
                <Text style={styles.leaveText}>{t('ring.imUp')}</Text>
            </PopButton>
        </View>
    );
}

const ROLL_H = 104;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Pop.blue, paddingTop: 12, paddingBottom: 20 },
    win: { backgroundColor: Pop.sun },
    top: { paddingHorizontal: 20, gap: 6 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    label: {
        flexShrink: 1,
        fontFamily: PopFont.heavy,
        fontSize: 14,
        color: Pop.ink,
        backgroundColor: Pop.white,
        borderWidth: LINE,
        borderColor: Pop.ink,
        borderRadius: 999,
        overflow: 'hidden',
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    clock: {
        textAlign: 'center',
        fontFamily: PopFont.heavy,
        fontSize: 92,
        lineHeight: 96,
        letterSpacing: -4.5,
        color: Pop.white,
        fontVariant: ['tabular-nums'],
    },

    steps: { flexDirection: 'row', gap: 6 },
    step: {
        width: 34,
        height: 30,
        borderRadius: 999,
        borderWidth: 2,
        borderColor: Pop.ink,
        backgroundColor: Pop.blueDeep,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepNow: { backgroundColor: Pop.white },
    stepDone: { backgroundColor: Pop.sun },

    body: { flex: 1, justifyContent: 'space-between' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    bottom: { gap: 10, paddingHorizontal: 20 },

    countRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    headline: { fontFamily: PopFont.heavy, fontSize: 20, color: Pop.white },
    countText: { fontFamily: PopFont.heavy, fontSize: 15, color: Pop.white, fontVariant: ['tabular-nums'] },
    track: { height: 22, borderRadius: 999, borderWidth: LINE, borderColor: Pop.ink, backgroundColor: Pop.blueDeep, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: Pop.sun },
    status: { fontFamily: PopFont.semibold, fontSize: 15, color: Pop.onBlue, textAlign: 'center' },
    statusAlert: { color: Pop.sun, fontFamily: PopFont.heavy },
    devButton: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
    devText: { fontFamily: PopFont.bold, fontSize: 14, color: Pop.white },
    exit: { alignSelf: 'center', paddingVertical: 8, marginTop: 6 },
    exitText: { fontFamily: PopFont.bold, fontSize: 14, color: Pop.onBlue },

    mathTop: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 4 },
    bubbleBox: { flex: 1 },
    bubble: { borderRadius: 26, paddingHorizontal: 14, paddingVertical: 16, alignItems: 'center', gap: 2 },
    ask: { fontFamily: PopFont.bold, fontSize: 13, color: Pop.sub },
    problem: { fontFamily: PopFont.heavy, fontSize: 40, letterSpacing: -1, color: Pop.ink, fontVariant: ['tabular-nums'] },
    answerBox: { height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
    answerWrong: { backgroundColor: Pop.dangerBg },
    answer: { fontFamily: PopFont.heavy, fontSize: 46, letterSpacing: -1, color: Pop.ink, fontVariant: ['tabular-nums'] },
    answerEmpty: { color: Pop.faint },
    keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
    keySlot: { width: '31.5%' },
    key: { height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    keyOk: { backgroundColor: Pop.ink },
    keyDel: { backgroundColor: Pop.mist },
    keyText: { fontFamily: PopFont.heavy, fontSize: 26, color: Pop.ink },

    winBody: { flex: 1, paddingHorizontal: 20 },
    upAt: {
        alignSelf: 'flex-start',
        fontFamily: PopFont.heavy,
        fontSize: 14,
        color: Pop.ink,
        backgroundColor: Pop.white,
        borderWidth: LINE,
        borderColor: Pop.ink,
        borderRadius: 999,
        overflow: 'hidden',
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    winRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
    rollBox: { height: ROLL_H, overflow: 'hidden' },
    rollNum: { height: ROLL_H, fontFamily: PopFont.heavy, fontSize: 100, lineHeight: ROLL_H, letterSpacing: -5, color: Pop.ink, fontVariant: ['tabular-nums'] },
    winText: { paddingBottom: 14, gap: 2, flexShrink: 1 },
    winLabel: { fontFamily: PopFont.heavy, fontSize: 22, letterSpacing: -0.4, color: Pop.ink },
    winSub: { fontFamily: PopFont.bold, fontSize: 15, color: Pop.ink },
    winCard: { marginTop: 14 },
    leaveBox: { marginTop: 16 },
    leave: { height: 64, borderRadius: 999, backgroundColor: Pop.ink, alignItems: 'center', justifyContent: 'center' },
    leaveText: { fontFamily: PopFont.heavy, fontSize: 19, color: Pop.white },
});
