import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Pressable from '@/components/Pressable';
import ScreenBackground from '@/components/ScreenBackground';
import Toggle from '@/components/Toggle';
import WheelPicker from '@/components/WheelPicker';
import { BUNDLED_SOUNDS, DEFAULT_SOUND_ID, getSoundById } from '@/constants/sounds';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { previewSound, stopPreviewSound } from '@/utils/sounds';
import {
  DEFAULT_MATH_LEVEL,
  DEFAULT_STEPS,
  getAlarm,
  MATH_LEVELS,
  MISSIONS,
  STEP_OPTIONS,
  type Mission,
} from '@/utils/storage';
import type { MathLevel } from '@/utils/math';
import { use24h } from '@/utils/time';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i + 1));
const HOURS_24 = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];
const ITEM_H = 44;
const VISIBLE = 5;

const MISSION_ICON: Record<Mission, keyof typeof Ionicons.glyphMap> = {
  walk: 'walk',
  math: 'calculator',
  both: 'layers',
  none: 'notifications',
};

export default function AlarmEditorScreen() {
  const { id, routineId: newRoutineId } = useLocalSearchParams<{ id: string; routineId?: string }>();
  const isNew = id === 'new';
  const { alarms, routines, addAlarm, updateAlarm, removeAlarm } = useAlarms();
  const { t } = useLocale();

  const h24 = use24h();
  const [hour, setHour] = useState(() => new Date().getHours()); // 0–23
  const [minute, setMinute] = useState(() => new Date().getMinutes());
  const [label, setLabel] = useState('');
  const [soundId, setSoundId] = useState<string>(DEFAULT_SOUND_ID);
  const [steps, setSteps] = useState<number>(DEFAULT_STEPS);
  const [wakeCheck, setWakeCheck] = useState(true);
  const [mission, setMission] = useState<Mission>('walk');
  const [mathLevel, setMathLevel] = useState<MathLevel>(DEFAULT_MATH_LEVEL);
  const [soundOpen, setSoundOpen] = useState(false);
  const [onWheel, setOnWheel] = useState(false);
  const [loaded, setLoaded] = useState(isNew);
  const [routineId, setRoutineId] = useState(newRoutineId);
  const routine = routines.find((r) => r.id === routineId);
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
        setSoundId(alarm.soundId ?? DEFAULT_SOUND_ID);
        setSteps(alarm.steps ?? DEFAULT_STEPS);
        setWakeCheck(alarm.wakeCheck ?? false);
        setMission(alarm.mission ?? 'walk');
        setMathLevel(alarm.mathLevel ?? DEFAULT_MATH_LEVEL);
        setRoutineId(alarm.routineId);
      }
      setLoaded(true);
    })();
  }, [id, isNew]);

  useEffect(() => () => stopPreviewSound(), []);

  const time = `${pad(hour)}:${pad(minute)}`;

  const handleSave = async () => {
    const data = {
      time,
      label: label.trim(),
      enabled: true,
      // Days come from the routine.
      days: routine?.days ?? [],
      routineId,
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

  if (!loaded) return <ScreenBackground><View /></ScreenBackground>;

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.handle} />
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // While a finger is on the time wheel the page holds still, so the drag turns the wheel.
          scrollEnabled={!onWheel}
        >
          {/* The label is the sheet's title. */}
          <View style={styles.titleRow}>
            <TextInput
              style={styles.title}
              value={label}
              onChangeText={setLabel}
              placeholder={t('common.alarmFallback')}
              placeholderTextColor={Colors.textFaint}
              maxLength={40}
              accessibilityLabel={t('alarmEditor.label')}
            />
            {!isNew && !isLastStep && (
              <Pressable onPress={handleDelete} hitSlop={8} style={styles.deleteLink} accessibilityRole="button">
                <Text style={styles.deleteText}>{t('common.delete')}</Text>
              </Pressable>
            )}
          </View>

          <View
            style={styles.wheelWrap}
            onTouchStart={() => setOnWheel(true)}
            onTouchEnd={() => setOnWheel(false)}
            onTouchCancel={() => setOnWheel(false)}
          >
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


          <Text style={styles.sectionLabel}>{t('alarmEditor.mission')}</Text>
          <View style={styles.tiles} accessibilityRole="radiogroup">
            {MISSIONS.map((m) => {
              const on = m === mission;
              return (
                <Pressable
                  key={m}
                  style={[styles.tile, on && styles.tileOn]}
                  onPress={() => setMission(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <Ionicons name={MISSION_ICON[m]} size={24} color={on ? Colors.onBrand : Colors.ink700} />
                  <Text style={[styles.tileText, on && styles.tileTextOn]} numberOfLines={1} adjustsFontSizeToFit>
                    {t(`alarmEditor.mission_${m}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {(mission === 'walk' || mission === 'both') && (
            <Segment
              full
              options={STEP_OPTIONS}
              value={steps}
              onChange={setSteps}
              label={(n) => t('alarmEditor.stepsValue', { count: n })}
            />
          )}
          {(mission === 'math' || mission === 'both') && (
            <Segment
              full
              options={MATH_LEVELS}
              value={mathLevel}
              onChange={setMathLevel}
              label={(l) => t(`alarmEditor.mathLevel_${l}`)}
            />
          )}

          <View style={styles.more}>
            <SettingRow
              label={t('alarmEditor.sound')}
              value={getSoundById(soundId).name}
              open={soundOpen}
              onPress={() => setSoundOpen((o) => !o)}
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
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                    >
                      <Text style={[styles.soundName, active && styles.soundNameOn]}>{s.name}</Text>
                      {active && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            </SettingRow>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={{ flex: 1, paddingRight: Spacing.md }}>
                <Text style={styles.rowLabel}>{t('alarmEditor.wakeCheck')}</Text>
                <Text style={styles.rowHint}>{t('alarmEditor.wakeCheckHint')}</Text>
              </View>
              <Toggle checked={wakeCheck} onChange={setWakeCheck} />
            </View>
          </View>
        </ScrollView>

        <Pressable style={styles.done} onPress={handleSave} accessibilityRole="button">
          <Text style={styles.doneText}>{t('alarmEditor.done')}</Text>
        </Pressable>
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
      <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }}>
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
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: Colors.ink200, marginTop: Spacing.sm },
  body: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, paddingBottom: Spacing.xl, gap: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: {
    flex: 1,
    minHeight: 44,
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.h3,
    color: Colors.ink900,
    borderBottomWidth: 2,
    borderBottomColor: Colors.ink100,
  },
  deleteLink: { minHeight: 44, justifyContent: 'center' },
  deleteText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.danger },

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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.lg,
  },
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
  segmentItemFull: { flex: 1 },
  segmentItemOn: { backgroundColor: Colors.primary },
  segmentText: { fontFamily: FontFamily.display, fontSize: 15, color: Colors.blue700 },
  segmentTextOn: { color: Colors.onBrand },

  soundList: { gap: 2 },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  soundName: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.md, color: Colors.textBody },
  soundNameOn: { fontFamily: FontFamily.bodyBold, color: Colors.primary },

  sectionLabel: { fontFamily: FontFamily.displayBold, fontSize: FontSize.md, color: Colors.ink900, marginTop: Spacing.sm },
  tiles: { flexDirection: 'row', gap: Spacing.sm },
  tile: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.borderHairline,
    backgroundColor: Colors.white,
  },
  tileOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tileText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.ink700 },
  tileTextOn: { color: Colors.onBrand },
  more: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceCard,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.ink100,
    paddingHorizontal: Spacing.lg,
  },
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
