import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenBackground from '@/components/ScreenBackground';
import Toggle from '@/components/Toggle';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { missionLabel } from '@/utils/repeatLabel';
import { stepsOf } from '@/utils/routines';
import { dayKey, nextFire } from '@/utils/schedule';
import { formatTime, use24h } from '@/utils/time';

const MAX_WEEKS = 12;

/** Name, alarms, every-N-weeks and level-up for a routine; its alarms open in the alarm editor. */
export default function RoutineEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alarms, routines, updateRoutine, removeRoutine } = useAlarms();
  const { t, locale } = useLocale();
  const h24 = use24h();
  const routine = routines.find((r) => r.id === id);

  const [name, setName] = useState('');
  const [levelUp, setLevelUp] = useState(true);
  const [everyWeeks, setEveryWeeks] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const todayKey = dayKey(new Date());

  useEffect(() => {
    if (!routine || loaded) return;
    setName(routine.name);
    setLevelUp(routine.levelUp);
    setEveryWeeks(routine.everyWeeks ?? 1);
    setLoaded(true);
  }, [routine, loaded]);

  if (!routine) return <ScreenBackground><View /></ScreenBackground>;
  const { days } = routine;
  const steps = stepsOf(routine, alarms);
  const sparse = days.length > 0 && everyWeeks > 1;
  const anchor = routine.anchor ?? todayKey;
  const nextRing = sparse && steps[0] ? nextFire({ time: steps[0].time, days, everyWeeks, anchor }, new Date()) : null;

  const save = async () => {
    await updateRoutine({
      ...routine,
      name: name.trim(),
      levelUp,
      everyWeeks: sparse ? everyWeeks : undefined,
      anchor: sparse ? anchor : undefined,
    });
    router.back();
  };

  const remove = async () => {
    await removeRoutine(routine.id);
    router.back();
  };
  const confirmDelete = () => {
    const message = t('routineEditor.deleteMessage', { name: name.trim() || t('routines.fallback') });
    // Alert.alert with buttons does nothing on react-native-web.
    if (Platform.OS === 'web') {
      if (window.confirm(message)) remove();
      return;
    }
    Alert.alert(t('routineEditor.delete'), message, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: remove },
    ]);
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{t('routines.fallback')}</Text>
          <Pressable onPress={save} hitSlop={8}>
            <Text style={styles.save}>{t('common.save')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>{t('routineEditor.name')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('routines.fallback')}
              placeholderTextColor={Colors.textFaint}
              maxLength={40}
              accessibilityLabel={t('routineEditor.name')}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{t('routineEditor.alarms')}</Text>
            {steps.map((a) => {
              const time = formatTime(a.time, h24);
              return (
                <Pressable key={a.id} style={styles.step} onPress={() => router.push(`/alarm/${a.id}`)}>
                  <Text style={styles.stepTime}>
                    {`${time.display} ${time.meridiem}`.trim()}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepLabel} numberOfLines={1}>{a.label || t('common.alarmFallback')}</Text>
                    <Text style={styles.stepMission} numberOfLines={1}>{missionLabel(a, t)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textFaint} />
                </Pressable>
              );
            })}
            <Pressable
              style={styles.add}
              onPress={() => router.push({ pathname: '/alarm/[id]', params: { id: 'new', routineId: routine.id } })}
              accessibilityRole="button"
            >
              <Ionicons name="add" size={20} color={Colors.primary} />
              <Text style={styles.addText}>{t('routineEditor.addAlarm')}</Text>
            </Pressable>
          </View>

          {days.length > 0 && (
            <View style={styles.card}>
              {/* Fixed routines belong to one weekday (see splitByDay). 1 Jan 2023 was a Sunday. */}
              <Text style={[styles.label, styles.capital]}>
                {new Date(2023, 0, 1 + days[0]).toLocaleDateString(locale, { weekday: 'long' })}
              </Text>
              <View style={styles.stepper}>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setEveryWeeks((n) => Math.max(1, n - 1))}
                  disabled={everyWeeks <= 1}
                  accessibilityRole="button"
                  accessibilityLabel={t('routineEditor.moreOften')}
                >
                  <Ionicons name="remove" size={22} color={everyWeeks <= 1 ? Colors.ink200 : Colors.primary} />
                </Pressable>
                <Text style={styles.stepperValue} accessibilityLiveRegion="polite">
                  {everyWeeks === 1 ? t('routineEditor.everyWeek') : t('routineEditor.everyNWeeks', { count: everyWeeks })}
                </Text>
                <Pressable
                  style={styles.stepperButton}
                  onPress={() => setEveryWeeks((n) => Math.min(MAX_WEEKS, n + 1))}
                  disabled={everyWeeks >= MAX_WEEKS}
                  accessibilityRole="button"
                  accessibilityLabel={t('routineEditor.lessOften')}
                >
                  <Ionicons name="add" size={22} color={everyWeeks >= MAX_WEEKS ? Colors.ink200 : Colors.primary} />
                </Pressable>
              </View>
              {sparse && nextRing && (
                <Text style={styles.rowHint}>
                  {t('routineEditor.nextRing', {
                    date: nextRing.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }),
                  })}
                </Text>
              )}
            </View>
          )}

          <View style={[styles.card, styles.row]}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <Text style={styles.rowLabel}>{t('routineEditor.levelUp')}</Text>
              <Text style={styles.rowHint}>{t('routineEditor.levelUpHint')}</Text>
            </View>
            <Toggle checked={levelUp} onChange={setLevelUp} />
          </View>

          <Pressable style={styles.deleteButton} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            <Text style={styles.deleteText}>{t('routineEditor.delete')}</Text>
          </Pressable>
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
  cancel: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textMuted },
  save: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.primary },
  body: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['4xl'], gap: Spacing.lg },
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.ink100,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadow.md,
  },
  label: { fontFamily: FontFamily.displayBold, fontSize: FontSize.md, color: Colors.ink900 },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.borderHairline,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
    color: Colors.ink900,
  },
  capital: { textTransform: 'capitalize' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.borderHairline,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.white,
  },
  stepperButton: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { flex: 1, textAlign: 'center', fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.ink900 },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 52 },
  stepTime: { width: 84, fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.ink900 },
  stepLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.ink700 },
  stepMission: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textMuted },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.blue200,
  },
  addText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.primary },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { fontFamily: FontFamily.displayBold, fontSize: FontSize.md, color: Colors.ink900 },
  rowHint: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
    borderWidth: 2,
    borderColor: Colors.danger,
    backgroundColor: Colors.white,
  },
  deleteText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.danger },
});
