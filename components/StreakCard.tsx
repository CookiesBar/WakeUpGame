// Streak v2 card: the count, this week Monday first (done, rest day, missed, open), and what's next.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { PopView } from '@/components/pop';
import { Pop, PopFont } from '@/constants/pop';
import { useLocale } from '@/contexts/LocaleContext';
import { strings } from '@/i18n';
import type { DayMark, StreakInfo } from '@/utils/stats';

const MARK: Record<DayMark, ViewStyle> = {
  done: { backgroundColor: Pop.blue },
  rest: { backgroundColor: Pop.mist },
  missed: { backgroundColor: Pop.white },
  open: { backgroundColor: 'transparent', borderStyle: 'dashed', borderColor: Pop.faint },
};

export default function StreakCard({ info, showCount = true, containerStyle }: { info: StreakInfo; showCount?: boolean; containerStyle?: ViewStyle }) {
  const { t } = useLocale();
  // The tables are Sunday-first; the week here is Monday-first.
  const letters = strings().days.letter;
  const short = strings().days.short;
  const restIndex = info.week.indexOf('rest');
  const note =
    restIndex >= 0
      ? t('home.restNote', { day: short[(restIndex + 1) % 7] })
      : info.nextMilestone
        ? t('home.nextBadge', { count: info.nextMilestone - info.count, badge: info.nextMilestone })
        : t('home.allBadges');
  return (
    <PopView style={styles.card} containerStyle={containerStyle}>
      {showCount && (
        <View style={styles.top}>
          <Text style={styles.count}>{info.count}</Text>
          <Text style={styles.label}>{t('ring.streak')}</Text>
        </View>
      )}
      <View style={styles.week}>
        {info.week.map((mark, i) => {
          const today = i === info.today;
          return (
            <View key={i} style={styles.day} accessible accessibilityLabel={`${short[(i + 1) % 7]}, ${t(`home.mark_${mark}`)}`}>
              <View style={[styles.dot, MARK[mark], today && mark === 'done' && styles.dotToday]}>
                {mark === 'done' && <Ionicons name="checkmark" size={13} color={today ? Pop.ink : Pop.white} />}
                {mark === 'rest' && <Text style={styles.restZ}>z</Text>}
              </View>
              <Text style={[styles.letter, today && styles.letterToday]}>{letters[(i + 1) % 7]}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.note}>{note}</Text>
    </PopView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  count: { fontFamily: PopFont.heavy, fontSize: 26, letterSpacing: -0.8, color: Pop.ink, fontVariant: ['tabular-nums'] },
  label: { fontFamily: PopFont.bold, fontSize: 15, color: Pop.ink },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 4 },
  dot: { width: 28, height: 28, borderRadius: 999, borderWidth: 2, borderColor: Pop.ink, alignItems: 'center', justifyContent: 'center' },
  dotToday: { backgroundColor: Pop.sun },
  restZ: { fontFamily: PopFont.heavy, fontSize: 12, color: Pop.ink },
  letter: { fontFamily: PopFont.bold, fontSize: 11, color: Pop.sub },
  letterToday: { color: Pop.ink, fontFamily: PopFont.heavy },
  note: { fontFamily: PopFont.semibold, fontSize: 12, color: Pop.sub },
});
