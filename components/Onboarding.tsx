// First launch (v3 white): the App Store header's ringing logo → one setting per step, each with its own moving
// picture (time, repeat, walk, solve math, the Still awake? check, sound) → the Allow prompt (notifications +
// AlarmKit). The alarm is saved for real; the hard paywall in _layout follows.
// Motion (high-end, no bounce): steps share an X axis (enter 280 ms ease-out, leave 180 ms), titles rise 8 px with a
// 40 ms stagger, presses dip to 0.97. Pictures live in OnboardingArt.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BedLine, Repeat, Row, styles as editor } from '@/app/alarm/[id]';
import { AllowDialog, CheckDemo, MATH_EXAMPLE, MathScene, Sky, SoundBars, SoundScene, Stage, WakeyLogo, WalkScene } from '@/components/OnboardingArt';
import TimeWheel from '@/components/TimeWheel';
import Wakey from '@/components/Wakey';
import { CtaButton, rise, Tap, WSwitch } from '@/components/white';
import { ARRIVE, W, WFont } from '@/constants/white';
import { useLocale } from '@/contexts/LocaleContext';
import { posthog } from '@/utils/analytics';
import { clockText, uses24h } from '@/utils/clockFormat';
import type { MathLevel } from '@/utils/math';
import { requestNotificationPermissions, scheduleAlarmNotification } from '@/utils/notifications';
import { bedtimes } from '@/utils/sleepCycle';
import { BUNDLED_SOUNDS, DEFAULT_SOUND_ID, getSoundName, previewSound, stopAlarmSound } from '@/utils/sounds';
import { type Alarm, generateId, saveAlarm } from '@/utils/storage';
import { nextAlarmDate } from '@/utils/time';
import { DEFAULT_MATH_LEVEL, DEFAULT_STEPS, MATH_LEVELS, MATH_PROBLEMS, STEP_OPTIONS } from '@/utils/wakeCheck';

// Curves first: worklets capture what they reference when they are created.
const LEAVE = Easing.bezier(0.55, 0, 1, 0.45);
/** The next step comes in from the side we're heading to. */
const pageIn = (dir: number) => () => {
    'worklet';
    return {
        initialValues: { opacity: 0, transform: [{ translateX: 28 * dir }] },
        animations: { opacity: withTiming(1, { duration: 280, easing: ARRIVE }), transform: [{ translateX: withTiming(0, { duration: 280, easing: ARRIVE }) }] },
    };
};
/** The step we leave slides a little the other way as it fades. */
const pageOut = (dir: number) => () => {
    'worklet';
    return {
        initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
        animations: { opacity: withTiming(0, { duration: 180, easing: LEAVE }), transform: [{ translateX: withTiming(-20 * dir, { duration: 180, easing: LEAVE }) }] },
    };
};

const STEPS = ['welcome', 'time', 'repeat', 'walk', 'math', 'check', 'sound', 'notify'] as const;
/** Ring-burst spacing per bundled sound, so Wakey rings in time with the preview. */
const TEMPO: Record<string, number> = { 'fast-alarm': 420, 'slow-alarm': 1000 };
const PREVIEW_MS = 3000; // previewSound stops itself after 3 s
const pad = (n: number) => String(n).padStart(2, '0');
const select = () => Haptics.selectionAsync().catch(() => {});

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
    const { t } = useLocale();
    const { width, height } = useWindowDimensions();
    const stageH = Math.round(Math.min(250, Math.max(170, height * 0.28)));
    const [index, setIndex] = useState(0);
    const [dir, setDir] = useState(1);
    const id = STEPS[index];

    const [mins, setMins] = useState(() => { const now = new Date(); return now.getHours() * 60 + now.getMinutes(); }); // starts at the time right now
    const [days, setDays] = useState([false, true, true, true, true, true, false]);
    const [steps, setSteps] = useState(DEFAULT_STEPS);
    const [mathLevel, setMathLevel] = useState<MathLevel>(DEFAULT_MATH_LEVEL);
    const [wakeCheck, setWakeCheck] = useState(true);
    const [checkArmed, setCheckArmed] = useState(false); // the switch flips on by itself once its step is up
    const [soundId, setSoundId] = useState(DEFAULT_SOUND_ID);
    const [playing, setPlaying] = useState<string | null>(null);
    const [woke, setWoke] = useState(false);
    const [saving, setSaving] = useState(false);
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const later = (key: string, ms: number, fn: () => void) => {
        clearTimeout(timers.current[key]);
        timers.current[key] = setTimeout(fn, ms);
    };

    // Direction first, then the step: the leaving page picks up the new direction before it unmounts.
    const go = useCallback((d: 1 | -1) => {
        setDir(d);
        requestAnimationFrame(() => setIndex(i => Math.min(STEPS.length - 1, Math.max(0, i + d))));
    }, []);
    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (index === 0) return false;
            go(-1);
            return true;
        });
        return () => sub.remove();
    }, [index, go]);

    // One event per screen shown; the PostHog funnel over `step` shows where people drop off.
    useEffect(() => {
        posthog.capture('onboarding_step_viewed', { step: id, index });
    }, [id, index]);
    useEffect(() => {
        if (id === 'check') later('check', 700, () => setCheckArmed(true));
        if (id !== 'sound') {
            setPlaying(null);
            void stopAlarmSound();
        }
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        const all = timers.current;
        return () => {
            Object.values(all).forEach(clearTimeout);
            void stopAlarmSound();
        };
    }, []);

    const play = (sound: string) => {
        setSoundId(sound);
        setPlaying(sound);
        setWoke(true);
        void previewSound(sound);
        later('sound', PREVIEW_MS, () => setPlaying(null));
    };

    const finish = async (askFirst: boolean) => {
        setSaving(true);
        if (askFirst) await requestNotificationPermissions(); // notifications, then AlarmKit
        const alarm: Alarm = {
            id: generateId(),
            time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`,
            label: t('onboarding.defaultLabel'),
            enabled: true,
            days,
            soundUri: soundId,
            createdAt: Date.now(),
            wakeCheck,
            steps,
            mathLevel,
        };
        posthog.capture('onboarding_completed', { steps, math_level: mathLevel, wake_check: wakeCheck, notifications_asked: askFirst });
        await saveAlarm(alarm).then(() => scheduleAlarmNotification(alarm));
        onComplete();
    };

    const hours = Math.floor(mins / 60);
    const bed = bedtimes(nextAlarmDate(hours, mins % 60, days, new Date()), new Date()).find(b => !b.passed);
    const handsAt = useMemo(() => new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60), [mins]);

    let page: ReactNode;
    switch (id) {
        case 'welcome':
            page = (
                <View style={s.welcome}>
                    <View style={s.logo}>
                        <WakeyLogo width={Math.min(250, width - 150)} />
                    </View>
                    <Animated.Text entering={rise(520)} style={[s.title, s.light, s.centerText]} accessibilityRole="header">
                        {t('onboarding.welcome.title')}
                    </Animated.Text>
                    <Animated.Text entering={rise(580)} style={[s.sub, s.lightSub, s.centerText]}>
                        {t('onboarding.welcome.body')}
                    </Animated.Text>
                </View>
            );
            break;
        case 'time':
            page = (
                <Page
                    stage={
                        <Stage height={stageH}>
                            <View style={s.center}>
                                <Wakey head size={Math.round(stageH * 0.7)} time={handsAt} mood={mins < 5 * 60 ? 'sleepy' : 'awake'} accessibilityLabel="Wakey" />
                            </View>
                        </Stage>
                    }
                    title={t('onboarding.time.title')}
                >
                    <TimeWheel minutes={mins} onChange={setMins} twelveHour={!uses24h()} accessibilityLabel={t('edit.wheelLabel')} ready />
                    <BedLine text={bed ? t('edit.bedByLine', { time: clockText(bed.at.getHours(), bed.at.getMinutes()), h: bed.cycles * 1.5 }) : null} />
                </Page>
            );
            break;
        case 'repeat':
            page = (
                <Page
                    stage={null}
                    title={t('onboarding.repeat.title')}
                >
                    <Repeat days={days} onChange={setDays} />
                </Page>
            );
            break;
        case 'walk':
            page = (
                <Page stage={<Stage height={stageH}><WalkScene goal={steps} height={stageH} /></Stage>} title={t('onboarding.walk.title')} sub={t('onboarding.walk.sub')}>
                    <View style={s.row3}>
                        {STEP_OPTIONS.map(n => (
                            <Option key={n} on={steps === n} onPress={() => setSteps(n)} style={s.optionThird} label={t('edit.stepsValue', { count: n })}>
                                <Text style={[s.optNum, steps === n && s.optOnText]}>{n}</Text>
                                <Text style={s.optCap}>{t('edit.steps')}</Text>
                            </Option>
                        ))}
                    </View>
                </Page>
            );
            break;
        case 'math':
            page = (
                <Page stage={<Stage height={stageH}><MathScene level={mathLevel} height={stageH} /></Stage>} title={t('onboarding.math.title')} sub={t('onboarding.math.sub', { count: MATH_PROBLEMS })}>
                    <View style={s.stack}>
                        {MATH_LEVELS.map(l => (
                            <Option key={l} on={mathLevel === l} onPress={() => setMathLevel(l)} style={s.optionRow} label={t(`edit.mathLevel_${l}`)}>
                                <Radio on={mathLevel === l} />
                                <View style={s.optText}>
                                    <Text style={s.optTitle}>{t(`edit.mathLevel_${l}`)}</Text>
                                    <Text style={s.optHint}>{t(l === 0 ? 'onboarding.math.easyHint' : 'onboarding.math.hardHint')}</Text>
                                </View>
                                <View style={[s.example, mathLevel === l && s.exampleOn]}>
                                    <Text style={s.exampleText} numberOfLines={1}>{MATH_EXAMPLE[l]}</Text>
                                </View>
                            </Option>
                        ))}
                    </View>
                </Page>
            );
            break;
        case 'check':
            page = (
                <Page stage={<Stage height={stageH}><CheckDemo height={stageH} /></Stage>} title={t('wakeCheck.title')} sub={t('onboarding.check.sub')}>
                    <View style={editor.group}>
                        <Row first icon="eye-outline" label={t('edit.wakeCheck')}>
                            <WSwitch
                                value={wakeCheck && checkArmed}
                                onValueChange={v => {
                                    setCheckArmed(true);
                                    setWakeCheck(v);
                                }}
                                accessibilityLabel={t('edit.wakeCheck')}
                            />
                        </Row>
                    </View>
                </Page>
            );
            break;
        case 'sound':
            page = (
                <Page
                    stage={<Stage height={stageH}><SoundScene playing={!!playing} period={TEMPO[playing ?? soundId] ?? 700} woke={woke} height={stageH} /></Stage>}
                    title={t('onboarding.sound.title')}
                    sub={t('onboarding.sound.sub')}
                >
                    <View style={s.stack}>
                        {BUNDLED_SOUNDS.map(b => (
                            <Option key={b.id} on={soundId === b.id} onPress={() => play(b.id)} style={s.optionRow} label={getSoundName(b.id)}>
                                <Radio on={soundId === b.id} />
                                <Text style={[s.optTitle, s.optText]}>{getSoundName(b.id)}</Text>
                                <SoundBars playing={playing === b.id} period={TEMPO[b.id] ?? 700} color={soundId === b.id ? W.blue : W.chev} />
                            </Option>
                        ))}
                    </View>
                </Page>
            );
            break;
        case 'notify':
            page = <Page stage={<Stage height={stageH} tone="#DCE3EE"><AllowDialog height={stageH} /></Stage>} title={t('onboarding.notify.title')} sub={t('onboarding.notify.sub', { allow: t('onboarding.notify.allowBtn') })} />;
            break;
    }

    return (
        <View style={s.root}>
            <StatusBar style={id === 'welcome' ? 'light' : 'dark'} />
            {id === 'welcome' && (
                <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(300)} exiting={FadeOut.duration(220)}>
                    <Sky />
                </Animated.View>
            )}
            <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
                <View style={s.header}>
                    {index > 0 && (
                        <Animated.View entering={FadeIn.duration(240)} exiting={FadeOut.duration(150)} style={s.headerRow}>
                            <Pressable onPress={() => go(-1)} style={s.back} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
                                <Ionicons name="chevron-back" size={24} color={W.ink} />
                            </Pressable>
                            <View style={s.progress} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: STEPS.length - 1, now: index }}>
                                {STEPS.slice(1).map((step, i) => (
                                    <Segment key={step} on={index >= i + 1} />
                                ))}
                            </View>
                            <View style={s.back} />
                        </Animated.View>
                    )}
                </View>

                <View style={s.body}>
                    <Animated.View key={id} entering={pageIn(dir)} exiting={pageOut(dir)} style={StyleSheet.absoluteFill}>
                        {page}
                    </Animated.View>
                </View>

                <View style={s.footer}>
                    {id === 'welcome' ? (
                        <Animated.View entering={rise(640)}>
                            <Tap style={s.ctaLight} onPress={() => go(1)}>
                                <Text style={s.ctaLightText}>{t('onboarding.welcome.cta')}</Text>
                            </Tap>
                        </Animated.View>
                    ) : id === 'notify' ? (
                        <>
                            <CtaButton label={t('onboarding.notify.allow')} onPress={() => finish(true)} disabled={saving} />
                            <Pressable onPress={() => finish(false)} disabled={saving} style={s.textButton} accessibilityRole="button" hitSlop={8}>
                                <Text style={s.textButtonText}>{t('onboarding.notify.notNow')}</Text>
                            </Pressable>
                        </>
                    ) : (
                        <CtaButton label={t('onboarding.continue')} onPress={() => go(1)} />
                    )}
                </View>
            </SafeAreaView>
        </View>
    );
}

/** A step's layout: its picture, the question, the control. Scrolls only when a small phone needs it. */
function Page({ stage, title, sub, children }: { stage: ReactNode; title: string; sub?: string; children?: ReactNode }) {
    return (
        <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false} bounces={false}>
            {stage}
            <Animated.Text entering={rise(60)} style={[s.title, s.pageTitle]} accessibilityRole="header">{title}</Animated.Text>
            {!!sub && <Animated.Text entering={rise(100)} style={s.sub}>{sub}</Animated.Text>}
            {!!children && <Animated.View entering={rise(140)} style={s.control}>{children}</Animated.View>}
        </ScrollView>
    );
}

/** One progress segment: fills from the left as its step is reached. */
function Segment({ on }: { on: boolean }) {
    const p = useSharedValue(0);
    useEffect(() => {
        p.value = withTiming(on ? 1 : 0, { duration: 420, easing: ARRIVE });
    }, [on, p]);
    const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
    return (
        <View style={s.seg}>
            <Animated.View style={[s.segFill, fill]} />
        </View>
    );
}

/** A choice card: Paper, turning Wakey Blue (soft fill, blue edge) when picked. */
function Option({ on, onPress, style, label, children }: { on: boolean; onPress: () => void; style?: StyleProp<ViewStyle>; label: string; children: ReactNode }) {
    return (
        <Tap
            style={[s.option, on && s.optionOn, style]}
            onPress={() => {
                select();
                onPress();
            }}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ selected: on }}
        >
            {children}
        </Tap>
    );
}

function Radio({ on }: { on: boolean }) {
    return <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>;
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: W.mist },
    safe: { flex: 1 },
    header: { height: 52, justifyContent: 'center' },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
    back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    progress: { flex: 1, flexDirection: 'row', gap: 4, paddingHorizontal: 8 },
    seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: W.hair, overflow: 'hidden' },
    segFill: { ...StyleSheet.absoluteFill, backgroundColor: W.blue, transformOrigin: 'left' },
    body: { flex: 1 },
    page: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    centerText: { textAlign: 'center' },

    welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 },
    logo: { marginBottom: 28 },
    light: { color: W.paper },
    lightSub: { color: 'rgba(255,255,255,0.88)' },

    title: { fontFamily: WFont.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: W.ink },
    pageTitle: { marginTop: 22 },
    sub: { marginTop: 6, fontFamily: WFont.regular, fontSize: 17, lineHeight: 24, color: W.graphite },
    control: { marginTop: 18 },

    row3: { flexDirection: 'row', gap: 10 },
    stack: { gap: 10 },
    option: { backgroundColor: W.paper, borderRadius: 20, borderWidth: 1.5, borderColor: W.hair },
    optionOn: { backgroundColor: W.blueSoft, borderColor: W.blue },
    optionThird: { flex: 1, alignItems: 'center', paddingVertical: 14 },
    optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 64, paddingVertical: 12 },
    optNum: { fontFamily: WFont.heavy, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: W.ink, fontVariant: ['tabular-nums'] },
    optOnText: { color: W.blueText },
    optCap: { fontFamily: WFont.medium, fontSize: 13, lineHeight: 18, color: W.graphite },
    optText: { flex: 1 },
    optTitle: { fontFamily: WFont.bold, fontSize: 17, lineHeight: 22, color: W.ink },
    optHint: { fontFamily: WFont.medium, fontSize: 13, lineHeight: 18, color: W.graphite },
    example: { borderRadius: 10, backgroundColor: W.mist, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 140 },
    exampleOn: { backgroundColor: W.paper },
    exampleText: { fontFamily: WFont.bold, fontSize: 14, color: W.ink, fontVariant: ['tabular-nums'] },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: W.chev, alignItems: 'center', justifyContent: 'center' },
    radioOn: { borderColor: W.blue },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: W.blue },

    footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 4 },
    ctaLight: { height: 56, borderRadius: 999, backgroundColor: W.paper, alignItems: 'center', justifyContent: 'center' },
    ctaLightText: { fontFamily: WFont.bold, fontSize: 17, color: W.cta },
    textButton: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
    textButtonText: { fontFamily: WFont.semibold, fontSize: 17, color: W.graphite },
});
