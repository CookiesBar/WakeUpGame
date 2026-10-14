/** Onboarding: permissions (explained before the system asks), saving the routines, and the hand-off to home. */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import AlarmClock from '@/components/AlarmClock';
import Mascot from '@/components/Mascot';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { requestNotificationPermissions } from '@/utils/notifications';
import { missionLabel } from '@/utils/repeatLabel';
import { type Alarm, setOnboarding } from '@/utils/storage';
import { formatTime, use24h } from '@/utils/time';
import { appear, Cta, dateAt, haptic, minutesOf, Rise, type StepProps, styles as k, useSweep, WEEK, weekdayName } from './kit';

/** One small bell wiggle after the screen opens; no loop, no buzz. */
function useRingOnce() {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withDelay(500, withSequence(...[4, -4, 3, -3, 0].map((d) => withTiming(d, { duration: 90 }))));
  }, [r]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={s.bullets}>
      {items.map((text, i) => (
        <Rise key={text} i={i + 2} style={s.bullet}>
          <Ionicons name="checkmark-circle" size={22} color={Colors.green500} />
          <Text style={[k.body, { flex: 1 }]}>{text}</Text>
        </Rise>
      ))}
    </View>
  );
}

export function Notify({ next }: StepProps) {
  const { t } = useLocale();
  const ring = useRingOnce();
  return (
    <>
      <View style={s.prime}>
        <Animated.View entering={appear(0)} style={[s.center, ring]}>
          <Mascot mood="alarm" size={160} />
        </Animated.View>
        <Rise i={1}>
          <Text style={[k.title, s.centerText]}>{t('onboarding.notifyTitle')}</Text>
        </Rise>
        <Bullets items={[t('onboarding.notify1'), t('onboarding.notify2'), t('onboarding.notify3')]} />
      </View>
      <Cta
        label={t('onboarding.notifyCta')}
        onPress={async () => {
          await requestNotificationPermissions().catch(() => false);
          next();
        }}
        ghost={t('onboarding.notNow')}
        onGhost={next}
      />
    </>
  );
}

export function MotionStep({ next }: StepProps) {
  const { t } = useLocale();
  return (
    <>
      <View style={s.prime}>
        <View style={s.center}>
          <Animated.View entering={appear(0)}>
            <Mascot mood="shake" size={150} />
          </Animated.View>
          <View style={s.prints}>
            {[0, 1, 2, 3].map((i) => (
              <Animated.View key={i} entering={appear(200 + i * 120)} style={{ transform: [{ rotate: i % 2 ? '12deg' : '-12deg' }] }}>
                <Ionicons name="footsteps" size={22} color={Colors.blue300} />
              </Animated.View>
            ))}
          </View>
        </View>
        <Rise i={1}>
          <Text style={[k.title, s.centerText]}>{t('onboarding.motionTitle')}</Text>
        </Rise>
        <Bullets items={[t('onboarding.motion1'), t('onboarding.motion2')]} />
      </View>
      <Cta
        label={t('onboarding.motionCta')}
        onPress={async () => {
          if (Platform.OS !== 'web') await Pedometer.requestPermissionsAsync().catch(() => null);
          next();
        }}
        ghost={t('onboarding.notNow')}
        onGhost={next}
      />
    </>
  );
}

const MIN_BUILD_MS = 2600;

/** Saves the real routines while the clock sweeps to the wake-up time. Runs once. */
export function Building({ a, next }: StepProps) {
  const { t, locale } = useLocale();
  const h24 = use24h();
  const { addRoutine } = useAlarms();
  const wake = minutesOf(a.time);
  const minute = useSweep(wake - 300, wake, 1800, 200);
  const [ticks, setTicks] = useState(0);
  const started = useRef(false);
  const days = WEEK.filter((d) => a.days.includes(d));
  const starter: Partial<Alarm> = { time: a.time, mission: a.mission, steps: a.steps, wakeCheck: a.wakeCheck };
  const lines = [
    t('onboarding.builtDays', { days: days.map((d) => weekdayName(locale, d)).join(', '), time: formatTime(a.time, h24).display }),
    missionLabel(starter as Alarm, t),
    ...(a.wakeCheck ? [t('alarmEditor.wakeCheck')] : []),
  ];

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const ids = lines.map((_, i) => setTimeout(() => setTicks(i + 1), 500 + i * 600));
    const t0 = Date.now();
    (async () => {
      for (const d of days) await addRoutine(t('routines.defaultName', { day: weekdayName(locale, d, 'long') }), [d], starter);
      await setOnboarding({ goal: a.goal, pains: a.pains, doneAt: Date.now() });
      setTimeout(() => {
        haptic.win();
        next();
      }, Math.max(0, MIN_BUILD_MS - (Date.now() - t0)));
    })();
    return () => ids.forEach(clearTimeout);
    // Saving must happen exactly once, with the answers as they were on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={s.building}>
      <Animated.View entering={appear(0)}>
        <AlarmClock size={220} now={dateAt(minute)} alarms={[{ minutes: wake, passed: false }]} label={t('onboarding.buildingTitle')} />
      </Animated.View>
      <Text style={k.title}>{t('onboarding.buildingTitle')}</Text>
      <View style={s.checklist}>
        {lines.map((line, i) => (
          <View key={line} style={s.bullet}>
            {i < ticks ? (
              <Animated.View entering={appear(0)}>
                <Ionicons name="checkmark-circle" size={22} color={Colors.green500} />
              </Animated.View>
            ) : (
              <Ionicons name="ellipse-outline" size={22} color={Colors.ink200} />
            )}
            <Text style={[k.body, i >= ticks && { color: Colors.ink400 }]}>{line}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Ready({ a }: StepProps) {
  const { t, locale } = useLocale();
  const h24 = use24h();
  const time = formatTime(a.time, h24);
  const timeText = time.meridiem ? `${time.display} ${time.meridiem}` : time.display;
  const days = WEEK.filter((d) => a.days.includes(d));

  const share = () =>
    Share.share({ message: t('onboarding.shareText', { time: timeText, days: days.map((d) => weekdayName(locale, d)).join(', ') }) }).catch(() => {});

  return (
    <>
      <View style={s.readyHead}>
        <Animated.View entering={appear(0)}>
          <Mascot mood="happy" size={96} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Rise i={1}>
            <Text style={k.title}>{t('onboarding.readyTitle')}</Text>
          </Rise>
          <Rise i={2}>
            <Text style={k.sub}>{t('onboarding.readySub', { time: timeText })}</Text>
          </Rise>
        </View>
      </View>
      <Rise i={3} style={[k.card, s.preview]}>
        <AlarmClock size={190} now={new Date()} alarms={[{ minutes: minutesOf(a.time), passed: false }]} label={t('onboarding.readySub', { time: timeText })} />
        <View style={s.dayRow}>
          {WEEK.map((d, i) => {
            const on = a.days.includes(d);
            return (
              <Animated.View key={d} entering={appear(300 + i * 60)} style={[s.dayDot, on ? s.dayDotOn : s.dayDotOff]}>
                <Text style={[s.dayDotName, on && { color: Colors.onBrand }]} numberOfLines={1} adjustsFontSizeToFit>
                  {weekdayName(locale, d)}
                </Text>
                {on && <Text style={s.dayDotTime} numberOfLines={1} adjustsFontSizeToFit>{time.display}</Text>}
              </Animated.View>
            );
          })}
        </View>
      </Rise>
      <Cta label={t('onboarding.readyCta')} onPress={() => router.replace('/')} ghost={t('onboarding.share')} onGhost={share} />
    </>
  );
}

const s = StyleSheet.create({
  center: { alignSelf: 'center', alignItems: 'center' },
  centerText: { textAlign: 'center' },
  prime: { flex: 1, justifyContent: 'center', gap: Spacing.xl },
  bullets: { gap: Spacing.md, paddingHorizontal: Spacing.sm },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  prints: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  building: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
  checklist: { gap: Spacing.md, alignSelf: 'stretch', paddingHorizontal: Spacing.xl },
  readyHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  preview: { alignItems: 'center', gap: Spacing.lg },
  dayRow: { flexDirection: 'row', gap: 4, alignSelf: 'stretch' },
  dayDot: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 12, gap: 1 },
  dayDotOn: { backgroundColor: Colors.primary },
  dayDotOff: { borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.ink200 },
  dayDotName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.ink400 },
  dayDotTime: { fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.onBrand, fontVariant: ['tabular-nums'] },
});
