import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Pressable from '@/components/Pressable';
import Mascot from '@/components/Mascot';
import ScreenBackground from '@/components/ScreenBackground';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { repeatOf, stepsOf } from '@/utils/routines';
import { dayState, hhmm } from '@/utils/schedule';
import { formatTime, use24h } from '@/utils/time';

const STEP_MIN = 15;

/** One day of the week strip: skip or move each routine for this day only. */
export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { alarms, routines, setDayChange } = useAlarms();
  const { t, locale } = useLocale();
  const h24 = use24h();
  const day = new Date(`${date}T00:00`);
  const clock = (d: Date) => {
    const { display, meridiem } = formatTime(hhmm(d), h24);
    return { display, meridiem };
  };

  const rows = routines
    .filter((r) => r.enabled && r.days.length > 0)
    .flatMap((r) => {
      const first = stepsOf(r, alarms)[0];
      const s = first && dayState({ ...first, ...repeatOf(r), exceptions: r.exceptions }, day);
      return s ? [{ routine: r, ...s, change: r.exceptions?.[date] }] : [];
    });

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <View style={styles.wakeyRow}>
            <Mascot mood="happy" size={64} />
            <Text style={styles.only}>{t('day.only')}</Text>
          </View>

          {rows.length === 0 && <Text style={styles.none}>{t('day.none')}</Text>}

          {rows.map(({ routine, state, fire, base, change }) => {
            const shown = clock(fire ?? base);
            return (
              <View key={routine.id} style={styles.card}>
                <View style={styles.timeRow}>
                  <Text style={[styles.time, state === 'skipped' && styles.timeSkipped]}>
                    {shown.display}
                    {!!shown.meridiem && <Text style={styles.meridiem}> {shown.meridiem}</Text>}
                  </Text>
                  {state === 'moved' && <Text style={styles.was}>{clock(base).display}</Text>}
                  <Text style={styles.name} numberOfLines={1}>
                    {routine.name.trim() || t('routines.fallback')}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Chip
                    label={state === 'skipped' ? t('day.unskip') : t('day.skip')}
                    on={state === 'skipped'}
                    onPress={() => setDayChange(routine.id, date, state === 'skipped' ? null : 'skip')}
                  />
                  {state !== 'skipped' && (
                    <>
                      <Chip label={t('day.earlier')} onPress={() => setDayChange(routine.id, date, (c) => (typeof c === 'number' ? c : 0) - STEP_MIN)} />
                      <Chip label={t('day.later')} onPress={() => setDayChange(routine.id, date, (c) => (typeof c === 'number' ? c : 0) + STEP_MIN)} />
                    </>
                  )}
                  {change !== undefined && (
                    <Chip label={t('day.reset')} onPress={() => setDayChange(routine.id, date, null)} />
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
        <Pressable style={styles.done} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.doneText}>{t('day.done')}</Text>
        </Pressable>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, on && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
    >
      <Text style={[styles.chipText, on && { color: Colors.onBrand }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: Spacing.xl, gap: Spacing.lg },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: Colors.ink200 },
  title: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h2, color: Colors.ink900 },
  wakeyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  only: { flex: 1, fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textMuted },
  none: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.md,
  },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  time: { fontVariant: ['tabular-nums'], fontFamily: FontFamily.displayBold, fontSize: 34, color: Colors.ink900 },
  timeSkipped: { color: Colors.ink400, textDecorationLine: 'line-through' },
  meridiem: { fontSize: FontSize.md, color: Colors.blue500 },
  was: { fontFamily: FontFamily.display, fontSize: FontSize.md, color: Colors.ink400, textDecorationLine: 'line-through' },
  name: { flex: 1, textAlign: 'right', fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.blue50,
  },
  chipOn: { backgroundColor: Colors.primary },
  chipText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.blue700 },
  done: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    height: 56,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.blue,
  },
  doneText: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.md, color: Colors.onBrand },
});
