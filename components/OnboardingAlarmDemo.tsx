import WheelPicker from '@/components/WheelPicker';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface OnboardingAlarmDemoProps {
    onNext: () => void;
}

export default function OnboardingAlarmDemo({ onNext }: OnboardingAlarmDemoProps) {
    // Demo state
    const [hours, setHours] = useState(7);
    const [minutes, setMinutes] = useState(0);
    const [label, setLabel] = useState('Wake up');
    const [days, setDays] = useState<boolean[]>([false, true, true, true, true, true, false]);
    const [showRepeatPicker, setShowRepeatPicker] = useState(false);

    // Generate wheel picker data
    const hoursData = useMemo(() =>
        Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')),
        []);

    const minutesData = useMemo(() =>
        Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')),
        []);

    const periodData = useMemo(() => ['AM', 'PM'], []);

    // Convert 24h hours to 12h format for wheel picker
    const getDisplayHour = () => {
        const h = hours % 12;
        return h === 0 ? 11 : h - 1;
    };

    const getPeriodIndex = () => hours >= 12 ? 1 : 0;

    const handleHourChange = (index: number) => {
        const newHour = index + 1;
        const isPM = hours >= 12;
        let h24 = isPM ? (newHour === 12 ? 12 : newHour + 12) : (newHour === 12 ? 0 : newHour);
        setHours(h24);
    };

    const handleMinuteChange = (index: number) => {
        setMinutes(index);
    };

    const handlePeriodChange = (index: number) => {
        const isPM = index === 1;
        const currentIsPM = hours >= 12;
        if (isPM !== currentIsPM) {
            setHours(prev => isPM ? prev + 12 : prev - 12);
        }
    };

    const toggleDay = (index: number) => {
        const newDays = [...days];
        newDays[index] = !newDays[index];
        setDays(newDays);
    };

    const getRepeatDisplayText = (): string => {
        const selectedDays = days.map((selected, index) => selected ? DAY_LABELS[index] : null).filter(Boolean);

        if (selectedDays.length === 0) return 'Never';
        if (selectedDays.length === 7) return 'Every day';
        if (days[1] && days[2] && days[3] && days[4] && days[5] && !days[0] && !days[6]) return 'Weekdays';
        if (days[0] && days[6] && !days[1] && !days[2] && !days[3] && !days[4] && !days[5]) return 'Weekends';

        return selectedDays.join(', ');
    };

    return (
        <View style={styles.container}>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Title */}
                <Text style={styles.title}>Try it out!</Text>
                <Text style={styles.subtitle}>Set your first alarm time</Text>

                {/* Time Picker */}
                <GestureHandlerRootView style={styles.timePicker}>
                    <WheelPicker
                        data={periodData}
                        selectedIndex={getPeriodIndex()}
                        onIndexChange={handlePeriodChange}
                        style={styles.periodPicker}
                        infinite={false}
                    />

                    <WheelPicker
                        data={hoursData}
                        selectedIndex={getDisplayHour()}
                        onIndexChange={handleHourChange}
                        style={styles.hourPicker}
                        infinite={true}
                    />

                    <WheelPicker
                        data={minutesData}
                        selectedIndex={minutes}
                        onIndexChange={handleMinuteChange}
                        style={styles.minutePicker}
                        infinite={true}
                    />
                </GestureHandlerRootView>

                {/* Settings List */}
                <View style={styles.settingsList}>
                    {/* Repeat */}
                    <Pressable
                        style={styles.settingsRow}
                        onPress={() => setShowRepeatPicker(!showRepeatPicker)}
                    >
                        <Text style={styles.settingsLabel}>Repeat</Text>
                        <View style={styles.settingsValueContainer}>
                            <Text style={styles.settingsValue} numberOfLines={1} ellipsizeMode="tail">
                                {getRepeatDisplayText()}
                            </Text>
                            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                        </View>
                    </Pressable>

                    {showRepeatPicker && (
                        <View style={styles.repeatPickerContainer}>
                            <View style={styles.daysRow}>
                                {DAY_LABELS.map((day, index) => (
                                    <Pressable
                                        key={day}
                                        style={[styles.dayButton, days[index] && styles.dayButtonActive]}
                                        onPress={() => toggleDay(index)}
                                    >
                                        <Text style={[styles.dayText, days[index] && styles.dayTextActive]}>
                                            {DAY_SHORT[index]}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    )}

                    <View style={styles.settingsDivider} />

                    {/* Label */}
                    <View style={styles.settingsRow}>
                        <Text style={styles.settingsLabel}>Label</Text>
                        <TextInput
                            style={styles.settingsInput}
                            placeholder="Enter label"
                            placeholderTextColor={Colors.textMuted}
                            value={label}
                            onChangeText={(text) => setLabel(text.slice(0, 16))}
                            maxLength={16}
                        />
                    </View>

                    <View style={styles.settingsDivider} />

                    {/* Sound - static display */}
                    <View style={styles.settingsRow}>
                        <Text style={styles.settingsLabel}>Alarm sound</Text>
                        <View style={styles.settingsValueContainer}>
                            <Text style={styles.settingsValue}>Default</Text>
                            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Next Button */}
            <View style={styles.buttonContainer}>
                <Pressable style={styles.button} onPress={onNext}>
                    <Text style={styles.buttonText}>GET STARTED</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        flex: 1,
    },
    title: {
        fontFamily: FontFamily.bold,
        fontSize: FontSize.xl,
        color: Colors.accent,
        textAlign: 'center',
        marginTop: Spacing.lg,
    },
    subtitle: {
        fontFamily: FontFamily.regular,
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginTop: Spacing.sm,
        marginBottom: Spacing.md,
    },
    timePicker: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.lg,
        gap: Spacing.md,
    },
    periodPicker: {
        width: 70,
    },
    hourPicker: {
        width: 90,
    },
    minutePicker: {
        width: 90,
    },
    settingsList: {
        backgroundColor: Colors.surface,
        marginHorizontal: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    settingsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        minHeight: 48,
    },
    settingsLabel: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.text,
    },
    settingsValueContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'flex-end',
        marginLeft: Spacing.md,
        gap: Spacing.xs,
    },
    settingsValue: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.textSecondary,
        textAlign: 'right',
    },
    settingsInput: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.textSecondary,
        textAlign: 'right',
        flex: 1,
        marginLeft: Spacing.md,
        paddingVertical: 0,
    },
    settingsDivider: {
        height: 1,
        backgroundColor: Colors.border,
        marginLeft: Spacing.md,
    },
    repeatPickerContainer: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayButton: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.full,
        backgroundColor: Colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayButtonActive: {
        backgroundColor: Colors.accent,
    },
    dayText: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        color: Colors.textSecondary,
    },
    dayTextActive: {
        color: Colors.background,
    },
    buttonContainer: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    button: {
        backgroundColor: Colors.accent,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
    },
    buttonText: {
        fontFamily: FontFamily.semibold,
        fontSize: FontSize.md,
        color: Colors.background,
        letterSpacing: 1,
    },
});
