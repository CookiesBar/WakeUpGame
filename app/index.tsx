import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Pressable from '@/components/Pressable';
import AlarmClock from '@/components/AlarmClock';
import ScreenBackground from '@/components/ScreenBackground';
import Toggle from '@/components/Toggle';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { missionLabel } from '@/utils/repeatLabel';
import { stepsOf } from '@/utils/routines';
import { dayKey, dayState, type DayState, hhmm, mondayOf, nextFire, startOfDay } from '@/utils/schedule';
import type { Alarm, Routine, Weekday } from '@/utils/storage';
import { formatTime, use24h, useNow } from '@/utils/time';

interface DayAlarm {
  alarm: Alarm;
  routine: Routine;
  state: DayState;
  /** When it rings that day (moved time included); the planned time when skipped. */
  at: Date;
  base: Date;
}

export default function HomeScreen() {
  const { alarms, routines, addRoutine, toggleRoutine, effective } = useAlarms();
  const { t, locale } = useLocale();
  const h24 = use24h();
  const now = new Date(useNow());
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState(() => dayKey(new Date()));

  const today = dayKey(now);
  const week = useMemo(() => {
    const monday = mondayOf(new Date(`${selected}T00:00`));
    return Array.from({ length: 7 }, (_, i) => startOfDay(monday, i));
  }, [selected]);
  const day = new Date(`${selected}T00:00`);

  const clock = (d: Date, short = false) => {
    const { display, meridiem } = formatTime(hhmm(d), h24);
    return meridiem && !short ? `${display} ${meridiem}` : display;
  };
  const nameOf = (r: Routine) => r.name.trim() || t('routines.fallback');

  /** Every fixed-time alarm that belongs to `d`, with its skip/move applied. */
  const alarmsOn = (d: Date): DayAlarm[] =>
    routines
      .filter((r) => r.enabled)
      .flatMap((routine) =>
        stepsOf(routine, alarms)
          .filter((a) => a.enabled)
          .flatMap((alarm) => {
            if (routine.days.length === 0) {
              // Rings once: show it on the day it will ring.
              const at = nextFire(effective(alarm), now);
              return at && dayKey(at) === dayKey(d) ? [{ alarm, routine, state: 'normal' as DayState, at, base: at }] : [];
            }
            const s = dayState(effective(alarm), d);
            return s ? [{ alarm, routine, state: s.state, at: s.fire ?? s.base, base: s.base }] : [];
          })
      )
      .sort((a, b) => a.at.getTime() - b.at.getTime());

  const todays = alarmsOn(day);
  const ringing = todays.filter((d) => d.state !== 'skipped');
  const passed = (d: DayAlarm) => d.state !== 'skipped' && d.at.getTime() <= now.getTime();
  const byRoutine = [...new Set(todays.map((d) => d.routine))];
  /** The alarm that rings next, if it's on the day shown. */
  const nextId = selected === today ? ringing.find((d) => d.at.getTime() > now.getTime())?.alarm.id : undefined;
  const dayName = day.toLocaleDateString(locale, { weekday: 'long' });
  const size = Math.min(width - Spacing.xl * 4, 300);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.push('/settings')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('settings.title')}>
            <Ionicons name="settings-outline" size={22} color={Colors.ink700} />
          </Pressable>
          <Text style={styles.date} accessibilityRole="header">
            {now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.clockWrap}>
            <AlarmClock
              size={size}
              now={now}
              alarms={ringing.map((d) => ({ minutes: d.at.getHours() * 60 + d.at.getMinutes(), passed: passed(d) }))}
              label={
                ringing.length
                  ? t('home.clockLabel', { day: dayName, times: ringing.map((d) => clock(d.at)).join(', ') })
                  : t('home.noAlarms', { day: dayName })
              }
            />
          </View>

          <View style={styles.week}>
            {week.map((d) => {
              const key = dayKey(d);
              const on = key === selected;
              const isToday = key === today;
              const all = alarmsOn(d);
              const first = all.find((x) => x.state !== 'skipped');
              const empty = all.length === 0;
              const name = isToday ? t('home.today') : d.toLocaleDateString(locale, { weekday: 'short' });
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.dayCell,
                    empty && styles.dayEmpty,
                    !on && !isToday && styles.dayDim,
                    isToday && styles.dayToday,
                    on && styles.dayOn,
                  ]}
                  // An empty day just gets selected; its "Add a routine" card does the rest.
                  onPress={() => setSelected(key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={[
                    d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric' }),
                    first ? clock(first.at) : empty ? t('home.addRoutine') : '',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                >
                  <Text style={[styles.dayName, on && styles.dayTextOn]} numberOfLines={1} adjustsFontSizeToFit>
                    {name}
                  </Text>
                  <Text style={[styles.dayNum, on && styles.dayTextOn]}>{d.getDate()}</Text>
                  {empty ? (
                    <Ionicons name="add" size={16} color={on ? Colors.onBrand : Colors.ink400} />
                  ) : (
                    <Text style={[styles.dayFirst, on && styles.dayTextOn]} numberOfLines={1} adjustsFontSizeToFit>
                      {first ? clock(first.at, true) : '–'}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.dayHead}>
            <Text style={styles.dayTitle}>{selected === today ? t('home.today') : dayName}</Text>
            {byRoutine.length > 0 && (
              <Pressable
                onPress={() => router.push({ pathname: '/day', params: { date: selected } })}
                hitSlop={8}
                accessibilityRole="button"
              >
                <Text style={styles.link}>{t('home.changeDay')}</Text>
              </Pressable>
            )}
          </View>

          {byRoutine.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('home.noAlarms', { day: dayName })}</Text>
              <Pressable
                style={styles.addRoutine}
                onPress={async () => {
                  const routine = await addRoutine(t('routines.defaultName', { day: dayName }), [
                    day.getDay() as Weekday,
                  ]);
                  router.push({ pathname: '/routine/[id]', params: { id: routine.id } });
                }}
                accessibilityRole="button"
              >
                <Ionicons name="add" size={20} color={Colors.onBrand} />
                <Text style={styles.addRoutineText}>{t('home.addRoutine')}</Text>
              </Pressable>
            </View>
          )}

          {byRoutine.map((routine) => {
            const rows = todays.filter((d) => d.routine === routine);
            return (
              <View key={routine.id} style={styles.card}>
                <Pressable
                  style={styles.cardHead}
                  onPress={() => router.push({ pathname: '/routine/[id]', params: { id: routine.id } })}
                  accessibilityRole="button"
                >
                  <Text style={styles.cardName} numberOfLines={1}>{nameOf(routine)}</Text>
                  <Toggle checked={routine.enabled} onChange={() => toggleRoutine(routine.id)} />
                </Pressable>
                {rows.map((d) => {
                  const done = passed(d);
                  const skipped = d.state === 'skipped';
                  const next = d.alarm.id === nextId;
                  const sub = [
                    missionLabel(d.alarm, t),
                    d.state === 'moved' && t('home.movedFrom', { time: clock(d.base, true) }),
                    skipped && t('home.skipped'),
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <Pressable
                      key={d.alarm.id}
                      style={styles.row}
                      onPress={() => router.push(`/alarm/${d.alarm.id}`)}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[styles.rowTime, next && styles.rowTimeNext, (done || skipped) && styles.faded, skipped && styles.struck]}
                        numberOfLines={1}
                      >
                        {clock(d.at)}
                      </Text>
                      <View style={styles.rowText}>
                        <Text style={[styles.rowLabel, (done || skipped) && styles.faded]} numberOfLines={1}>
                          {d.alarm.label || t('common.alarmFallback')}
                        </Text>
                        <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
                      </View>
                      {next && (
                        <View style={styles.nextTag}>
                          <Text style={styles.nextText}>{t('home.next')}</Text>
                        </View>
                      )}
                      {done && <Text style={styles.rang}>{t('home.rang')}</Text>}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  date: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.ink900 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.ink200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: { width: 44 },
  scroll: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing['3xl'], gap: Spacing.lg },

  clockWrap: { alignItems: 'center' },

  week: { flexDirection: 'row', gap: 4 },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 2,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.ink100,
  },
  dayDim: { opacity: 0.5 },
  dayEmpty: { borderStyle: 'dashed', borderColor: Colors.ink200 },
  dayToday: { borderColor: Colors.primary },
  dayOn: { backgroundColor: Colors.primary, borderColor: Colors.primary, borderStyle: 'solid' },
  dayName: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.textMuted },
  dayNum: { fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.ink900 },
  dayFirst: { fontVariant: ['tabular-nums'], fontFamily: FontFamily.bodyBold, fontSize: 11, color: Colors.ink700, height: 16 },
  dayTextOn: { color: Colors.onBrand },

  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  dayTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h3, color: Colors.ink900, textTransform: 'capitalize' },
  link: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.blue600 },

  empty: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.ink200,
  },
  addRoutine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.primary,
    ...Shadow.blue,
  },
  addRoutineText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.onBrand },
  emptyText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.textMuted },

  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    ...Shadow.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  cardName: { flex: 1, fontFamily: FontFamily.displayBold, fontSize: FontSize.lg, color: Colors.ink900 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 60,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.ink100,
  },
  rowTime: {
    width: 84,
    fontVariant: ['tabular-nums'],
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.lg,
    color: Colors.ink900,
  },
  rowTimeNext: { fontSize: FontSize.h3, color: Colors.primary },
  faded: { color: Colors.ink400 },
  struck: { textDecorationLine: 'line-through' },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.ink700 },
  rowSub: { fontFamily: FontFamily.bodyMedium, fontSize: FontSize.xs, color: Colors.textMuted },
  nextTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  nextText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.primary },
  rang: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.xs, color: Colors.ink400 },
});
