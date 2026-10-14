/** Onboarding: the hook, the questions, the proof and the plan built from the answers. */
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import Mascot from '@/components/Mascot';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { appear, Choice, Cta, Rise, rise, type StepProps, styles as k, Title } from './kit';

type IconName = keyof typeof Ionicons.glyphMap;

/** One small bell wiggle shortly after the screen opens; no loop. */
function useRingOnce() {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withDelay(500, withSequence(...[4, -4, 3, -3, 0].map((d) => withTiming(d, { duration: 90 }))));
  }, [r]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
}

export function Welcome({ next }: StepProps) {
  const { t } = useLocale();
  const ring = useRingOnce();
  return (
    <>
      <View style={s.hero}>
        <Animated.View entering={appear(0)} style={ring}>
          <Mascot mood="alarm" size={210} />
        </Animated.View>
        <Animated.Text entering={rise(2)} style={s.heroTitle} accessibilityRole="header">
          {t('onboarding.welcomeTitle')}
        </Animated.Text>
        <Animated.Text entering={rise(3)} style={s.heroBody}>
          {t('onboarding.welcomeBody')}
        </Animated.Text>
      </View>
      <Cta label={t('onboarding.welcomeCta')} onPress={next} />
    </>
  );
}

export const GOALS = ['snooze', 'sleep', 'shift', 'back', 'routine'] as const;

export function Goal({ a, set, next }: StepProps) {
  const { t } = useLocale();
  return (
    <>
      <Title sub={t('onboarding.goalSub')}>{t('onboarding.goalTitle')}</Title>
      <View style={s.list}>
        {GOALS.map((g, i) => (
          <Choice key={g} i={i} label={t(`onboarding.goal_${g}`)} on={a.goal === g} onPress={() => set({ goal: g })} />
        ))}
      </View>
      <Cta label={t('onboarding.continue')} onPress={next} disabled={!a.goal} />
    </>
  );
}

export const PAINS = ['snooze', 'gentle', 'halfAsleep', 'days', 'many'] as const;

export function Pains({ a, set, next }: StepProps) {
  const { t } = useLocale();
  const toggle = (p: string) => set({ pains: a.pains.includes(p) ? a.pains.filter((x) => x !== p) : [...a.pains, p] });
  return (
    <>
      <Title sub={t('onboarding.painsSub')}>{t('onboarding.painsTitle')}</Title>
      <View style={s.list}>
        {PAINS.map((p, i) => (
          <Choice key={p} i={i} multi label={t(`onboarding.pain_${p}`)} on={a.pains.includes(p)} onPress={() => toggle(p)} />
        ))}
      </View>
      <Cta label={t('onboarding.continue')} onPress={next} disabled={a.pains.length === 0} />
    </>
  );
}

// TODO: placeholder reviews; replace with real App Store reviews once there are some.
const REVIEWS = [1, 2, 3] as const;

export function Proof({ next }: StepProps) {
  const { t } = useLocale();
  return (
    <>
      <Title>{t('onboarding.proofTitle')}</Title>
      <View style={s.list}>
        {REVIEWS.map((n, i) => (
          <Animated.View key={n} entering={rise(i + 1)} style={[k.card, s.review]}>
            <View style={s.reviewHead}>
              <View style={s.stars} accessibilityLabel="5/5">
                {[0, 1, 2, 3, 4].map((j) => (
                  <Ionicons key={j} name="star" size={16} color={Colors.accent} />
                ))}
              </View>
              <View style={s.tag}>
                <Text style={s.tagText}>{t(`onboarding.proof${n}Tag`)}</Text>
              </View>
            </View>
            <Text style={k.body}>{t(`onboarding.proof${n}`)}</Text>
          </Animated.View>
        ))}
      </View>
      <Cta label={t('onboarding.continue')} onPress={next} />
    </>
  );
}

const CMP = ['snooze', 'days', 'once', 'back'] as const;

export function Compare({ next }: StepProps) {
  const { t } = useLocale();
  return (
    <>
      <Title>{t('onboarding.compareTitle')}</Title>
      <Rise i={1} style={[k.card, s.table]}>
        <View style={s.tRow}>
          <Text style={[s.tHead, s.tLabel]} />
          <Text style={[s.tHead, s.tCell]}>{t('onboarding.comparePhone')}</Text>
          <Text style={[s.tHead, s.tCell, { color: Colors.primary }]}>Wakey</Text>
        </View>
        {CMP.map((c, i) => (
          <View key={c} style={[s.tRow, s.tLine]}>
            <Animated.Text entering={appear(200 + i * 120)} style={[s.tLabelText, s.tLabel]}>
              {t(`onboarding.cmp_${c}`)}
            </Animated.Text>
            <Animated.View entering={appear(200 + i * 120)} style={[s.tCell, s.tPair]}>
              <Ionicons name="close" size={16} color={Colors.danger} />
              <Text style={s.tPhone}>{t(`onboarding.cmp_${c}Phone`)}</Text>
            </Animated.View>
            <Animated.View entering={appear(300 + i * 120)} style={[s.tCell, s.tPair]}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.green500} />
              <Text style={s.tWakey}>{t(`onboarding.cmp_${c}Wakey`)}</Text>
            </Animated.View>
          </View>
        ))}
      </Rise>
      <Cta label={t('onboarding.continue')} onPress={next} />
    </>
  );
}

const VS: { key: string; others: boolean }[] = [
  { key: 'missions', others: true },
  { key: 'days', others: false },
  { key: 'once', others: false },
  { key: 'level', others: false },
  { key: 'back', others: false },
];
const VS_STEP = 150;

export function Versus({ next }: StepProps) {
  const { t } = useLocale();

  return (
    <>
      <Title sub={t('onboarding.versusSub')}>{t('onboarding.versusTitle')}</Title>
      <View>
        <View style={s.vsHead}>
          <View style={s.tLabel} />
          <Animated.View entering={appear(150)} style={s.vsCol}>
            <View style={s.vsOthers}>
              <Ionicons name="alarm-outline" size={22} color={Colors.ink400} />
            </View>
            <Text style={s.vsName}>{t('onboarding.versusOthers')}</Text>
          </Animated.View>
          <Animated.View entering={appear(150)} style={s.vsCol}>
            <View style={s.vsWakey}>
              <Mascot mood="happy" size={44} />
            </View>
            <Text style={[s.vsName, { color: Colors.primary }]}>Wakey</Text>
          </Animated.View>
        </View>
        <Animated.View entering={appear(250)} style={s.vsBadge}>
          <Text style={s.vsBadgeText}>VS</Text>
        </Animated.View>
      </View>
      <View style={[k.card, s.table]}>
        {VS.map((row, i) => {
          const at = 300 + i * VS_STEP;
          return (
            <View key={row.key} style={[s.tRow, i > 0 && s.tLine, { alignItems: 'center' }]}>
              <Animated.Text entering={appear(at)} style={[s.tLabelText, s.tLabel]}>
                {t(`onboarding.vs_${row.key}`)}
              </Animated.Text>
              <Animated.View entering={appear(at)} style={s.vsCol}>
                {row.others ? (
                  <Ionicons name="checkmark-circle" size={30} color={Colors.ink400} />
                ) : (
                  <Ionicons name="close-circle-outline" size={30} color={Colors.ink200} />
                )}
              </Animated.View>
              <Animated.View entering={appear(at + 80)} style={s.vsCol}>
                <Ionicons name="checkmark-circle" size={30} color={Colors.primary} />
              </Animated.View>
            </View>
          );
        })}
      </View>
      <Animated.View entering={appear(300 + VS.length * VS_STEP)} style={s.vsFoot}>
        <Text style={[k.small, { flex: 1 }]}>{t('onboarding.versusFoot')}</Text>
      </Animated.View>
      <Cta label={t('onboarding.continue')} onPress={next} />
    </>
  );
}

const FIX: Record<string, { icon: IconName; key: (a: StepProps['a']) => string }> = {
  snooze: { icon: 'footsteps', key: (a) => (a.mission === 'walk' || a.mission === 'both' ? 'fix_snooze_walk' : a.mission === 'math' ? 'fix_snooze_math' : 'fix_gentle') },
  gentle: { icon: 'notifications', key: () => 'fix_gentle' },
  halfAsleep: { icon: 'refresh', key: () => 'fix_halfAsleep' },
  days: { icon: 'calendar', key: () => 'fix_days' },
  many: { icon: 'time', key: () => 'fix_many' },
};

/** One pain, struck through, with its fix sliding in underneath. */
function FixRow({ pain, fix, icon, i }: { pain: string; fix: string; icon: IconName; i: number }) {
  const strike = useSharedValue(0);
  const delay = 200 + i * 200;
  useEffect(() => {
    strike.value = withDelay(delay + 150, withTiming(1, { duration: 250, easing: Easing.out(Easing.cubic) }));
  }, [strike, delay]);
  const line = useAnimatedStyle(() => ({ transform: [{ scaleX: strike.value }] }));
  return (
    <Animated.View entering={appear(delay - 100)} style={[k.card, s.fix]}>
      <Animated.View entering={appear(delay)} style={s.fixIcon}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </Animated.View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ alignSelf: 'flex-start' }}>
          <Text style={s.pain}>{pain}</Text>
          <Animated.View style={[s.strike, line]} />
        </View>
        <Animated.Text entering={appear(delay + 250)} style={s.fixText}>
          {fix}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}

export function Plan({ a, next }: StepProps) {
  const { t } = useLocale();
  const picked = (a.pains.length ? a.pains : ['snooze', 'halfAsleep', 'days']).slice(0, 4);
  return (
    <>
      <Title>{t('onboarding.planTitle')}</Title>
      <View style={s.list}>
        {picked.map((p, i) => (
          <FixRow
            key={p}
            i={i}
            icon={p === 'snooze' && a.mission === 'math' ? 'calculator' : FIX[p].icon}
            pain={t(`onboarding.pain_${p}`)}
            fix={t(`onboarding.${FIX[p].key(a)}`, { count: a.steps })}
          />
        ))}
      </View>
      <Cta label={t('onboarding.planCta')} onPress={next} />
    </>
  );
}

const s = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
  heroTitle: { fontFamily: FontFamily.displayBold, fontSize: 40, lineHeight: 46, color: Colors.ink900, textAlign: 'center' },
  heroBody: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.lg, color: Colors.textMuted, textAlign: 'center', maxWidth: 300 },
  list: { gap: Spacing.sm + 2 },

  review: { gap: Spacing.sm, padding: Spacing.lg },
  reviewHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stars: { flexDirection: 'row', gap: 2 },
  tag: { backgroundColor: Colors.blue50, borderRadius: BorderRadius.pill, paddingHorizontal: Spacing.sm + 2, paddingVertical: 3 },
  tagText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.blue700 },

  table: { padding: 0, overflow: 'hidden' },
  tRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  tLine: { borderTopWidth: 1, borderTopColor: Colors.ink100 },
  tHead: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textMuted },
  tLabel: { flex: 0.9 },
  tLabelText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.ink900 },
  tCell: { flex: 1 },
  tPair: { flexDirection: 'row', gap: 4, alignItems: 'flex-start' },
  tPhone: { flex: 1, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.ink400 },
  tWakey: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.ink900 },

  vsHead: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: Spacing.md, gap: Spacing.sm },
  vsCol: { width: 64, alignItems: 'center', gap: 4 },
  vsOthers: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.ink100, alignItems: 'center', justifyContent: 'center' },
  vsWakey: { width: 56, height: 56, borderRadius: 16, borderWidth: 3, borderColor: Colors.primary, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center', ...Shadow.blue },
  vsName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.ink400 },
  vsBadge: {
    position: 'absolute',
    right: 64,
    top: 10,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.sm,
  },
  vsBadgeText: { fontFamily: FontFamily.displayBold, fontSize: FontSize.sm, color: Colors.onAccent },
  vsFoot: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },

  fix: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  fixIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.blue50, alignItems: 'center', justifyContent: 'center' },
  pain: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.sm, color: Colors.ink400 },
  strike: { position: 'absolute', left: 0, right: 0, top: '50%', height: 2, backgroundColor: Colors.ink400, transformOrigin: 'left' },
  fixText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.ink900 },
});
