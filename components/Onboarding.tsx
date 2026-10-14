// First-launch flow: story → try the game → one alarm setting per step → create the alarm.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import Pressable from '@/components/Pressable';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/wakeyTheme';
import { useLocale } from '@/contexts/LocaleContext';
import { scheduleAlarmNotification } from '@/utils/notifications';
import { DEFAULT_SOUND_ID } from '@/utils/sounds';
import { type Alarm, generateId, saveAlarm } from '@/utils/storage';
import { DEFAULT_MATH_LEVEL, DEFAULT_STEPS } from '@/utils/wakeCheck';
import { ease } from './onboarding/kit';
import { type Answers, type Draft, pageExit, STEPS, type StepId, VIEWS } from './onboarding/steps';

const pad = (n: number) => String(n).padStart(2, '0');
const REVIEW = STEPS.indexOf('review');

export default function Onboarding({ onComplete }: { onComplete: () => void }) {
    const { t } = useLocale();
    // Visited step indexes; Back pops, Skip / review rows push.
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

    const goTo = useCallback((step: StepId) => setHistory(h => [...h, STEPS.indexOf(step)]), []);
    // Once the review has been seen (Skip or the end), Continue on an edited setting returns to it.
    const next = useCallback(
        () => setHistory(h => [...h, h.includes(REVIEW) ? REVIEW : Math.min(h[h.length - 1] + 1, REVIEW)]),
        [],
    );
    const back = useCallback(() => setHistory(h => (h.length > 1 ? h.slice(0, -1) : h)), []);

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (history.length === 1) return false;
            back();
            return true;
        });
        return () => sub.remove();
    }, [history.length, back]);

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
        // Short beat so "Setting your alarm…" reads as a moment, not a flicker.
        await Promise.all([
            saveAlarm(alarm).then(() => scheduleAlarmNotification(alarm)),
            new Promise(r => setTimeout(r, 900)),
        ]);
        onComplete();
    }, [draft, onComplete, t]);

    const progress = useSharedValue(0);
    useEffect(() => {
        progress.value = withTiming(index / (STEPS.length - 1), { duration: 500, easing: ease });
    }, [index, progress]);
    const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

    const Step = VIEWS[id];
    const isLast = id === 'review';

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
                    {!isLast && (
                        <Pressable onPress={() => goTo('review')} accessibilityRole="button" hitSlop={8}>
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
                        goTo={goTo}
                        finish={finish}
                    />
                </Animated.View>
            </View>
        </KeyboardAvoidingView>
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
});
