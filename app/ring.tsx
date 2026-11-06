// Ring + wake-up flow (v3 white): Ringing → Walk with Wakey → Help Wakey count, then back to Home, where +1 plays.
// Each screen fades in on top (250 ms) and the one under it drops out once covered: no slides,
// there is no going back. Haptics only on taps and on the step or answer that finishes a task.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { Accelerometer, Pedometer } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
    ReduceMotion,
    useAnimatedProps,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { markPlusOne } from '@/components/PlusOne';
import Wakey, { type Mood } from '@/components/Wakey';
import { CtaButton, Tap } from '@/components/white';
import { ARRIVE, FADE_MS, W, WFont } from '@/constants/white';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { posthog } from '@/utils/analytics';
import { preloadSfx, sfx } from '@/utils/sfx';
import { formatClock } from '@/utils/clockFormat';
import { makeProblem, type MathLevel } from '@/utils/math';
import { armWakeCheck, cancelAlarmNotifications, cancelRingAgain, rescheduleRepeatingAlarms } from '@/utils/notifications';
import { recordAlarmCompletion } from '@/utils/rating';
import { needsPaywall } from '@/utils/revenueCat';
import { setAlarmVolume, stopAlarmSound } from '@/utils/sounds';
import { createStepDetector } from '@/utils/stepDetector';
import { getAlarms, logWake } from '@/utils/storage';
import { DEFAULT_MATH_LEVEL, DEFAULT_STEPS } from '@/utils/wakeCheck';

/** No new step for this long → alarm back to full volume + "Keep moving!". */
const IDLE_MS = 15_000;
/** Volume just before the goal; the alarm fades from 1 toward this as the game progresses. */
const MIN_VOLUME = 0.3;
/** Problems to solve in the math phase. */
const MATH_PROBLEMS = 3;
/** The last step or the right answer: Wakey is happy this long before the next screen. */
const WALK_DONE_MS = 900;
const RIGHT_MS = 800;

const volumeFor = (progress: number) => 1 - (1 - MIN_VOLUME) * progress;
const arrive = (ms: number) => ({ duration: ms, easing: ARRIVE });

/** One screen of the flow. `fade`: it fades in on top (a fade is not motion, so it plays under Reduce Motion too). */
function Layer({ fade, on, style, children }: { fade: boolean; on: boolean; style: StyleProp<ViewStyle>; children: ReactNode }) {
    const o = useSharedValue(fade ? 0 : 1);
    useEffect(() => {
        if (fade) o.value = withTiming(1, { duration: FADE_MS, easing: ARRIVE, reduceMotion: ReduceMotion.Never });
        // Only on mount: a layer fades in once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const anim = useAnimatedStyle(() => ({ opacity: o.value }));
    return (
        <Animated.View pointerEvents={on ? 'auto' : 'none'} style={[style, { zIndex: on ? 2 : 1 }, anim]}>
            {children}
        </Animated.View>
    );
}

/** How far our own count may run ahead of the OS pedometer before it has to confirm (shaking the phone in bed stops here). */
const OWN_LEAD = 10;

/**
 * Steps since mount, from two sources at once:
 * - an accelerometer peak detector: counts each step the moment it happens;
 * - the OS pedometer (CMPedometer / Android step counter), when available and permitted: more accurate, but it
 *   reports late and in batches, so on its own the number sat still while you walked.
 * The higher one wins; with the pedometer on, the detector may lead it by OWN_LEAD steps at most.
 * Without the pedometer (Motion permission denied) the detector alone counts: the alarm must always be dismissable.
 */
function useSteps(): number {
    const [own, setOwn] = useState(0);
    const [os, setOs] = useState<number | null>(null); // null: no pedometer

    useEffect(() => {
        let accel: { remove(): void } | undefined;
        let pedometer: { remove(): void } | undefined;
        let cancelled = false;

        const detect = createStepDetector();
        try {
            Accelerometer.setUpdateInterval(50);
            accel = Accelerometer.addListener(({ x, y, z }) => {
                if (detect(x, y, z, Date.now())) setOwn(s => s + 1);
            });
        } catch (err) {
            console.error('No accelerometer:', err); // web / sensorless devices
        }

        (async () => {
            const ok =
                (await Pedometer.isAvailableAsync().catch(() => false)) &&
                (await Pedometer.requestPermissionsAsync().catch(() => null))?.granted;
            if (cancelled || !ok) return;
            setOs(0);
            pedometer = Pedometer.watchStepCount(r => setOs(r.steps));
        })();

        return () => {
            cancelled = true;
            accel?.remove();
            pedometer?.remove();
        };
    }, []);

    return os === null ? own : Math.max(os, Math.min(own, os + OWN_LEAD));
}

/**
 * Is the phone moving like someone walking? Accelerometer magnitude vs 1 g, smoothed; stays true for a moment
 * after the motion stops, so the stride between two readings doesn't count as standing still.
 * Lets Wakey walk with you between the pedometer's reports (iOS batches them every 1-3 s).
 */
const MOVE_G = 0.06; // ponytail: tuned by reasoning, not on a phone; raise if Wakey walks while the phone sits on a table
const MOVE_HOLD_MS = 1200;
function useMoving(): boolean {
    const [moving, setMoving] = useState(false);
    useEffect(() => {
        let level = 0;
        let lastMove = 0;
        let sub: { remove(): void } | undefined;
        try {
            Accelerometer.setUpdateInterval(50);
            sub = Accelerometer.addListener(({ x, y, z }) => {
                level += 0.25 * (Math.abs(Math.hypot(x, y, z) - 1) - level);
                const now = Date.now();
                if (level > MOVE_G) lastMove = now;
                const on = now - lastMove < MOVE_HOLD_MS;
                setMoving(m => (m === on ? m : on));
            });
        } catch {
            // no sensor (web): Wakey walks on the step count alone
        }
        return () => sub?.remove();
    }, []);
    return moving;
}

/**
 * The shown count climbs one step at a time toward the real one, never jumping 3 → 7: quick when it is far
 * behind (a pedometer batch), at walking pace when close.
 */
function useCountUp(target: number): number {
    const [shown, setShown] = useState(0);
    useEffect(() => {
        if (shown === target) return;
        if (shown > target) return setShown(target);
        const timer = setTimeout(() => setShown(s => s + 1), Math.max(80, Math.min(300, 1000 / (target - shown))));
        return () => clearTimeout(timer);
    }, [shown, target]);
    return shown;
}

type Screen = 'ring' | 'walk' | 'math';

export default function RingScreen() {
    // steps / math params: dev "Test game" overrides
    const { alarmId, steps: stepsParam, math: mathParam, again } = useLocalSearchParams<{
        alarmId?: string;
        label?: string;
        steps?: string;
        math?: string;
        again?: string; // a replay game (ring-again or a No): the alarm's next occurrence is already armed
    }>();
    const { alarms, updateAlarm, refreshAlarms } = useAlarms();
    // A No on "Still awake?" may have just made this alarm's game harder in storage: play that one.
    useEffect(() => {
        refreshAlarms();
    }, [refreshAlarms]);
    const insets = useSafeAreaInsets();
    useKeepAwake();
    useEffect(preloadSfx, []);
    const [shownAt] = useState(() => new Date());

    const alarm = alarms.find(a => a.id === alarmId);
    const goal = Number(stepsParam) || alarm?.steps || DEFAULT_STEPS;
    const mathLevel = (mathParam ? Number(mathParam) : alarm?.mathLevel ?? DEFAULT_MATH_LEVEL) as MathLevel;

    // The screen on top, and the one it is covering while it fades in.
    const [[screen, under], setScreens] = useState<[Screen, Screen | null]>(['ring', null]);
    const go = useCallback((next: Screen) => setScreens(([cur]) => [next, cur]), []);
    useEffect(() => {
        if (!under) return;
        const timer = setTimeout(() => setScreens(([cur]) => [cur, null]), FADE_MS);
        return () => clearTimeout(timer);
    }, [under]);

    // No escaping the game with the Android back button.
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => sub.remove();
    }, []);

    // First step (or "Can't walk?") = someone is up. The in-app alarm keeps ringing; stop the backup
    // notifications piling up on top. (Not on mount: the screen can open while they sleep.)
    const engaged = useCallback(() => {
        if (!alarmId) return;
        // A replay's own ringing is the ring-again; the alarm's notifications are already its next occurrence.
        if (again) cancelRingAgain(alarmId);
        else cancelAlarmNotifications(alarmId).catch(() => undefined);
    }, [alarmId, again]);

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

    // Last right answer: log the wake, then back to Home, where +1 plays. The rest finishes behind it.
    const finish = useCallback(async () => {
        stopAlarmSound(); // no haptic here: the right answer already played Success
        const now = Date.now();
        const [log, locked] = await Promise.all([
            logWake(now).catch(err => console.error('Logging the wake failed:', err)),
            needsPaywall().catch(() => false),
        ]);
        // +1 only for the day's first wake: the streak counts days, so a second game today (a No on
        // "Still awake?", a second alarm) adds nothing and gets no celebration. Not under the paywall either.
        const today = new Date(now).toDateString();
        if (!locked && log && log.filter(at => new Date(at).toDateString() === today).length === 1) markPlusOne();
        router.dismissTo('/');
        try {
            const stored = await settleAlarm();
            if (stored && stored.wakeCheck !== false) await armWakeCheck(stored);
            await recordAlarmCompletion();
        } catch (err) {
            console.error('Finishing wake-up failed:', err);
        }
    }, [settleAlarm]);

    // For someone already up (e.g. caught by a ring-again): a 2 s hold stops it without the game.
    const exitEarly = useCallback(async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        stopAlarmSound();
        posthog.capture('alarm_exited_early');
        engaged();
        router.dismissTo('/');
        if (!again) await settleAlarm().catch(() => undefined);
    }, [engaged, again, settleAlarm]);

    const toMath = useCallback(() => go('math'), [go]);

    const render = (k: Screen): ReactNode => {
        if (k === 'ring') {
            return <Ringing at={shownAt} onWalk={() => go('walk')} onExit={exitEarly} />;
        }
        if (k === 'walk') {
            const skip = () => {
                posthog.capture('alarm_walk_skipped');
                engaged();
                toMath();
            };
            return <WalkMission goal={goal} onFirstStep={engaged} onDone={toMath} onSkip={skip} ting />;
        }
        return <MathMission level={mathLevel} onDone={finish} ting />;
    };

    return (
        <View style={styles.root}>
            {[under, screen].map(k =>
                k ? (
                    // The first screen arrives with the stack's own fade; every later one fades in on top.
                    <Layer key={k} fade={k !== 'ring'} on={k === screen} style={[styles.layer, k === 'ring' && styles.paper, { paddingTop: insets.top, paddingBottom: insets.bottom + 14 }]}>
                        {render(k)}
                    </Layer>
                ) : null,
            )}
        </View>
    );
}

/** It rings: the time, Wakey rattling and ringing his bells in bursts, one button. */
function Ringing({ at, onWalk, onExit }: { at: Date; onWalk: () => void; onExit: () => void }) {
    const { t } = useLocale();
    const { time, ap } = formatClock(at.getHours(), at.getMinutes());
    // Each rise of `ring` is one burst: a burst every 1.1 s.
    const [ring, setRing] = useState(1);
    useEffect(() => {
        const timer = setInterval(() => setRing(r => (r ? 0 : 1)), 550);
        return () => clearInterval(timer);
    }, []);
    return (
        <View style={[styles.page, styles.ringPage]}>
            <View style={styles.clockRow} accessible accessibilityLabel={`${time} ${ap}`}>
                <Text style={styles.clock}>{time}</Text>
                {!!ap && <Text style={styles.clockAp}>{ap}</Text>}
            </View>
            <View style={styles.center}>
                <Wakey size={290} alarm mood="alarm" ring={ring} accessibilityLabel={t('ring.walkWithWakey')} />
            </View>
            <View style={styles.actions}>
                <CtaButton
                    label={t('ring.walkWithWakey')}
                    icon={<Ionicons name="walk" size={20} color={W.paper} />}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        onWalk();
                    }}
                />
                <Pressable style={styles.skip} onLongPress={onExit} delayLongPress={2000} accessibilityRole="button" accessibilityHint={t('ring.alreadyUp')} hitSlop={8}>
                    <Text style={styles.skipText}>{t('ring.alreadyUp')}</Text>
                </Pressable>
            </View>
        </View>
    );
}

/** Walk · Count: two segments, the current one filling. */
function Segments({ walk, count, active }: { walk: number; count: number; active: 'walk' | 'count' }) {
    const { t } = useLocale();
    return (
        <View style={styles.segs} accessibilityRole="progressbar" accessibilityLabel={active === 'walk' ? t('ring.walk') : t('ring.count')}>
            <Segment label={t('ring.walk')} value={walk} on={active === 'walk'} />
            <Segment label={t('ring.count')} value={count} on={active === 'count'} />
        </View>
    );
}

function Segment({ label, value, on }: { label: string; value: number; on: boolean }) {
    const v = useSharedValue(value);
    useEffect(() => {
        v.value = withTiming(value, arrive(240));
    }, [value, v]);
    const fill = useAnimatedStyle(() => ({ width: `${v.value * 100}%` }));
    return (
        <View style={styles.seg}>
            <View style={styles.segTrack}>
                <Animated.View style={[styles.segFill, fill]} />
            </View>
            <Text style={[styles.segLabel, on && styles.segLabelOn]}>{label}</Text>
        </View>
    );
}

const R = 133;
const CIRC = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Walk with Wakey: he walks while your steps count, the ring closes, the alarm gets quieter. */
/** ting: play the success sound (the alarm flow only; the app plays through the silent switch, the onboarding demo must not). */
export function WalkMission({ goal, onFirstStep, onDone, onSkip, ting = false }: { goal: number; onFirstStep: () => void; onDone: () => void; onSkip?: () => void; ting?: boolean }) {
    const { t } = useLocale();
    const steps = useSteps();
    const moving = useMoving();
    const [devBonus, setDevBonus] = useState(0);
    const counted = Math.min(steps + devBonus, goal); // what the pedometer says
    const walked = useCountUp(counted); // what the screen shows: one step at a time
    const progress = walked / goal;
    const finished = walked >= goal;

    const [idle, setIdle] = useState(false);
    const lastStepAt = useRef(Date.now());

    // Last step: Success on the step itself, Wakey happy, the sum fades in 900 ms later.
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;
    useEffect(() => {
        if (!finished) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (ting) sfx('ting');
        const timer = setTimeout(() => onDoneRef.current(), WALK_DONE_MS);
        return () => clearTimeout(timer);
    }, [finished, ting]);

    const started = useRef(false);
    useEffect(() => {
        if (counted === 0) return;
        if (!started.current) {
            started.current = true; // the pedometer can jump 0 → 3, so not `counted === 1`
            onFirstStep();
        }
        lastStepAt.current = Date.now();
        setIdle(false);
    }, [counted, onFirstStep]);

    // A light tap every 5 shown steps: you feel the progress without looking.
    useEffect(() => {
        if (walked > 0 && walked % 5 === 0 && walked < goal) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, [walked, goal]);

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

    const offset = useSharedValue(CIRC);
    useEffect(() => {
        offset.value = withTiming(CIRC * (1 - progress), arrive(240));
    }, [progress, offset]);
    const arc = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
    const alert = idle && !finished;

    return (
        <View style={styles.page}>
            <Segments walk={progress} count={0} active="walk" />
            <View style={styles.center}>
                <View style={styles.ring}>
                    <Svg width={300} height={300} viewBox="0 0 300 300" style={StyleSheet.absoluteFill}>
                        <Circle cx={150} cy={150} r={R} fill="none" stroke={W.hair} strokeWidth={12} />
                        <AnimatedCircle
                            cx={150}
                            cy={150}
                            r={R}
                            fill="none"
                            stroke={W.blue}
                            strokeWidth={12}
                            strokeLinecap="round"
                            strokeDasharray={CIRC}
                            animatedProps={arc}
                            transform="rotate(-90 150 150)"
                        />
                    </Svg>
                    <View style={styles.walker}>
                        <Wakey size={210} arms="down" steps={finished ? 0 : walked} walk={moving && !finished} mood={finished ? 'happy' : 'awake'} accessibilityLabel={t('ring.walkWithWakey')} />
                    </View>
                </View>
                <View style={styles.countRow} accessibilityRole="text" accessibilityLiveRegion="polite" accessibilityLabel={`${walked} ${t('ring.stepsOf', { count: goal })}`}>
                    <Text style={styles.count}>{walked}</Text>
                    <Text style={styles.countOf}>{t('ring.stepsOf', { count: goal })}</Text>
                </View>
                <Text style={[styles.line, alert && styles.lineAlert]}>{alert ? t('ring.keepMoving') : t('ring.softer')}</Text>
                {/* The way out for anyone who can't walk (or a phone that can't count): only once no step has come for a while. */}
                {alert && onSkip && (
                    <Pressable style={styles.skip} onPress={onSkip} accessibilityRole="button" hitSlop={8}>
                        <Text style={styles.skipText}>{t('ring.cantWalk')}</Text>
                    </Pressable>
                )}
                {__DEV__ && (
                    <Pressable style={styles.dev} onPress={() => setDevBonus(b => b + 10)}>
                        <Text style={styles.devText}>+10 steps (dev)</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/** Help Wakey count: a sum, an answer box, a number pad, Check. count: problems to solve (the onboarding demo uses 1). */
export function MathMission({ level, onDone, count = MATH_PROBLEMS, ting = false }: { level: MathLevel; onDone: () => void; count?: number; ting?: boolean }) {
    const { t } = useLocale();
    const reduced = useReducedMotion();
    const [problem, setProblem] = useState(() => makeProblem(level));
    const [solved, setSolved] = useState(0);
    const [input, setInput] = useState('');
    const [right, setRight] = useState(false);
    const [mood, setMood] = useState<Mood>('awake');
    const look = useSharedValue(0);
    const shake = useSharedValue(0);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Back to full volume after the walk, then fades per problem solved.
    useEffect(() => {
        setAlarmVolume(volumeFor(solved / count));
    }, [solved, count]);
    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);
    const later = (ms: number, fn: () => void) => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(fn, ms);
    };

    const press = (key: (typeof KEYS)[number], col: number) => {
        if (right || !key) return;
        Haptics.selectionAsync().catch(() => {});
        // Wakey glances at the key you hit, then glides back.
        look.value = withSequence(withSpring((col - 1) * 14, { duration: 250, dampingRatio: 1 }), withDelay(450, withTiming(0, { duration: 300 })));
        if (key === 'del') setInput(s => s.slice(0, -1));
        else setInput(s => (s.length < 4 ? s + key : s));
    };

    const check = () => {
        if (!input || right) return;
        if (Number(input) !== problem.answer) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            setInput('');
            setMood('snoozed');
            later(900, () => setMood('awake'));
            if (!reduced) shake.value = withSequence(...[10, -8, 6, -4, 0].map(x => withTiming(x, { duration: 72 })));
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (ting) sfx('ting');
        setRight(true);
        setMood('happy');
        later(RIGHT_MS, () => {
            if (solved + 1 >= count) return onDone();
            setSolved(solved + 1);
            setProblem(makeProblem(level));
            setInput('');
            setRight(false);
            setMood('awake');
        });
    };

    const box = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
    const done = solved + (right ? 1 : 0);

    return (
        <View style={styles.page}>
            <Segments walk={1} count={done / count} active="count" />
            <View style={[styles.center, styles.mathCenter]}>
                <Wakey head size={112} mood={mood} lookX={look} accessibilityLabel={t('ring.mathAsk')} />
                <View style={styles.sumRow}>
                    <Text style={styles.sum} numberOfLines={1} adjustsFontSizeToFit>{problem.text} =</Text>
                    <Animated.View style={[styles.answer, right && styles.answerRight, box]} accessibilityRole="text" accessibilityLiveRegion="polite">
                        <Text style={[styles.answerText, !input && styles.answerEmpty, right && styles.answerTextRight]}>{input || '?'}</Text>
                    </Animated.View>
                </View>
            </View>
            <View style={styles.keypad}>
                {KEYS.map((key, i) => (
                    <View key={i} style={styles.keySlot}>
                        {!!key && (
                            <Tap
                                style={[styles.key, key === 'del' && styles.keyDel]}
                                onPress={() => press(key, i % 3)}
                                accessibilityLabel={key === 'del' ? t('ring.mathDelete') : key}
                            >
                                {key === 'del' ? <Ionicons name="backspace-outline" size={26} color={W.ink} /> : <Text style={styles.keyText}>{key}</Text>}
                            </Tap>
                        )}
                    </View>
                ))}
            </View>
            <CtaButton label={t('ring.check')} onPress={check} disabled={!input || right} style={styles.checkButton} />
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: W.mist },
    layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: W.mist },
    paper: { backgroundColor: W.paper },
    page: { flex: 1, paddingHorizontal: 20, paddingTop: 22 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    flex: { flex: 1 },
    stretch: { alignSelf: 'stretch' },

    ringPage: { paddingTop: 48, alignItems: 'center' },
    clockRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    clock: { fontFamily: WFont.semibold, fontSize: 96, lineHeight: 100, letterSpacing: -4.3, color: W.ink, fontVariant: ['tabular-nums'] },
    clockAp: { fontFamily: WFont.semibold, fontSize: 28, lineHeight: 34, color: W.graphite },
    actions: { alignSelf: 'stretch', gap: 8 },
    skip: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
    skipText: { fontFamily: WFont.semibold, fontSize: 15, color: W.graphite },

    segs: { flexDirection: 'row', gap: 6 },
    seg: { flex: 1, gap: 6 },
    segTrack: { height: 4, borderRadius: 999, backgroundColor: W.hair, overflow: 'hidden' },
    segFill: { height: '100%', backgroundColor: W.blue },
    segLabel: { fontFamily: WFont.semibold, fontSize: 13, lineHeight: 18, color: W.graphite },
    segLabelOn: { fontFamily: WFont.bold, color: W.ink },

    ring: { width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
    walker: { marginTop: 10 },
    countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 20 },
    count: { fontFamily: WFont.bold, fontSize: 72, lineHeight: 76, letterSpacing: -2.9, color: W.ink, fontVariant: ['tabular-nums'] },
    countOf: { fontFamily: WFont.semibold, fontSize: 20, lineHeight: 25, color: W.graphite },
    line: { marginTop: 6, fontFamily: WFont.medium, fontSize: 17, lineHeight: 24, color: W.graphite, textAlign: 'center' },
    lineAlert: { fontFamily: WFont.bold, color: W.sunText },
    dev: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: W.hair },
    devText: { fontFamily: WFont.bold, fontSize: 14, color: W.ink },

    mathCenter: { gap: 20 },
    sumRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sum: { flexShrink: 1, fontFamily: WFont.bold, fontSize: 44, lineHeight: 52, letterSpacing: -1.3, color: W.ink, fontVariant: ['tabular-nums'] },
    answer: { minWidth: 104, height: 64, paddingHorizontal: 16, borderRadius: 16, backgroundColor: W.paper, alignItems: 'center', justifyContent: 'center' },
    answerRight: { backgroundColor: W.blueSoft },
    answerText: { fontFamily: WFont.bold, fontSize: 40, lineHeight: 48, letterSpacing: -1.2, color: W.ink, fontVariant: ['tabular-nums'] },
    answerEmpty: { color: W.dim },
    answerTextRight: { color: W.blueText },
    keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
    keySlot: { width: '32%', height: 60 },
    key: { height: 60, borderRadius: 16, backgroundColor: W.paper, alignItems: 'center', justifyContent: 'center' },
    keyDel: { backgroundColor: 'transparent' },
    keyText: { fontFamily: WFont.semibold, fontSize: 28, color: W.ink, fontVariant: ['tabular-nums'] },
    checkButton: { marginTop: 16 },
});
