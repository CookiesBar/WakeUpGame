import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { Alarm } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function AlarmCard({ alarm, onToggle }: { alarm: Alarm; onToggle: () => void }) {
  const [hours, minutes] = alarm.time.split(':');
  const hour = parseInt(hours);
  const isPM = hour >= 12;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  const activeDays = alarm.days
    .map((active, index) => (active ? DAY_LABELS[index] : null))
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      style={[styles.alarmCard, !alarm.enabled && styles.alarmCardDisabled]}
      onPress={() => router.push(`/alarm/${alarm.id}`)}
    >
      <View style={styles.alarmTimeContainer}>
        <Text style={[styles.alarmTime, !alarm.enabled && styles.textDisabled]}>
          {displayHour}:{minutes}
        </Text>
        <Text style={[styles.alarmPeriod, !alarm.enabled && styles.textDisabled]}>
          {isPM ? 'PM' : 'AM'}
        </Text>
      </View>

      <View style={styles.alarmInfo}>
        {alarm.label ? (
          <Text style={[styles.alarmLabel, !alarm.enabled && styles.textDisabled]}>
            {alarm.label}
          </Text>
        ) : null}
        <View style={styles.alarmDays}>
          {activeDays ? (
            <Text style={[styles.daysText, !alarm.enabled && styles.textDisabled]}>
              {activeDays}
            </Text>
          ) : (
            <Text style={[styles.daysText, !alarm.enabled && styles.textDisabled]}>
              Once
            </Text>
          )}
        </View>
      </View>

      <Pressable
        style={[styles.toggle, alarm.enabled && styles.toggleActive]}
        onPress={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <View style={[styles.toggleKnob, alarm.enabled && styles.toggleKnobActive]} />
      </Pressable>
    </Pressable>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Ionicons name="alarm-outline" size={64} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>No Alarms</Text>
      <Text style={styles.emptySubtitle}>
        Tap the + button to create your first alarm
      </Text>
    </View>
  );
}

export default function AlarmListScreen() {
  const { alarms, loading, toggleAlarmEnabled } = useAlarms();

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Alarm</Text>
        <Pressable
          style={styles.addButton}
          onPress={() => router.push('/alarm/new')}
        >
          <Ionicons name="add" size={28} color={Colors.primary} />
        </Pressable>
      </View>

      <FlatList
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
          alarms.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={EmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.bold,
    color: Colors.text,
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.full,
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
  alarmTimeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  alarmTime: {
    fontSize: FontSize.title,
    fontFamily: FontFamily.bold,
    color: Colors.text,
  },
  alarmPeriod: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  alarmInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  alarmLabel: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.medium,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  alarmDays: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  daysText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
  },
  textDisabled: {
    color: Colors.textMuted,
  },
  toggle: {
    width: 50,
    height: 30,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.full,
    padding: 3,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.accent,
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
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
