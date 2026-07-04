import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Mascot from '@/components/Mascot';
import ScreenBackground from '@/components/ScreenBackground';
import TabBar from '@/components/TabBar';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';

/** Soft rounded content card with an optional tinted top glow. */
function Card({
  children,
  accent,
  style,
}: {
  children: ReactNode;
  accent?: 'blue' | 'yellow';
  style?: object;
}) {
  const glow =
    accent === 'yellow'
      ? 'rgba(255,188,0,0.16)'
      : accent === 'blue'
      ? 'rgba(0,99,243,0.10)'
      : null;
  return (
    <View style={[styles.card, style]}>
      {glow && (
        <LinearGradient
          colors={[glow, 'transparent']}
          style={styles.cardGlow}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

const STAT_COLOR = {
  yellow: Colors.yellow700,
  blue: Colors.blue600,
  purple: Colors.purple600,
} as const;

function StreakStat({ value, label, icon, color }: {
  value: string;
  label: string;
  icon: string;
  color: keyof typeof STAT_COLOR;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color: STAT_COLOR[color] }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={styles.track}>
      <LinearGradient
        colors={[Colors.blue400, Colors.blue500]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fill, { width: `${pct}%` }]}
      />
    </View>
  );
}

function avgWake(times: string[]): string {
  if (times.length === 0) return '—';
  const total = times.reduce((sum, t) => {
    const [h, m] = t.split(':').map(Number);
    return sum + h * 60 + m;
  }, 0);
  const avg = Math.round(total / times.length);
  const h = Math.floor(avg / 60) % 24;
  const m = avg % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')}`;
}

// Sample weekly on-time history (real tracking is a later phase).
const WEEK = [
  { d: 'M', v: 1 },
  { d: 'T', v: 1 },
  { d: 'W', v: 0.9 },
  { d: 'T', v: 1 },
  { d: 'F', v: 0.7 },
  { d: 'S', v: 0.5 },
  { d: 'S', v: 0.3 },
];

export default function ProfileScreen() {
  const { alarms } = useAlarms();
  const enabledTimes = alarms.filter((a) => a.enabled).map((a) => a.time);

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>YOUR WAKE-UP STORY</Text>
          <Text style={styles.title}>You</Text>

          <Card accent="yellow" style={{ marginTop: Spacing.lg }}>
            <View style={styles.statsRow}>
              <StreakStat value="0" label="Day streak" icon="🔥" color="yellow" />
              <StreakStat value={avgWake(enabledTimes)} label="Avg wake" icon="☀️" color="blue" />
              <StreakStat value="0" label="Snoozes" icon="🚫" color="purple" />
            </View>
          </Card>

          <Card style={{ marginTop: Spacing.lg }}>
            <View style={styles.cardHead}>
              <Text style={styles.h3}>This week</Text>
              <Text style={styles.onTime}>94% on time</Text>
            </View>
            <View style={styles.chart}>
              {WEEK.map((x, i) => (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${x.v * 100}%`,
                          backgroundColor: x.v >= 0.9 ? Colors.blue500 : Colors.blue200,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barDay}>{x.d}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card accent="blue" style={{ marginTop: Spacing.lg }}>
            <View style={styles.badgeRow}>
              <Mascot mood="wakeup" size={72} />
              <View style={{ flex: 1 }}>
                <Text style={styles.h3}>Next badge: 30 days</Text>
                <View style={{ marginVertical: Spacing.sm }}>
                  <ProgressBar value={27 / 30} />
                </View>
                <Text style={styles.badgeSub}>3 mornings to go!</Text>
              </View>
            </View>
          </Card>
        </ScrollView>
      </SafeAreaView>
      <TabBar active="you" />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: 120 },
  eyebrow: {
    fontFamily: FontFamily.bodyBlack,
    fontSize: FontSize.xs,
    letterSpacing: 1.2,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.h1,
    color: Colors.ink900,
    marginTop: 2,
  },
  card: {
    position: 'relative',
    backgroundColor: Colors.surfaceCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    borderWidth: 1,
    borderColor: Colors.ink100,
    overflow: 'hidden',
    ...Shadow.md,
  },
  cardGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 2, paddingHorizontal: Spacing.md },
  statIcon: { fontSize: 26, lineHeight: 30 },
  statValue: { fontFamily: FontFamily.displayBold, fontSize: 32 },
  statLabel: {
    fontFamily: FontFamily.bodyBlack,
    fontSize: FontSize.xs,
    letterSpacing: 0.8,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  h3: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h3, color: Colors.ink900 },
  onTime: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.sm, color: Colors.green600 },
  chart: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', height: 110 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { width: '100%', flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 10 },
  barDay: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.xs, color: Colors.textFaint },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  badgeSub: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.sm, color: Colors.ink500 },
  track: {
    width: '100%',
    height: 14,
    backgroundColor: Colors.ink100,
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: BorderRadius.pill },
});
