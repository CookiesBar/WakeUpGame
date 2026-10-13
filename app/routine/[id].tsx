import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenBackground from '@/components/ScreenBackground';
import Toggle from '@/components/Toggle';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { getNarrowWeekdays } from '@/i18n/weekdays';
import { missionLabel } from '@/utils/repeatLabel';
import { stepsOf } from '@/utils/routines';
import type { Weekday } from '@/utils/storage';
import { formatTime, use24h } from '@/utils/time';

/** Name, days and level-up for a routine; its alarms open in the alarm editor. */
export default function RoutineEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alarms, routines, updateRoutine, removeRoutine } = useAlarms();
  const { t, locale } = useLocale();
  const h24 = use24h();
  const dayLabels = useMemo(() => getNarrowWeekdays(locale), [locale]);
  const routine = routines.find((r) => r.id === id);

  const [name, setName] = useState('');
  const [days, setDays] = useState<Weekday[]>([]);
  const [levelUp, setLevelUp] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!routine || loaded) return;
    setName(routine.name);
    setDays(routine.days);
    setLevelUp(routine.levelUp);
    setLoaded(true);
  }, [routine, loaded]);

  if (!routine) return <ScreenBackground><View /></ScreenBackground>;
  const nap = routine.kind === 'nap';
  const steps = stepsOf(routine, alarms);

  const toggleDay = (d: Weekday) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const save = async () => {
    await updateRoutine({ ...routine, name: name.trim(), days, levelUp });
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
          <Text style={styles.headerTitle}>{t(`routines.kind_${routine.kind}`)}</Text>
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
            <Text style={styles.label}>{nap ? t('routineEditor.napDays') : t('routineEditor.days')}</Text>
            <View style={styles.daysRow}>
              {dayLabels.map((d, i) => {
                const active = days.includes(i as Weekday);
                return (
                  <Pressable
                    key={i}
                    style={[styles.dayChip, active && styles.dayChipOn]}
                    onPress={() => toggleDay(i as Weekday)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.dayText, active && styles.dayTextOn]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>{nap ? t('routineEditor.steps') : t('routineEditor.alarms')}</Text>
            {steps.map((a) => {
              const time = formatTime(a.time, h24);
              return (
                <Pressable key={a.id} style={styles.step} onPress={() => router.push(`/alarm/${a.id}`)}>
                  <Text style={styles.stepTime}>
                    {nap ? t('alarmEditor.offsetValue', { m: a.offsetMin ?? 0 }) : `${time.display} ${time.meridiem}`.trim()}
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
              <Text style={styles.addText}>{nap ? t('routineEditor.addStep') : t('routineEditor.addAlarm')}</Text>
            </Pressable>
          </View>

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
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayChip: {
    width: 40,
    height: 44,
    borderRadius: BorderRadius.pill,
    borderWidth: 2,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { fontFamily: FontFamily.display, fontSize: 15, color: Colors.textMuted },
  dayTextOn: { color: Colors.onBrand },
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
