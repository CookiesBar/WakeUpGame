// Ring + wake-up game (ported from 3.0): walk N steps → solve math. No intro: the game starts as soon as it rings.
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
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Glass from '@/components/Glass';
import Mascot from '@/components/Mascot';
import Pressable from '@/components/Pressable';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/wakeyTheme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { makeProblem, type MathLevel } from '@/utils/math';
import { armWakeCheck, cancelAlarmNotifications, rescheduleRepeatingAlarms } from '@/utils/notifications';
import { recordAlarmCompletion } from '@/utils/rating';
import { setAlarmVolume, stopAlarmSound } from '@/utils/sounds';
import { streak } from '@/utils/stats';
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

const volumeFor = (progress: number) => 1 - (1 - MIN_VOLUME) * progress;

const pad = (n: number) => String(n).padStart(2, '0');
const clockText = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

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
    const [dayStreak, setDayStreak] = useState<number | null>(null);

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

    useEffect(() => {
        if (!done) return;
        stopAlarmSound();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        (async () => {
            if (alarmId) {
                const stored = (await getAlarms()).find(a => a.id === alarmId);
                if (stored?.days.some(d => d)) {
                    // Re-arm the next occurrence (the first step cancelled this one's notifications).
                    await rescheduleRepeatingAlarms([stored]).catch(() => undefined);
                } else if (stored) {
                    // One-time alarm is done: switch it off instead of leaving it on with nothing scheduled.
                    await updateAlarm({ ...stored, enabled: false }).catch(() => undefined);
                }
                if (stored && stored.wakeCheck !== false) await armWakeCheck(stored);
            }
            await recordAlarmCompletion();
            const log = await logWake(Date.now());
            setDayStreak(streak(log, new Date()));
        })().catch(err => console.error('Finishing wake-up failed:', err));
        // Run once when the game is finished.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [done]);

    const leave = () => router.replace('/');

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.top}>
                <Text style={styles.label} numberOfLines={1}>{title}</Text>
                <Text style={styles.clock}>{clockText(shownAt)}</Text>
                <PhaseSteps phase={phase} />
            </View>

            {/* Keyed by phase: each phase rises in fresh, nothing slides across the screen. */}
            <Animated.View key={phase} entering={rise()} style={styles.body}>
                {done ? (
                    <>
                        <View style={styles.center}>
                            <Mascot mood="happy" size={170} />
                            <Text style={styles.completeTitle}>{t('ring.win')}</Text>
                            {dayStreak !== null && (
                                <Animated.View entering={rise()}>
                                    <Glass colorScheme="dark" style={styles.tile} fallback={styles.tileFallback}>
                                        <Text style={styles.tileValue}>{dayStreak}</Text>
                                        <Text style={styles.tileLabel}>{t('ring.streak')}</Text>
                                    </Glass>
                                </Animated.View>
                            )}
                        </View>
                        <Animated.View entering={rise(200)} style={styles.bottom}>
                            <Pressable style={styles.bigButton} onPress={leave} accessibilityRole="button">
                                <Text style={styles.bigButtonText}>{t('ring.imUp')}</Text>
                            </Pressable>
                        </Animated.View>
                    </>
                ) : PHASES[phase] === 'walk' ? (
                    <WalkMission goal={goal} onFirstStep={engaged} onDone={next} />
                ) : (
                    <MathMission level={mathLevel} onDone={next} />
                )}
            </Animated.View>
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
                const color = isDone ? Colors.ink900 : isNow ? Colors.primary : Colors.blue100;
                return (
                    <Glass
                        key={p}
                        colorScheme="dark"
                        // Tint changes animate natively on iOS 26.
                        tintColor={isDone ? Colors.accent : isNow ? Colors.white : undefined}
                        style={styles.step}
                        fallback={[styles.stepFallback, isNow && styles.stepNow, isDone && styles.stepDone]}
                        accessibilityState={{ selected: isNow, checked: isDone }}
                    >
                        <Ionicons name={isDone ? 'checkmark' : PHASE_ICON[p]} size={15} color={color} />
                        <Text style={[styles.stepText, { color }]}>{t(`ring.${p}`)}</Text>
                    </Glass>
                );
            })}
        </View>
    );
}

function ProgressBar({ progress }: { progress: number }) {
    const bar = useSharedValue(progress);
    useEffect(() => {
        bar.value = withTiming(progress, { duration: 300, easing: Easing.out(Easing.cubic) });
    }, [progress, bar]);
    const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
    return (
        <View style={styles.track}>
            <Animated.View style={[styles.fill, barStyle]} />
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
    }, [walked, onFirstStep]);

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
    const status = {
        start: t('ring.startWalking'),
        idle: t('ring.keepMoving'),
        go: t('ring.stepsLeft', { count: goal - walked }),
    }[mode];

    return (
        <>
            <View style={styles.center}>
                {/* Wakey rings while you're still, and wakes up once you move. */}
                <Animated.View key={mode === 'go' ? 'up' : 'ring'} entering={FadeIn.duration(200)}>
                    <Mascot mood={mode === 'go' ? 'wakeup' : 'alarm'} size={170} />
                </Animated.View>
                <View style={styles.counter}>
                    <Text style={styles.count}>{walked}</Text>
                    <Text style={styles.countOf}>{t('ring.stepsOf', { count: goal })}</Text>
                </View>
                <ProgressBar progress={progress} />
            </View>

            <View style={styles.bottom}>
                <Animated.Text
                    key={mode}
                    entering={FadeIn.duration(200)}
                    style={[styles.status, mode === 'idle' && styles.statusAlert]}
                    accessibilityLiveRegion="polite"
                >
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
    const [problem, setProblem] = useState(() => makeProblem(level));
    const [solved, setSolved] = useState(0);
    const [input, setInput] = useState('');
    const [wrong, setWrong] = useState(false);

    // Back to full volume after the walk, then fades per problem solved.
    useEffect(() => {
        setAlarmVolume(volumeFor(solved / count));
    }, [solved]);

    const press = (key: (typeof KEYS)[number]) => {
        Haptics.selectionAsync().catch(() => {});
        setWrong(false);
        if (key === 'del') return setInput(s => s.slice(0, -1));
        if (key !== 'ok') return setInput(s => (s.length < 4 ? s + key : s));
        if (!input) return;
        setInput('');
        if (Number(input) !== problem.answer) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            setWrong(true);
            return;
        }
        if (solved + 1 >= count) return onDone();
        setSolved(solved + 1);
        setProblem(makeProblem(level));
    };

    return (
        <>
            <View style={styles.center}>
                <Text style={styles.countOf}>{t('ring.mathOf', { n: solved + 1, count })}</Text>
                {/* A solved problem gives way to the next one with the same calm rise. */}
                <Animated.View key={solved} entering={rise()} style={styles.problemRow}>
                    <Text style={styles.problem} numberOfLines={1} adjustsFontSizeToFit>
                        {problem.text} =
                    </Text>
                </Animated.View>
                <Glass
                    colorScheme="dark"
                    style={[styles.answerBox, wrong && styles.answerBoxWrong]}
                    fallback={styles.answerBoxFallback}
                >
                    <Text style={[styles.answer, !input && styles.answerEmpty]}>{input || '?'}</Text>
                </Glass>
                <ProgressBar progress={solved / count} />
            </View>

            <View style={styles.bottom}>
                <Text style={[styles.status, wrong && styles.statusAlert]} accessibilityLiveRegion="polite">
                    {wrong ? t('ring.mathWrong') : t('ring.mathHint')}
                </Text>
                <View style={styles.keypad}>
                    {KEYS.map(key => (
                        <Pressable
                            key={key}
                            style={styles.keySlot}
                            onPress={() => press(key)}
                            accessibilityRole="button"
                            accessibilityLabel={key === 'del' ? t('ring.mathDelete') : key === 'ok' ? t('ring.mathCheck') : key}
                        >
                            {({ pressed }) => (
                                // Interactive glass answers the touch natively; the fallback lights up on press-in.
                                <Glass
                                    isInteractive
                                    colorScheme="dark"
                                    tintColor={key === 'ok' ? Colors.accent : undefined}
                                    style={styles.key}
                                    fallback={[
                                        styles.keyFallback,
                                        key === 'ok' && styles.keyOk,
                                        pressed && (key === 'ok' ? styles.keyOkPressed : styles.keyPressed),
                                    ]}
                                >
                                    {key === 'del' ? (
                                        <Ionicons name="backspace-outline" size={26} color={Colors.onBrand} />
                                    ) : key === 'ok' ? (
                                        <Ionicons name="checkmark" size={30} color={Colors.ink900} />
                                    ) : (
                                        <Text style={styles.keyText}>{key}</Text>
                                    )}
                                </Glass>
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
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    top: { alignItems: 'center', paddingHorizontal: Spacing.xl },
    label: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.blue100 },
    clock: {
        fontFamily: FontFamily.displayBold,
        fontSize: FontSize.h1,
        letterSpacing: -0.5,
        color: Colors.onBrand,
        fontVariant: ['tabular-nums'],
    },

    steps: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    step: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.pill,
    },
    stepFallback: { backgroundColor: 'rgba(255,255,255,0.14)' },
    stepNow: { backgroundColor: Colors.white },
    stepDone: { backgroundColor: Colors.accent },
    stepText: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.sm },

    body: { flex: 1, justifyContent: 'space-between' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing['3xl'] },
    bottom: { alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, minHeight: 72 },

    counter: { alignItems: 'center', marginTop: Spacing.lg },
    count: {
        fontFamily: FontFamily.displayBold,
        fontSize: FontSize.clock,
        lineHeight: FontSize.clock + 4,
        letterSpacing: -1.5,
        color: Colors.onBrand,
        fontVariant: ['tabular-nums'],
    },
    countOf: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.blue100 },
    track: {
        alignSelf: 'stretch',
        height: 12,
        marginTop: Spacing.xl,
        borderRadius: BorderRadius.pill,
        backgroundColor: 'rgba(255,255,255,0.22)',
        overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: BorderRadius.pill, backgroundColor: Colors.accent },

    status: {
        textAlign: 'center',
        fontFamily: FontFamily.bodyBold,
        fontSize: FontSize.lg,
        color: Colors.onBrand,
    },
    statusAlert: { color: Colors.accent, fontFamily: FontFamily.bodyBlack },
    devButton: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    devText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.onBrand },

    problemRow: { alignSelf: 'stretch', alignItems: 'center' },
    problem: {
        fontFamily: FontFamily.displayBold,
        fontSize: FontSize.display,
        letterSpacing: -1,
        color: Colors.onBrand,
        marginTop: Spacing.sm,
        fontVariant: ['tabular-nums'],
    },
    answerBox: {
        minWidth: 160,
        marginTop: Spacing.md,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
        borderColor: 'transparent',
        alignItems: 'center',
    },
    answerBoxFallback: { borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.12)' },
    answerBoxWrong: { borderColor: Colors.accent },
    answer: {
        fontFamily: FontFamily.displayBold,
        fontSize: FontSize.h1,
        color: Colors.onBrand,
        fontVariant: ['tabular-nums'],
    },
    answerEmpty: { color: 'rgba(255,255,255,0.4)' },

    keypad: {
        alignSelf: 'stretch',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: Spacing.sm,
    },
    keySlot: { width: '31.5%' },
    key: { height: 62, borderRadius: BorderRadius.lg, alignItems: 'center', justifyContent: 'center' },
    keyFallback: { backgroundColor: 'rgba(255,255,255,0.16)' },
    keyPressed: { backgroundColor: 'rgba(255,255,255,0.32)', transform: [{ scale: 0.96 }] },
    keyOk: { backgroundColor: Colors.accent },
    keyOkPressed: { backgroundColor: Colors.yellow100, transform: [{ scale: 0.96 }] },
    keyText: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h2, color: Colors.onBrand },

    completeTitle: {
        fontFamily: FontFamily.displayBold,
        fontSize: FontSize.h1,
        letterSpacing: -0.5,
        textAlign: 'center',
        color: Colors.onBrand,
        marginTop: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    tile: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing['3xl'],
        borderRadius: BorderRadius.lg,
    },
    tileFallback: { backgroundColor: 'rgba(255,255,255,0.16)' },
    tileValue: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h1, color: Colors.onBrand },
    tileLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.blue100, textAlign: 'center' },
    bigButton: {
        alignSelf: 'stretch',
        height: 64,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bigButtonText: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h3, color: Colors.onAccent },
});
