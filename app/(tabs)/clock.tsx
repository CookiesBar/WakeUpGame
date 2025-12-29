import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function ClockScreen() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  const minutes = time.getMinutes();

  const displayHours = hours % 12 || 12;

  const weekday = WEEKDAYS[time.getDay()];
  const month = MONTHS[time.getMonth()];
  const date = time.getDate();

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Clock</Text>
      </View>

      <View style={styles.clockContainer}>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatNumber(displayHours)}</Text>
          <Text style={styles.colon}>:</Text>
          <Text style={styles.timeText}>{formatNumber(minutes)}</Text>
        </View>

        <Text style={styles.dateText}>{weekday}, {month} {date}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.bold,
    color: Colors.text,
  },
  clockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Spacing.xxl,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: FontSize.clock,
    fontFamily: FontFamily.bold,
    color: Colors.text,
    letterSpacing: -2,
  },
  colon: {
    fontSize: FontSize.clock,
    fontFamily: FontFamily.bold,
    color: Colors.text,
    marginHorizontal: Spacing.xs,
  },
  dateText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
  },
});
