// Home (v3): Wakey's mood is your mornings. Next alarm hero, Streak v2 week, alarm cards.
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import StreakCard from '@/components/StreakCard';
import Wakey, { type Mood } from '@/components/Wakey';
import { PopButton, PopSwitch, PopView } from '@/components/pop';
import { Pop, PopFont } from '@/constants/pop';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { formatClock, repeatText } from '@/utils/clockFormat';
import { checkAndShowRating } from '@/utils/rating';
import { streakV2, type StreakInfo } from '@/utils/stats';
import { getWakeLog, type Alarm } from '@/utils/storage';
import { nextAlarmDate, untilParts } from '@/utils/time';
import { DEFAULT_MATH_LEVEL, DEFAULT_STEPS } from '@/utils/wakeCheck';

const hm = (alarm: Alarm) => alarm.time.split(':').map(Number) as [number, number];

/** The enabled alarm that rings first, and when. */
function nextUp(alarms: Alarm[], now: Date): { alarm: Alarm; at: Date } | null {
  let best: { alarm: Alarm; at: Date } | null = null;
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const [h, m] = hm(alarm);
    const at = nextAlarmDate(h, m, alarm.days, now);
    if (!best || at < best.at) best = { alarm, at };
  }
  return best;
}

/** Re-render every 30 s so "in 7h 12m" stays true. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function HomeScreen() {
  const { alarms, loading, toggleAlarmEnabled } = useAlarms();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const [info, setInfo] = useState<StreakInfo | null>(null);
  const [tapMood, setTapMood] = useState<Mood | null>(null);
  const [wave, setWave] = useState(0);

  useFocusEffect(
    useCallback(() => {
      checkAndShowRating();
      getWakeLog().then(log => setInfo(streakV2(log, new Date())));
    }, []),
  );

  useEffect(() => {
    if (!tapMood) return;
    const timer = setTimeout(() => setTapMood(null), 1400);
    return () => clearTimeout(timer);
  }, [tapMood, wave]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={Pop.blue} />
      </View>
    );
  }

  const next = nextUp(alarms, now);
  const hour = now.getHours();
  const greeting = hour < 5 || hour >= 18 ? t('home.greetNight') : hour < 12 ? t('home.greetMorning') : t('home.greetAfternoon');
  const yesterdayMissed = info ? info.week[(info.today + 6) % 7] === 'missed' : false;
  // Wakey's mood is your mornings.
  const mood: Mood = tapMood ?? (!next ? 'sleepy' : yesterdayMissed ? 'snoozed' : 'awake');

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.date}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
            <Text style={styles.greeting} accessibilityRole="header">{greeting}</Text>
          </View>
          <PopButton style={styles.round} depth={3} onPress={() => router.push('/settings')} accessibilityLabel={t('home.settings')}>
            <Ionicons name="options-outline" size={22} color={Pop.ink} />
          </PopButton>
        </View>

        <Hero
          next={next}
          now={now}
          mood={mood}
          wave={wave}
          info={info}
          onWakey={() => {
            setTapMood('happy');
            setWave(w => w + 1);
          }}
        />

        {info && <StreakCard info={info} containerStyle={styles.streakBox} />}

        <View style={styles.sectionRow}>
          <Text style={styles.section} accessibilityRole="header">{t('home.alarms')}</Text>
          <PopButton style={[styles.round, styles.add]} depth={3} onPress={() => router.push('/alarm/new')} accessibilityLabel={t('edit.addTitle')}>
            <Ionicons name="add" size={26} color={Pop.ink} />
          </PopButton>
        </View>

        <View style={styles.list}>
          {alarms.map(alarm => (
            <AlarmCard key={alarm.id} alarm={alarm} onToggle={() => toggleAlarmEnabled(alarm.id)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Hero({
  next,
  now,
  mood,
  wave,
  info,
  onWakey,
}: {
  next: { alarm: Alarm; at: Date } | null;
  now: Date;
  mood: Mood;
  wave: number;
  info: StreakInfo | null;
  onWakey: () => void;
}) {
  const { t } = useLocale();
  const count = info?.count ?? 0;
  const bubble = count >= 2 ? t('home.streakDays', { count }) : count === 1 ? t('home.streakOne') : t('home.streakZero');
  let body;
  if (next) {
    const [h, m] = hm(next.alarm);
    const { time, ap } = formatClock(h, m);
    const left = untilParts(next.at, now);
    const until = left.d > 0 ? t('home.inDay', left) : left.h > 0 ? t('home.inHour', left) : t('home.inMin', left);
    body = (
      <>
        <Text style={styles.heroLabel}>{t('home.nextAlarm')}</Text>
        <View style={styles.heroTimeRow}>
          <Text style={styles.heroTime} adjustsFontSizeToFit numberOfLines={1}>{time}</Text>
          {!!ap && <Text style={styles.heroAp}>{ap}</Text>}
        </View>
        <Text style={styles.until}>{until}</Text>
        <Text style={styles.heroSub} numberOfLines={1}>
          {[next.alarm.label, repeatText(next.alarm.days)].filter(Boolean).join(' · ')}
        </Text>
      </>
    );
  } else {
    body = (
      <>
        <Text style={styles.heroLabel}>{t('home.nextAlarm')}</Text>
        <Text style={styles.heroEmpty}>{t('home.noAlarm')}</Text>
        <PopButton style={styles.heroAdd} depth={3} onPress={() => router.push('/alarm/new')}>
          <Text style={styles.heroAddText}>{t('home.addFirst')}</Text>
        </PopButton>
      </>
    );
  }
  return (
    <PopView style={styles.hero} containerStyle={styles.heroBox} depth={5}>
      <View style={styles.heroText}>{body}</View>
      <View style={styles.heroWakey}>
        <Wakey size={190} mood={mood} wave={wave} onPress={onWakey} accessibilityLabel={t('home.wakeyA11y')} />
      </View>
      <Text style={styles.bubble}>{bubble}</Text>
    </PopView>
  );
}

function AlarmCard({ alarm, onToggle }: { alarm: Alarm; onToggle: () => void }) {
  const { t } = useLocale();
  const [h, m] = hm(alarm);
  const { time, ap } = formatClock(h, m);
  const off = !alarm.enabled;
  const tasks = `${t('home.walkTask', { count: alarm.steps ?? DEFAULT_STEPS })} · ${t('home.mathTask', {
    level: t(`edit.mathLevel_${alarm.mathLevel ?? DEFAULT_MATH_LEVEL}`),
  })}`;
  return (
    <PopButton
      style={styles.card}
      haptic="none"
      onPress={() => router.push(`/alarm/${alarm.id}`)}
      accessibilityLabel={`${time} ${ap}, ${alarm.label || ''} ${repeatText(alarm.days)}`}
    >
      <View style={styles.cardText}>
        <View style={styles.cardTimeRow}>
          <Text style={[styles.cardTime, off && styles.off]}>{time}</Text>
          {!!ap && <Text style={[styles.cardAp, off && styles.off]}>{ap}</Text>}
        </View>
        <Text style={[styles.cardSub, off && styles.offSub]} numberOfLines={1}>
          {[alarm.label, repeatText(alarm.days)].filter(Boolean).join(' · ')}
        </Text>
        <Text style={[styles.cardTasks, off && styles.offSub]} numberOfLines={1}>{tasks}</Text>
      </View>
      <PopSwitch value={alarm.enabled} onValueChange={onToggle} accessibilityLabel={alarm.label || time} />
    </PopButton>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Pop.paper },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, gap: 0 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { gap: 2, flex: 1 },
  date: { fontFamily: PopFont.semibold, fontSize: 13, color: Pop.sub },
  greeting: { fontFamily: PopFont.heavy, fontSize: 30, letterSpacing: -0.9, color: Pop.ink },
  round: { width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  add: { width: 40, height: 40, backgroundColor: Pop.sun },

  heroBox: { marginTop: 40 },
  hero: { height: 236, borderRadius: 30, backgroundColor: Pop.blue, overflow: 'visible' },
  heroText: { position: 'absolute', left: 20, top: 18, right: 150, gap: 6 },
  heroLabel: { fontFamily: PopFont.bold, fontSize: 14, color: Pop.onBlue },
  heroTimeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  heroTime: { fontFamily: PopFont.heavy, fontSize: 76, lineHeight: 80, letterSpacing: -3.4, color: Pop.white, fontVariant: ['tabular-nums'] },
  heroAp: { fontFamily: PopFont.heavy, fontSize: 18, color: Pop.white },
  until: {
    alignSelf: 'flex-start',
    fontFamily: PopFont.heavy,
    fontSize: 14,
    color: Pop.ink,
    backgroundColor: Pop.sun,
    borderWidth: 2,
    borderColor: Pop.ink,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  heroSub: { fontFamily: PopFont.semibold, fontSize: 14, color: Pop.onBlue },
  heroEmpty: { fontFamily: PopFont.heavy, fontSize: 30, letterSpacing: -0.8, color: Pop.white, marginVertical: 8 },
  heroAdd: { alignSelf: 'flex-start', backgroundColor: Pop.sun, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  heroAddText: { fontFamily: PopFont.heavy, fontSize: 15, color: Pop.ink },
  heroWakey: { position: 'absolute', right: -6, top: -30 },
  bubble: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    fontFamily: PopFont.heavy,
    fontSize: 13,
    color: Pop.ink,
    backgroundColor: Pop.white,
    borderWidth: 2,
    borderColor: Pop.ink,
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  streakBox: { marginTop: 20 },
  sectionRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontFamily: PopFont.heavy, fontSize: 22, letterSpacing: -0.4, color: Pop.ink },
  list: { marginTop: 10, gap: 12 },
  card: { borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardText: { flex: 1, gap: 2 },
  cardTimeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  cardTime: { fontFamily: PopFont.heavy, fontSize: 30, letterSpacing: -0.9, color: Pop.ink, fontVariant: ['tabular-nums'] },
  cardAp: { fontFamily: PopFont.heavy, fontSize: 13, color: Pop.ink },
  cardSub: { fontFamily: PopFont.semibold, fontSize: 13, color: Pop.sub },
  cardTasks: { fontFamily: PopFont.semibold, fontSize: 12, color: Pop.sub },
  off: { color: Pop.faint },
  offSub: { color: Pop.faint },
});
