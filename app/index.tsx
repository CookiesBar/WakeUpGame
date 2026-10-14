import { GlassButton } from '@/components/Glass';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { strings } from '@/i18n';
import { checkAndShowRating } from '@/utils/rating';
import { Alarm } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function AlarmCard({ alarm, onToggle }: { alarm: Alarm; onToggle: () => void }) {
  const { t } = useLocale();

  const activeDays = alarm.days
    .map((active, index) => (active ? strings().days.short[index] : null))
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      style={[styles.alarmCard, !alarm.enabled && styles.alarmCardDisabled]}
      onPress={() => router.push(`/alarm/${alarm.id}`)}
    >
      <View style={styles.alarmInfoContainer}>
        {/* Label above time */}
        {alarm.label ? (
          <Text style={[styles.alarmLabel, !alarm.enabled && styles.textDisabled]}>
            {alarm.label}
          </Text>
        ) : null}

        {/* Time */}
        <View style={styles.alarmTimeContainer}>
          <Text style={[styles.alarmTime, !alarm.enabled && styles.textDisabled]}>
            {alarm.time}
          </Text>
        </View>

        {/* Repeat days below time */}
        <View style={styles.alarmDays}>
          <Text style={[styles.daysText, !alarm.enabled && styles.textDisabled]}>
            {activeDays || t('alarms.once')}
          </Text>
        </View>
      </View>

      {/* Native switch: Liquid Glass on iOS 26, Material on Android. */}
      <Switch
        value={alarm.enabled}
        onValueChange={onToggle}
        trackColor={{ false: Colors.surfaceAlt, true: Colors.accent }}
        ios_backgroundColor={Colors.surfaceAlt}
        accessibilityLabel={alarm.label || alarm.time}
      />
    </Pressable>
  );
}

function EmptyState() {
  const { t } = useLocale();
  return (
    <View style={styles.emptyState}>
      <Ionicons name="alarm-outline" size={64} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>{t('alarms.emptyTitle')}</Text>
      <Text style={styles.emptySubtitle}>{t('alarms.emptySubtitle')}</Text>
    </View>
  );
}

export default function AlarmListScreen() {
  const { alarms, loading, toggleAlarmEnabled } = useAlarms();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();

  // Check and show rating dialog when screen is focused
  useFocusEffect(
    useCallback(() => {
      checkAndShowRating();
    }, [])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ListHeaderComponent={<Text style={styles.title}>{t('alarms.title')}</Text>}
        data={alarms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AlarmCard
            alarm={item}
            onToggle={() => toggleAlarmEnabled(item.id)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          { paddingTop: insets.top },
          alarms.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={EmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating glass controls; the list scrolls underneath them. */}
      <View style={[styles.header, { top: insets.top }]} pointerEvents="box-none">
        <GlassButton
          icon="settings-outline"
          color={Colors.primary}
          onPress={() => router.push('/settings')}
          accessibilityLabel={t('settings.title')}
        />
        <GlassButton
          icon="add"
          size={28}
          color="#FFFFFF"
          tintColor={Colors.accent}
          onPress={() => router.push('/alarm/new')}
          accessibilityLabel={t('edit.addTitle')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    marginTop: 44 + Spacing.md, // clears the floating buttons
    marginBottom: Spacing.md,
    marginHorizontal: Spacing.xs,
    letterSpacing: -0.5,
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.bold,
    color: Colors.text,
  },
  list: {
    padding: Spacing.md,
  },
  listEmpty: {
    flex: 1,
  },
  alarmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  alarmCardDisabled: {
    backgroundColor: Colors.background,
  },
  alarmInfoContainer: {
    flex: 1,
  },
  alarmTimeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  alarmTime: {
    fontSize: FontSize.title,
    fontFamily: FontFamily.bold,
    color: Colors.text,
  },
  alarmLabel: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  alarmDays: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  daysText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
  },
  textDisabled: {
    color: Colors.textMuted,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.semibold,
    color: Colors.text,
    marginTop: Spacing.lg,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
