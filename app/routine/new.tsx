import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Mascot from '@/components/Mascot';
import ScreenBackground from '@/components/ScreenBackground';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import type { RoutineKind, Weekday } from '@/utils/storage';

type IconName = keyof typeof Ionicons.glyphMap;

const KINDS: { key: 'fixed' | 'nap' | 'once'; kind: RoutineKind; days: Weekday[]; icon: IconName }[] = [
  { key: 'fixed', kind: 'fixed', days: [1, 2, 3, 4, 5], icon: 'sunny' },
  { key: 'nap', kind: 'nap', days: [], icon: 'moon' },
  { key: 'once', kind: 'fixed', days: [], icon: 'calendar' },
];

const DEFAULT_NAME = { fixed: 'newRoutine.defaultFixed', nap: 'newRoutine.defaultNap', once: 'newRoutine.defaultOnce' };

/** Pick what kind of routine, create it with a starter alarm, then open its editor. */
export default function NewRoutineScreen() {
  const { addRoutine } = useAlarms();
  const { t } = useLocale();

  // Opened from an empty day on the home screen: start the routine on that weekday.
  const { weekday } = useLocalSearchParams<{ weekday?: string }>();

  const create = async ({ key, kind, days }: (typeof KINDS)[number]) => {
    const start = weekday !== undefined && key !== 'once' ? [Number(weekday) as Weekday] : days;
    const routine = await addRoutine(kind, t(DEFAULT_NAME[key]), start);
    router.replace({ pathname: '/routine/[id]', params: { id: routine.id } });
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t('newRoutine.title')}</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.hero}>
            <Mascot mood="shake" size={130} />
            <Text style={styles.ask}>{t('newRoutine.ask')}</Text>
          </View>
          {KINDS.map((k) => (
            <Pressable key={k.key} style={styles.option} onPress={() => create(k)} accessibilityRole="button">
              <View style={styles.icon}>
                <Ionicons name={k.icon} size={26} color={Colors.onBrand} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.optionTitle}>{t(`newRoutine.${k.key}Title`)}</Text>
                <Text style={styles.optionBody}>{t(`newRoutine.${k.key}Body`)}</Text>
                <Text style={styles.optionEg}>{t(`newRoutine.${k.key}Eg`)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.ink400} />
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.ink900 },
  cancel: { width: 60, fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textMuted },
  body: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['3xl'], gap: Spacing.md },
  hero: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  ask: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h3, color: Colors.ink900 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceCard,
    ...Shadow.md,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.ink900 },
  optionBody: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.textMuted },
  optionEg: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.blue600 },
});
