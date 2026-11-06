// Home (v3 white): the streak card with Wakey's face on top, then the alarms. No next-alarm card.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PlusOne, { takePlusOne } from '@/components/PlusOne';
import Wakey, { type Mood } from '@/components/Wakey';
import { CtaButton, Flame, Tap, WSwitch, WeekDots, rise } from '@/components/white';
import { W, WFont } from '@/constants/white';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { strings } from '@/i18n';
import { formatClock, repeatText } from '@/utils/clockFormat';
import { checkAndShowRating } from '@/utils/rating';
import { streakV2, type StreakInfo } from '@/utils/stats';
import { getWakeLog, type Alarm } from '@/utils/storage';

export default function HomeScreen() {
  const { alarms, loading, toggleAlarmEnabled } = useAlarms();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<StreakInfo | null>(null);
  // Back from the wake-up game: +1 plays over Home, with the fresh streak (today included).
  const [plusOne, setPlusOne] = useState<StreakInfo | null>(null);

  useFocusEffect(
    useCallback(() => {
      const celebrate = takePlusOne();
      if (!celebrate) checkAndShowRating(); // after +1 instead, so the review prompt never covers it
      getWakeLog().then(log => {
        const fresh = streakV2(log, new Date());
        setInfo(fresh);
        if (celebrate) setPlusOne(fresh);
      });
    }, []),
  );

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={W.blue} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.flex} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Tap style={styles.round} onPress={() => router.push('/settings')} accessibilityLabel={t('home.settings')}>
            <Ionicons name="settings-outline" size={22} color={W.ink} />
          </Tap>
          <Tap style={[styles.round, styles.add]} onPress={() => router.push('/alarm/new')} accessibilityLabel={t('edit.addTitle')}>
            <Ionicons name="add" size={26} color={W.paper} />
          </Tap>
        </View>

        {info && (
          <Animated.View entering={rise()}>
            <Streak info={info} />
          </Animated.View>
        )}

        <Animated.View entering={rise(40)} style={styles.section}>
          <Text style={styles.h2} accessibilityRole="header">{t('home.alarms')}</Text>
          {alarms.length ? (
            <View style={styles.group}>
              {alarms.map((alarm, i) => (
                <AlarmRow key={alarm.id} alarm={alarm} first={i === 0} onToggle={() => toggleAlarmEnabled(alarm.id)} />
              ))}
            </View>
          ) : (
            <View style={[styles.group, styles.empty]}>
              <Text style={styles.emptyText}>{t('home.noAlarm')}</Text>
              <CtaButton label={t('home.addFirst')} onPress={() => router.push('/alarm/new')} style={styles.emptyButton} />
            </View>
          )}
        </Animated.View>
      </ScrollView>
      {plusOne && (
        <PlusOne
          info={plusOne}
          onClose={() => {
            setPlusOne(null);
            checkAndShowRating();
          }}
        />
      )}
    </View>
  );
}

/** Now, re-read on every minute boundary (Wakey's clock face shows it). */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        setNow(new Date());
        next();
      }, 60_000 - (Date.now() % 60_000) + 50);
    };
    next();
    return () => clearTimeout(timer);
  }, []);
  return now;
}

/** The count, what's next, Wakey glancing around (tap: happy for 1.4 s), and this week. */
function Streak({ info }: { info: StreakInfo }) {
  const { t } = useLocale();
  const [tapped, setTapped] = useState(0);
  const now = useMinute();
  useEffect(() => {
    if (!tapped) return;
    const timer = setTimeout(() => setTapped(0), 1400);
    return () => clearTimeout(timer);
  }, [tapped]);

  // Always smiling: glancing around, eyes closed in a grin when tapped.
  const mood: Mood = tapped ? 'proud' : 'awake';
  const restIndex = info.week.indexOf('rest');
  // Badges are out of this version (to be designed): the only note is a rest day used this week.
  const note = restIndex >= 0 ? t('home.restNote', { day: strings().days.short[(restIndex + 1) % 7] }) : null;

  return (
    <View style={styles.card} accessibilityLabel={t('home.dayStreak')}>
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          <View style={styles.kicker}>
            <Flame size={16} />
            <Text style={styles.kickerText}>{t('home.dayStreak')}</Text>
          </View>
          <Text style={styles.count} accessibilityLabel={`${info.count} ${t('home.dayStreak')}`}>{info.count}</Text>
          {!!note && <Text style={styles.note}>{note}</Text>}
        </View>
        <Wakey
          head
          size={124}
          mood={mood}
          time={now}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
            setTapped(n => n + 1);
          }}
          accessibilityLabel={t('home.wakeyA11y')}
        />
      </View>
      <WeekDots info={info} />
    </View>
  );
}

function AlarmRow({ alarm, first, onToggle }: { alarm: Alarm; first: boolean; onToggle: () => void }) {
  const [h, m] = alarm.time.split(':').map(Number);
  const { time, ap } = formatClock(h, m);
  const sub = [alarm.label, repeatText(alarm.days)].filter(Boolean).join(', ');
  const color = { color: alarm.enabled ? W.ink : W.dim };
  return (
    <View style={styles.rowIndent}>
      <View style={[styles.row, !first && styles.rule]}>
        <Tap style={styles.rowText} onPress={() => router.push(`/alarm/${alarm.id}`)} accessibilityLabel={`${time} ${ap}, ${sub}`}>
          <View style={styles.timeRow}>
            <Text style={[styles.time, color]}>{time}</Text>
            {!!ap && <Text style={[styles.ap, color]}>{ap}</Text>}
          </View>
          <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
        </Tap>
        <WSwitch value={alarm.enabled} onValueChange={onToggle} accessibilityLabel={`${time} ${ap}, ${sub}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: W.mist },
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 },
  round: { width: 44, height: 44, borderRadius: 999, backgroundColor: W.paper, alignItems: 'center', justifyContent: 'center' },
  add: { backgroundColor: W.cta },

  card: { marginHorizontal: 20, backgroundColor: W.paper, borderRadius: 24, padding: 20, gap: 20 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardText: { flex: 1, gap: 2 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kickerText: { fontFamily: WFont.semibold, fontSize: 15, lineHeight: 20, color: W.graphite },
  count: { fontFamily: WFont.bold, fontSize: 64, lineHeight: 72, letterSpacing: -2.56, color: W.ink, fontVariant: ['tabular-nums'] },
  note: { fontFamily: WFont.medium, fontSize: 15, lineHeight: 20, color: W.graphite },

  section: { marginTop: 28, paddingHorizontal: 20, gap: 12 },
  h2: { paddingHorizontal: 4, fontFamily: WFont.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2, color: W.ink },
  group: { backgroundColor: W.paper, borderRadius: 24, overflow: 'hidden' },
  rowIndent: { paddingLeft: 20 },
  row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, paddingRight: 20 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: W.hair },
  rowText: { flex: 1, gap: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  time: { fontFamily: WFont.semibold, fontSize: 40, lineHeight: 44, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
  ap: { fontFamily: WFont.semibold, fontSize: 17, lineHeight: 22 },
  sub: { fontFamily: WFont.medium, fontSize: 15, lineHeight: 20, color: W.graphite },
  empty: { padding: 20, gap: 16, alignItems: 'center' },
  emptyText: { fontFamily: WFont.semibold, fontSize: 17, color: W.graphite },
  emptyButton: { alignSelf: 'stretch' },
});
