import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, Colors, FontFamily, Shadow } from '@/constants/theme';

type TabId = 'alarms' | 'you';

const TABS: { id: TabId; label: string; icon: string; route: '/' | '/profile' }[] = [
  { id: 'alarms', label: 'Alarms', icon: '⏰', route: '/' },
  { id: 'you', label: 'You', icon: '🙂', route: '/profile' },
];

/** Frosted glass floating tab bar, matching the Wakey design. */
export default function TabBar({ active }: { active: TabId }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 14) }]}>
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <Pressable
            key={t.id}
            style={styles.tab}
            onPress={() => {
              if (!on) router.replace(t.route);
            }}
          >
            <Text style={[styles.icon, !on && styles.iconOff]}>{t.icon}</Text>
            <Text style={[styles.label, { color: on ? Colors.blue600 : Colors.textFaint }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 68,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: Colors.glassBg,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: 28,
    ...Shadow.md,
  },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 24 },
  icon: { fontSize: 22 },
  iconOff: { opacity: 0.5 },
  label: { fontFamily: FontFamily.bodyBlack, fontSize: 11 },
});
