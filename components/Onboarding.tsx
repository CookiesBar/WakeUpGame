// First-launch flow: build the alarm → try the game → tune it → story → notifications →
// personalizing. The hard paywall in _layout follows.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

import Mascot from '@/components/Mascot';

import Pressable from '@/components/Pressable';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/wakeyTheme';
import { useLocale } from '@/contexts/LocaleContext';
import { posthog } from '@/utils/analytics';
import { scheduleAlarmNotification } from '@/utils/notifications';
import { DEFAULT_SOUND_ID } from '@/utils/sounds';
import { type Alarm, generateId, saveAlarm } from '@/utils/storage';
import { DEFAULT_MATH_LEVEL, DEFAULT_STEPS } from '@/utils/wakeCheck';
import { ease } from './onboarding/kit';
import { type Answers, type Draft, pageExit, STEPS, VIEWS } from './onboarding/steps';

const pad = (n: number) => String(n).padStart(2, '0');

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
    const { t } = useLocale();
    // Visited step indexes; Back pops, Continue / Skip (game only) push.
    const [history, setHistory] = useState([0]);
    const index = history[history.length - 1];
    const id = STEPS[index];

    const [answers, setAnswersState] = useState<Answers>({ goal: null, pains: [] });
    const [draft, setDraft] = useState<Draft>(() => ({
        hours: 7,
        minutes: 0,
        days: [false, true, true, true, true, true, false],
        steps: DEFAULT_STEPS,
        mathLevel: DEFAULT_MATH_LEVEL,
        soundId: DEFAULT_SOUND_ID,
        wakeCheck: true,
        label: t('onboarding.defaultLabel'),
    }));

    const next = useCallback(() => setHistory(h => [...h, Math.min(h[h.length - 1] + 1, STEPS.length - 1)]), []);
    const back = useCallback(() => setHistory(h => (h.length > 1 ? h.slice(0, -1) : h)), []);

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (history.length === 1) return false;
            back();
            return true;
        });
        return () => sub.remove();
    }, [history.length, back]);

    // One event per screen shown; the PostHog funnel over `step` shows where people drop off.
    useEffect(() => {
        posthog.capture('onboarding_step_viewed', { step: id, index });
    }, [id, index]);

    const [personalizing, setPersonalizing] = useState(false);

    // The alarm built here is saved for real, so the user lands on a working alarm.
    const finish = useCallback(async () => {
        const alarm: Alarm = {
            id: generateId(),
            time: `${pad(draft.hours)}:${pad(draft.minutes)}`,
            label: draft.label.trim() || t('onboarding.defaultLabel'),
            enabled: true,
            days: draft.days,
            soundUri: draft.soundId,
            createdAt: Date.now(),
            wakeCheck: draft.wakeCheck,
            steps: draft.steps,
            mathLevel: draft.mathLevel,
        };
        posthog.capture('onboarding_completed', {
            goal: answers.goal,
            pains: answers.pains,
            steps: draft.steps,
            math_level: draft.mathLevel,
            wake_check: draft.wakeCheck,
            screens_seen: history.length,
        });
        setPersonalizing(true);
        // Hold the personalizing screen long enough for all three lines to land.
        await Promise.all([
            saveAlarm(alarm).then(() => scheduleAlarmNotification(alarm)),
            new Promise(r => setTimeout(r, 3600)),
        ]);
        onComplete();
    }, [draft, answers, history.length, onComplete, t]);

    const progress = useSharedValue(0);
    useEffect(() => {
        progress.value = withTiming(index / (STEPS.length - 1), { duration: 500, easing: ease });
    }, [index, progress]);
    const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

    const Step = VIEWS[id];

    if (personalizing) return <Personalizing />;

    return (
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <View style={styles.side}>
                    {history.length > 1 && (
                        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
                            <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
                                <Ionicons name="chevron-back" size={22} color={Colors.ink900} />
                            </Pressable>
                        </Animated.View>
                    )}
                </View>
                <View style={styles.track}>
                    <Animated.View style={[styles.fill, barStyle]} />
                </View>
                <View style={[styles.side, styles.right]}>
                    {id === 'game' && (
                        <Pressable onPress={next} accessibilityRole="button" hitSlop={8}>
                            <Text style={styles.skip}>{t('onboarding.skip')}</Text>
                        </Pressable>
                    )}
                </View>
            </View>

            <View style={styles.body}>
                <Animated.View key={`${index}-${history.length}`} exiting={pageExit} style={StyleSheet.absoluteFill}>
                    <Step
                        draft={draft}
                        set={patch => setDraft(d => ({ ...d, ...patch }))}
                        answers={answers}
                        setAnswers={patch => setAnswersState(a => ({ ...a, ...patch }))}
                        next={next}
                        finish={finish}
                    />
                </Animated.View>
            </View>
        </KeyboardAvoidingView>
    );
}

/** Closing beat: the mascot floats while the "personalizing" lines tick off one by one. */
function Personalizing() {
    const { t } = useLocale();
    const [done, setDone] = useState(0);
    const y = useSharedValue(0);
    useEffect(() => {
        y.value = withRepeat(
            withSequence(
                withTiming(-14, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
                withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
            ),
            -1,
        );
        const timer = setInterval(() => setDone(d => Math.min(d + 1, 3)), 1000);
        return () => clearInterval(timer);
    }, [y]);
    const float = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
    return (
        <Animated.View entering={FadeIn.duration(250)} style={[styles.root, styles.personal]}>
            <Animated.View style={float}>
                <Mascot mood="happy" size={220} />
            </Animated.View>
            <Text style={styles.personalTitle}>{t('onboarding.review.personalTitle')}</Text>
            {[1, 2, 3].map(n => (
                <View key={n} style={[styles.personalRow, n > done + 1 && { opacity: 0.3 }]}>
                    <Ionicons
                        name={n <= done ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={n <= done ? Colors.primary : Colors.ink400}
                    />
                    <Text style={styles.personalText}>{t(`onboarding.review.personal${n}`)}</Text>
                </View>
            ))}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: Colors.paper },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
    },
    side: { width: 72, height: 40, justifyContent: 'center' },
    right: { alignItems: 'flex-end' },
    back: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    track: { flex: 1, height: 6, borderRadius: BorderRadius.pill, backgroundColor: Colors.ink100, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: BorderRadius.pill, backgroundColor: Colors.primary },
    skip: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.ink500 },
    body: { flex: 1 },
    personal: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
    personalTitle: {
        fontFamily: FontFamily.displayBold,
        fontSize: FontSize.h2,
        color: Colors.ink900,
        textAlign: 'center',
        marginTop: Spacing.xl,
        marginBottom: Spacing.md,
    },
    personalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'stretch', paddingHorizontal: Spacing.xl },
    personalText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.ink700 },
});
