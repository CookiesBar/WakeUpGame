import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ScreenBackground from '@/components/ScreenBackground';
import Toggle from '@/components/Toggle';
import WheelPicker from '@/components/WheelPicker';
import { BUNDLED_SOUNDS, DEFAULT_SOUND_ID, getSoundById } from '@/constants/sounds';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { getNarrowWeekdays } from '@/i18n/weekdays';
import { repeatLabel } from '@/utils/repeatLabel';
import { previewSound, stopPreviewSound } from '@/utils/sounds';
import {
  DEFAULT_MATH_LEVEL,
  DEFAULT_STEPS,
  getAlarm,
  MATH_LEVELS,
  MISSIONS,
  NAP_OFFSETS,
  STEP_OPTIONS,
  type Mission,
  type Weekday,
} from '@/utils/storage';
import type { MathLevel } from '@/utils/math';
import { nextOccurrence, ringsIn, use24h, useNow } from '@/utils/time';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
const HOURS_24 = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];
const ITEM_H = 44;
const VISIBLE = 5;

type Row = 'repeat' | 'label' | 'sound' | null;

export default function AlarmEditorScreen() {
  const { id, routineId: newRoutineId } = useLocalSearchParams<{ id: string; routineId?: string }>();
  const isNew = id === 'new';
  const { alarms, routines, addAlarm, updateAlarm, removeAlarm } = useAlarms();
  const { t, locale } = useLocale();
  const dayLabels = useMemo(() => getNarrowWeekdays(locale), [locale]);

  const h24 = use24h();
  const now = useNow();
  const [hour, setHour] = useState(() => new Date().getHours()); // 0–23
  const [minute, setMinute] = useState(() => new Date().getMinutes());
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<Weekday[]>([]);
  const [soundId, setSoundId] = useState<string>(DEFAULT_SOUND_ID);
  const [steps, setSteps] = useState<number>(DEFAULT_STEPS);
  const [wakeCheck, setWakeCheck] = useState(true);
  const [mission, setMission] = useState<Mission>('walk');
  const [mathLevel, setMathLevel] = useState<MathLevel>(DEFAULT_MATH_LEVEL);
  const [expanded, setExpanded] = useState<Row>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [routineId, setRoutineId] = useState(newRoutineId);
  const [offsetMin, setOffsetMin] = useState(20);
  const routine = routines.find((r) => r.id === routineId);
  const nap = routine?.kind === 'nap';
  const isLastStep = !!routine && alarms.filter((a) => a.routineId === routine.id).length <= 1;

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const alarm = await getAlarm(id);
      if (alarm) {
        const [h, m] = alarm.time.split(':').map(Number);
        setHour(h);
        setMinute(m);
        setLabel(alarm.label);
        setDays(alarm.days);
        setSoundId(alarm.soundId ?? DEFAULT_SOUND_ID);
        setSteps(alarm.steps ?? DEFAULT_STEPS);
        setWakeCheck(alarm.wakeCheck ?? false);
        setMission(alarm.mission ?? 'walk');
        setMathLevel(alarm.mathLevel ?? DEFAULT_MATH_LEVEL);
        setRoutineId(alarm.routineId);
        setOffsetMin(alarm.offsetMin ?? 20);
      }
      setLoaded(true);
    })();
  }, [id, isNew]);

  useEffect(() => () => stopPreviewSound(), []);

  const toggleDay = (d: Weekday) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const time = `${pad(hour)}:${pad(minute)}`;

  const handleSave = async () => {
    const data = {
      time,
      label: label.trim(),
      enabled: true,
      // Days come from the routine; nap steps get a clock time when the nap starts.
      days: routine ? (nap ? [] : routine.days) : ([...days].sort() as Weekday[]),
      routineId,
      offsetMin: nap ? offsetMin : undefined,
      soundId,
      steps,
      wakeCheck,
      mission,
      mathLevel,
    };
    // Ask for Motion now, not at 6 a.m. Denied is fine: the ring screen falls
    // back to the accelerometer. No-op once the user has answered.
    if (mission === 'walk' || mission === 'both') await Pedometer.requestPermissionsAsync().catch(() => undefined);
    if (isNew) {
      await addAlarm(data);
    } else {
      const existing = await getAlarm(id);
      // Keep fields this screen doesn't edit (level progress).
      await updateAlarm({ ...existing, ...data, id, createdAt: existing?.createdAt ?? Date.now() });
    }
    router.back();
  };

  const handleDelete = async () => {
    if (!isNew) await removeAlarm(id);
    router.back();
  };

  const toggleRow = (row: Row) => setExpanded((cur) => (cur === row ? null : row));

  if (!loaded) return <ScreenBackground><View /></ScreenBackground>;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.cancel}>{t('common.cancel')}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {isNew ? t('alarmEditor.addTitle') : t('alarmEditor.editTitle')}
          </Text>
          <Pressable onPress={handleSave} hitSlop={8}>
            <Text style={styles.save}>{t('common.save')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {nap ? (
            <View style={[styles.card, styles.rowStacked, { marginVertical: Spacing.lg }]}>
              <Text style={styles.rowLabel}>{t('alarmEditor.offset')}</Text>
              <View style={styles.offsets}>
                {NAP_OFFSETS.map((m) => (
                  <Pressable
                    key={m}
                    style={[styles.offset, m === offsetMin && styles.segmentItemOn]}
                    onPress={() => setOffsetMin(m)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: m === offsetMin }}
                  >
                    <Text style={[styles.segmentText, m === offsetMin && styles.segmentTextOn]}>
                      {t('alarmEditor.offsetValue', { m })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
          <>
          {/* Time wheel */}
          <View style={styles.wheelWrap}>
            <View style={styles.band} pointerEvents="none" />
            <View style={styles.wheelRow}>
              {h24 ? (
                <WheelPicker items={HOURS_24} selectedIndex={hour} onChange={setHour} itemHeight={ITEM_H} visibleCount={VISIBLE} width={58} loop />
              ) : (
                <WheelPicker
                  items={HOURS_12}
                  selectedIndex={(hour % 12 || 12) - 1}
                  onChange={(i) => setHour((h) => ((i + 1) % 12) + (h >= 12 ? 12 : 0))}
                  itemHeight={ITEM_H} visibleCount={VISIBLE} width={58} loop
                />
              )}
              <Text style={styles.colon}>:</Text>
              <WheelPicker items={MINUTES} selectedIndex={minute} onChange={setMinute} itemHeight={ITEM_H} visibleCount={VISIBLE} width={58} loop />
              {!h24 && (
                <WheelPicker
                  items={PERIODS}
                  selectedIndex={hour >= 12 ? 1 : 0}
                  onChange={(i) => setHour((h) => (h % 12) + (i ? 12 : 0))}
                  itemHeight={ITEM_H} visibleCount={VISIBLE} width={64}
                />
              )}
            </View>
            <LinearGradient colors={[Colors.paper, 'rgba(244,248,255,0)']} style={[styles.fade, styles.fadeTop]} pointerEvents="none" />
            <LinearGradient colors={['rgba(244,248,255,0)', Colors.paper]} style={[styles.fade, styles.fadeBottom]} pointerEvents="none" />
          </View>

          <Text style={styles.ringsIn} accessibilityLiveRegion="polite">
            {ringsIn(t, nextOccurrence({ time, days: routine ? routine.days : days }), now)}
          </Text>
          </>
          )}

          {/* Settings card */}
          <View style={styles.card}>
            <View style={styles.rowStacked}>
              <Text style={styles.rowLabel}>{t('alarmEditor.mission')}</Text>
              <Segment
                full
                options={MISSIONS}
                value={mission}
                onChange={setMission}
                label={(m) => t(`alarmEditor.mission_${m}`)}
              />
            </View>

            {(mission === 'walk' || mission === 'both') && (
              <>
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>{t('alarmEditor.steps')}</Text>
                  <Segment
                    options={STEP_OPTIONS}
                    value={steps}
                    onChange={setSteps}
                    label={String}
                    a11yLabel={(n) => t('alarmEditor.stepsValue', { count: n })}
                  />
                </View>
              </>
            )}

            {(mission === 'math' || mission === 'both') && (
              <>
                <View style={styles.divider} />
                <View style={styles.rowStacked}>
                  <Text style={styles.rowLabel}>{t('alarmEditor.mathLevel')}</Text>
                  <Segment
                    full
                    options={MATH_LEVELS}
                    value={mathLevel}
                    onChange={setMathLevel}
                    label={(l) => t(`alarmEditor.mathLevel_${l}`)}
                  />
                </View>
              </>
            )}

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={{ flex: 1, paddingRight: Spacing.md }}>
                <Text style={styles.rowLabel}>{t('alarmEditor.wakeCheck')}</Text>
                <Text style={styles.rowHint}>{t('alarmEditor.wakeCheckHint')}</Text>
              </View>
              <Toggle checked={wakeCheck} onChange={setWakeCheck} />
            </View>

            {!routine && <View style={styles.divider} />}

            {!routine && <SettingRow
              label={t('alarmEditor.repeat')}
              value={repeatLabel(days, t, dayLabels)}
              open={expanded === 'repeat'}
              onPress={() => toggleRow('repeat')}
            >
              <View style={styles.daysRow}>
                {dayLabels.map((d, i) => {
                  const active = days.includes(i as Weekday);
                  return (
                    <Pressable
                      key={i}
                      style={[styles.dayChip, active && styles.dayChipOn]}
                      onPress={() => toggleDay(i as Weekday)}
                    >
                      <Text style={[styles.dayText, active && styles.dayTextOn]}>{d}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </SettingRow>}

            <View style={styles.divider} />

            <SettingRow
              label={t('alarmEditor.label')}
              value={label.trim() || t('common.alarmFallback')}
              open={expanded === 'label'}
              onPress={() => toggleRow('label')}
            >
              <TextInput
                style={styles.input}
                value={label}
                onChangeText={setLabel}
                placeholder={t('alarmEditor.labelPlaceholder')}
                placeholderTextColor={Colors.textFaint}
                maxLength={40}
                autoFocus
              />
            </SettingRow>

            <View style={styles.divider} />

            <SettingRow
              label={t('alarmEditor.sound')}
              value={getSoundById(soundId).name}
              open={expanded === 'sound'}
              onPress={() => toggleRow('sound')}
              last
            >
              <View style={styles.soundList}>
                {BUNDLED_SOUNDS.map((s) => {
                  const active = s.id === soundId;
                  return (
                    <Pressable
                      key={s.id}
                      style={styles.soundRow}
                      onPress={() => {
                        setSoundId(s.id);
                        previewSound(s.id);
                      }}
                    >
                      <Text style={[styles.soundName, active && styles.soundNameOn]}>{s.name}</Text>
                      {active && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            </SettingRow>
          </View>

          {!isNew && !isLastStep && (
            <Pressable style={styles.deleteButton} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              <Text style={styles.deleteText}>{t('alarmEditor.deleteAlarm')}</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function Segment<T extends string | number>({
  options,
  value,
  onChange,
  label,
  a11yLabel = label,
  full,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
  a11yLabel?: (v: T) => string;
  /** Stretch to the row's width with equal-width items. */
  full?: boolean;
}) {
  return (
    <View style={[styles.segment, full && styles.segmentFull]}>
      {options.map((o) => (
        <Pressable
          key={o}
          style={[styles.segmentItem, full && styles.segmentItemFull, o === value && styles.segmentItemOn]}
          onPress={() => onChange(o)}
          accessibilityRole="button"
          accessibilityState={{ selected: o === value }}
          accessibilityLabel={a11yLabel(o)}
        >
          <Text style={[styles.segmentText, o === value && styles.segmentTextOn]}>{label(o)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SettingRow({
  label,
  value,
  open,
  onPress,
  last,
  children,
}: {
  label: string;
  value: string;
  open: boolean;
  onPress: () => void;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Pressable style={styles.row} onPress={onPress}>
        <Text style={styles.rowLabel}>{label}</Text>
        <View style={styles.rowRight}>
          <Text style={styles.rowValue}>{value}</Text>
          <Ionicons
            name={open ? 'chevron-down' : 'chevron-forward'}
            size={18}
            color={Colors.textFaint}
          />
        </View>
      </Pressable>
      {open && <View style={[styles.rowBody, last && { paddingBottom: 0 }]}>{children}</View>}
    </View>
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
  body: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['4xl'] },

  wheelWrap: { height: ITEM_H * VISIBLE, justifyContent: 'center', marginVertical: Spacing.md },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (ITEM_H * (VISIBLE - 1)) / 2,
    height: ITEM_H,
    backgroundColor: Colors.blue50,
    borderWidth: 1,
    borderColor: Colors.blue100,
    borderRadius: BorderRadius.md,
  },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  colon: {
    fontFamily: FontFamily.displayBold,
    fontSize: 30,
    color: Colors.ink900,
    marginBottom: 2,
  },
  fade: { position: 'absolute', left: 0, right: 0, height: ITEM_H * 1.6 },
  fadeTop: { top: 0 },
  fadeBottom: { bottom: 0 },
  ringsIn: {
    textAlign: 'center',
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.sm,
    color: Colors.blue600,
    marginBottom: Spacing.lg,
  },

  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.ink100,
    paddingHorizontal: Spacing.xl,
    ...Shadow.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
  },
  rowStacked: { paddingVertical: Spacing.lg, gap: Spacing.md },
  rowLabel: { fontFamily: FontFamily.displayBold, fontSize: FontSize.md, color: Colors.ink900 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowHint: { fontFamily: FontFamily.body, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  rowValue: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textMuted },
  rowBody: { paddingBottom: Spacing.lg },
  divider: { height: 1, backgroundColor: Colors.ink100 },

  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.blue50,
    borderRadius: BorderRadius.pill,
    padding: 3,
  },
  segmentItem: {
    minWidth: 48,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
  },
  segmentFull: { alignSelf: 'stretch' },
  offsets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  offset: {
    minWidth: 76,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.blue50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemFull: { flex: 1 },
  segmentItemOn: { backgroundColor: Colors.primary },
  segmentText: { fontFamily: FontFamily.display, fontSize: 15, color: Colors.blue700 },
  segmentTextOn: { color: Colors.onBrand },

  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.pill,
    borderWidth: 2,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { fontFamily: FontFamily.display, fontSize: 15, color: Colors.textFaint },
  dayTextOn: { color: Colors.onBrand },

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
  soundList: { gap: 2 },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  soundName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textBody },
  soundNameOn: { fontFamily: FontFamily.bodyBold, color: Colors.primary },

  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
    borderWidth: 2,
    borderColor: Colors.danger,
    backgroundColor: Colors.white,
  },
  deleteText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.danger },
});
