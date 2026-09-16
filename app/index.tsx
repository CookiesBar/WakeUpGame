import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Mascot from '@/components/Mascot';
import ScreenBackground from '@/components/ScreenBackground';
import Toggle from '@/components/Toggle';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { getNarrowWeekdays } from '@/i18n/weekdays';
import { repeatLabel } from '@/utils/repeatLabel';
import type { Alarm } from '@/utils/storage';

function splitTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { display: `${hour12}:${String(m).padStart(2, '0')}`, meridiem };
}

function Badge({ children }: { children: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{children}</Text>
    </View>
  );
}

function AlarmRow({ alarm, onToggle, onEdit, onDelete }: {
  alarm: Alarm;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t, locale } = useLocale();
  const { display, meridiem } = splitTime(alarm.time);
  const dayLabels = getNarrowWeekdays(locale);
  return (
    <Pressable
      style={[styles.row, !alarm.enabled && styles.rowOff]}
      onPress={onEdit}
      onLongPress={onDelete}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.timeLine}>
          <Text style={styles.time}>{display}</Text>
          <Text style={styles.meridiem}>{meridiem}</Text>
        </View>
        <View style={styles.metaLine}>
          <Text style={styles.rowLabel}>{alarm.label || t('common.alarmFallback')}</Text>
          <Badge>{repeatLabel(alarm.days, t, dayLabels)}</Badge>
        </View>
      </View>
      <Toggle checked={alarm.enabled} onChange={onToggle} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const { alarms, toggleAlarmEnabled, removeAlarm } = useAlarms();
  const { t } = useLocale();

  const confirmDelete = (alarm: Alarm) => {
    Alert.alert(
      t('home.deleteAlarmTitle'),
      t('home.deleteAlarmMessage', { label: alarm.label || t('common.alarmFallback') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => removeAlarm(alarm.id) },
      ]
    );
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.addButton} onPress={() => router.push('/alarm/new')} hitSlop={8}>
            <Ionicons name="add" size={28} color={Colors.onBrand} />
          </Pressable>
        </View>

        <View style={styles.scroll}>
          {alarms.length === 0 ? (
            <View style={styles.empty}>
              <Mascot mood="snooze" size={140} />
              <Text style={styles.emptyTitle}>{t('home.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('home.emptyBody')}</Text>
              <Pressable style={styles.emptyCta} onPress={() => router.push('/alarm/new')}>
                <Text style={styles.emptyCtaText}>{t('home.emptyCta')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.list}>
              {alarms.map((alarm) => (
                <AlarmRow
                  key={alarm.id}
                  alarm={alarm}
                  onToggle={() => toggleAlarmEnabled(alarm.id)}
                  onEdit={() => router.push(`/alarm/${alarm.id}`)}
                  onDelete={() => confirmDelete(alarm)}
                />
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.blue,
  },
  scroll: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: Spacing.xl },
  list: { gap: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: Spacing.lg,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.xl,
    ...Shadow.md,
  },
  rowOff: { opacity: 0.62 },
  timeLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  time: {
    fontFamily: FontFamily.displayBold,
    fontSize: 42,
    color: Colors.ink900,
    lineHeight: 44,
  },
  meridiem: { fontFamily: FontFamily.displayBold, fontSize: 16, color: Colors.blue500 },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  rowLabel: { fontFamily: FontFamily.bodyBlack, fontSize: 13, color: Colors.ink500 },
  badge: {
    backgroundColor: Colors.blue100,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: FontFamily.bodyBlack,
    fontSize: FontSize.xs,
    color: Colors.blue700,
    letterSpacing: 0.2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.h2,
    color: Colors.ink900,
  },
  emptyBody: {
    textAlign: 'center',
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.xl,
  },
  emptyCta: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.pill,
    ...Shadow.blue,
  },
  emptyCtaText: {
    color: Colors.onBrand,
    fontFamily: FontFamily.bodyBold,
    fontSize: FontSize.md,
  },
});
