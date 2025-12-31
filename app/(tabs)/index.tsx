import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { checkAndShowRating } from '@/utils/rating';
import { Alarm } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// Set to true to show debug button
const DEV_MODE = __DEV__;

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Animated Toggle Switch
function AnimatedSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  const translateX = useSharedValue(enabled ? 20 : 0);
  const progress = useSharedValue(enabled ? 1 : 0);

  useEffect(() => {
    translateX.value = withSpring(enabled ? 20 : 0, {
      damping: 15,
      stiffness: 200,
    });
    progress.value = withSpring(enabled ? 1 : 0, {
      damping: 15,
      stiffness: 200,
    });
  }, [enabled]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [Colors.surfaceAlt, Colors.accent]
    ),
  }));

  return (
    <Pressable onPress={onToggle}>
      <Animated.View style={[styles.toggle, trackStyle]}>
        <Animated.View style={[styles.toggleKnob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

function AlarmCard({ alarm, onToggle }: { alarm: Alarm; onToggle: () => void }) {
  const [hours, minutes] = alarm.time.split(':');
  const hour = parseInt(hours);
  const isPM = hour >= 12;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  const activeDays = alarm.days
    .map((active, index) => (active ? DAY_LABELS[index] : null))
    .filter(Boolean)
    .join(' ');

  // Truncate days text to 12 characters
  const truncatedDays = activeDays.length > 30
    ? activeDays.substring(0, 30) + '...'
    : activeDays;

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
            {displayHour}:{minutes}
          </Text>
          <Text style={[styles.alarmPeriod, !alarm.enabled && styles.textDisabled]}>
            {isPM ? 'PM' : 'AM'}
          </Text>
        </View>

        {/* Repeat days below time */}
        <View style={styles.alarmDays}>
          <Text style={[styles.daysText, !alarm.enabled && styles.textDisabled]}>
            {truncatedDays || 'Once'}
          </Text>
        </View>
      </View>

      <AnimatedSwitch
        enabled={alarm.enabled}
        onToggle={onToggle}
      />
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

  // Check and show rating dialog when screen is focused
  useFocusEffect(
    useCallback(() => {
      checkAndShowRating();
    }, [])
  );

  const handleResetOnboarding = async () => {
    Alert.alert(
      'Reset Onboarding',
      'This will reset the onboarding status. The app will restart to show onboarding.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('hasSeenOnboarding');
            Alert.alert('Done', 'Please restart the app to see onboarding.');
          },
        },
      ]
    );
  };

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
        {DEV_MODE ? (
          <Pressable onPress={handleResetOnboarding}>
            <Ionicons name="refresh" size={24} color={Colors.textMuted} />
          </Pressable>
        ) : (
          <View style={{ width: 24 }} />
        )}
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
  alarmPeriod: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
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
  toggle: {
    width: 50,
    height: 30,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.full,
    padding: 3,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
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
