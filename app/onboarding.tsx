import { Ionicons } from '@expo/vector-icons';
import { type ComponentType, useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Pressable from '@/components/Pressable';
import ScreenBackground from '@/components/ScreenBackground';
import { Building, MotionStep, Notify, Ready } from '@/components/onboarding/FinishSteps';
import { Compare, Goal, Pains, Plan, Proof, Versus, Welcome } from '@/components/onboarding/IntroSteps';
import { type Answers, INITIAL_ANSWERS, type StepProps } from '@/components/onboarding/kit';
import { ClockStep, DayStep, MissionStep, Practice, RoutineStep, SwitchStep, WeekStep } from '@/components/onboarding/LearnSteps';
import { Colors, Spacing } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';

interface Step {
  C: ComponentType<StepProps>;
  /** Shown only when this holds for the answers so far. */
  when?: (a: Answers) => boolean;
  /** No way back from here (saving / done). */
  final?: boolean;
}

const STEPS: Step[] = [
  { C: Welcome },
  { C: Goal },
  { C: Pains },
  { C: Proof },
  { C: ClockStep },
  { C: WeekStep },
  { C: RoutineStep },
  { C: MissionStep },
  { C: Practice },
  { C: DayStep },
  { C: SwitchStep },
  { C: Compare },
  { C: Versus },
  { C: Plan },
  { C: Notify },
  { C: MotionStep, when: (a) => a.mission === 'walk' || a.mission === 'both' },
  { C: Building, final: true },
  { C: Ready, final: true },
];

/** First-launch flow: a few questions, then the home screen taught hands-on, ending with real routines saved. */
export default function OnboardingScreen() {
  const { t } = useLocale();
  const [a, setA] = useState<Answers>(INITIAL_ANSWERS);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const steps = STEPS.filter((s) => !s.when || s.when(a));
  const step = steps[Math.min(i, steps.length - 1)];
  const canBack = i > 0 && !step.final;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming((i + 1) / steps.length, { duration: 300 });
  }, [i, steps.length, progress]);
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  const go = (d: 1 | -1) => {
    setDir(d);
    setI((n) => Math.max(0, Math.min(steps.length - 1, n + d)));
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canBack) go(-1);
      return true; // never leave onboarding with the back button
    });
    return () => sub.remove();
  });

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          {canBack ? (
            <Pressable onPress={() => go(-1)} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t('common.back')}>
              <Ionicons name="chevron-back" size={24} color={Colors.ink900} />
            </Pressable>
          ) : (
            <View style={styles.back} />
          )}
          <View
            style={styles.track}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('onboarding.step', { n: i + 1, count: steps.length })}
          >
            <Animated.View style={[styles.fill, bar]} />
          </View>
          <View style={styles.back} />
        </View>
        <Animated.View
          key={i}
          entering={(dir > 0 ? FadeInRight : FadeInLeft).duration(240).withInitialValues({ opacity: 0, transform: [{ translateX: dir * 24 }] })}
          exiting={FadeOut.duration(140)}
          style={styles.page}
        >
          <step.C a={a} set={(patch) => setA((prev) => ({ ...prev, ...patch }))} next={() => go(1)} />
        </Animated.View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, height: 48 },
  back: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: Colors.ink100, overflow: 'hidden' },
  fill: { flex: 1, borderRadius: 4, backgroundColor: Colors.primary, transformOrigin: 'left' },
  page: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.lg },
});
