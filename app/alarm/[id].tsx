import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
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
import WheelPicker from '@/components/WheelPicker';
import { BUNDLED_SOUNDS, DEFAULT_SOUND_ID, getSoundById } from '@/constants/sounds';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { getNarrowWeekdays } from '@/i18n/weekdays';
import { repeatLabel } from '@/utils/repeatLabel';
import { previewSound, stopPreviewSound } from '@/utils/sounds';
import { getAlarm, type Weekday } from '@/utils/storage';

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];
const ITEM_H = 44;
const VISIBLE = 5;

type Row = 'repeat' | 'label' | 'sound' | null;

function to24h(hour12: number, minute: number, period: string): string {
  let h = hour12 % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
function from24h(time: string) {
  const [h, m] = time.split(':').map(Number);
  return { hourIdx: (h % 12 === 0 ? 12 : h % 12) - 1, minIdx: m, periodIdx: h >= 12 ? 1 : 0 };
}

export default function AlarmEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { addAlarm, updateAlarm, removeAlarm } = useAlarms();
  const { t, locale } = useLocale();
  const dayLabels = useMemo(() => getNarrowWeekdays(locale), [locale]);

  const now = useMemo(() => new Date(), []);
  const [hourIdx, setHourIdx] = useState((now.getHours() % 12 || 12) - 1);
  const [minIdx, setMinIdx] = useState(now.getMinutes());
  const [periodIdx, setPeriodIdx] = useState(now.getHours() >= 12 ? 1 : 0);
  const [label, setLabel] = useState('');
  const [days, setDays] = useState<Weekday[]>([]);
  const [soundId, setSoundId] = useState<string>(DEFAULT_SOUND_ID);
  const [expanded, setExpanded] = useState<Row>(null);
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const alarm = await getAlarm(id);
      if (alarm) {
        const { hourIdx, minIdx, periodIdx } = from24h(alarm.time);
        setHourIdx(hourIdx);
        setMinIdx(minIdx);
        setPeriodIdx(periodIdx);
        setLabel(alarm.label);
        setDays(alarm.days);
        setSoundId(alarm.soundId ?? DEFAULT_SOUND_ID);
      }
      setLoaded(true);
    })();
  }, [id, isNew]);

  useEffect(() => () => stopPreviewSound(), []);

  const toggleDay = (d: Weekday) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const handleSave = async () => {
    const data = {
      time: to24h(hourIdx + 1, minIdx, PERIODS[periodIdx]),
      label: label.trim(),
      enabled: true,
      days: [...days].sort() as Weekday[],
      soundId,
    };
    if (isNew) {
      await addAlarm(data);
    } else {
      const existing = await getAlarm(id);
      await updateAlarm({ ...data, id, createdAt: existing?.createdAt ?? Date.now() });
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
          {/* Time wheel */}
          <View style={styles.wheelWrap}>
            <View style={styles.band} pointerEvents="none" />
            <View style={styles.wheelRow}>
              <WheelPicker items={HOURS} selectedIndex={hourIdx} onChange={setHourIdx} itemHeight={ITEM_H} visibleCount={VISIBLE} width={58} loop />
              <Text style={styles.colon}>:</Text>
              <WheelPicker items={MINUTES} selectedIndex={minIdx} onChange={setMinIdx} itemHeight={ITEM_H} visibleCount={VISIBLE} width={58} loop />
              <WheelPicker items={PERIODS} selectedIndex={periodIdx} onChange={setPeriodIdx} itemHeight={ITEM_H} visibleCount={VISIBLE} width={64} />
            </View>
            <LinearGradient colors={[Colors.paper, 'rgba(244,248,255,0)']} style={[styles.fade, styles.fadeTop]} pointerEvents="none" />
            <LinearGradient colors={['rgba(244,248,255,0)', Colors.paper]} style={[styles.fade, styles.fadeBottom]} pointerEvents="none" />
          </View>

          {/* Settings card */}
          <View style={styles.card}>
            <SettingRow
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
            </SettingRow>

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

          {!isNew && (
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
  rowLabel: { fontFamily: FontFamily.displayBold, fontSize: FontSize.md, color: Colors.ink900 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textMuted },
  rowBody: { paddingBottom: Spacing.lg },
  divider: { height: 1, backgroundColor: Colors.ink100 },

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
