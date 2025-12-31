import WheelPicker from '@/components/WheelPicker';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { DEFAULT_SOUND_ID, getSoundName, stopAlarmSound } from '@/utils/sounds';
import { getAlarms } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Calculate next alarm time for header subtitle
const calculateNextAlarm = (hours: number, minutes: number, days: boolean[]): string => {
    const now = new Date();
    const alarmTime = new Date();
    alarmTime.setHours(hours, minutes, 0, 0);

    if (days.some(d => d)) {
        // Find next occurrence based on selected days
        const currentDay = now.getDay();
        let daysUntilNextAlarm = -1;

        for (let i = 0; i < 7; i++) {
            const checkDay = (currentDay + i) % 7;
            if (days[checkDay]) {
                if (i === 0) {
                    // Today - check if time has passed
                    if (alarmTime > now) {
                        daysUntilNextAlarm = 0;
                        break;
                    }
                } else {
                    daysUntilNextAlarm = i;
                    break;
                }
            }
        }

        if (daysUntilNextAlarm === -1) {
            // Wrap around to first selected day
            for (let i = 0; i < 7; i++) {
                const checkDay = (currentDay + i) % 7;
                if (days[checkDay]) {
                    daysUntilNextAlarm = i + 7;
                    break;
                }
            }
        }

        if (daysUntilNextAlarm >= 0) {
            alarmTime.setDate(alarmTime.getDate() + daysUntilNextAlarm);
        }
    } else {
        // One-time alarm
        if (alarmTime <= now) {
            alarmTime.setDate(alarmTime.getDate() + 1);
        }
    }

    const diffMs = alarmTime.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours === 0) {
        return `Alarm in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
        return `Alarm in ${diffHours} hour${diffHours !== 1 ? 's' : ''} ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
    } else {
        const diffDays = Math.floor(diffHours / 24);
        const remainingHours = diffHours % 24;
        return `Alarm in ${diffDays} day${diffDays !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
    }
};

export default function AlarmEditScreen() {
    const { id, selectedSoundId: routeSoundId, selectedSoundName: routeSoundName } = useLocalSearchParams<{
        id: string;
        selectedSoundId?: string;
        selectedSoundName?: string;
    }>();
    const isNew = id === 'new';
    const { addAlarm, updateAlarm, removeAlarm } = useAlarms();

    // Form state
    const [hours, setHours] = useState(7);
    const [minutes, setMinutes] = useState(0);
    const [label, setLabel] = useState('');
    const [days, setDays] = useState<boolean[]>([false, false, false, false, false, false, false]);

    const [soundId, setSoundId] = useState<string>(DEFAULT_SOUND_ID);
    const [soundName, setSoundName] = useState(getSoundName(DEFAULT_SOUND_ID));
    const [loading, setLoading] = useState(!isNew);

    // State for repeat day picker modal
    const [showRepeatPicker, setShowRepeatPicker] = useState(false);

    // Handle sound selection from sounds screen
    useEffect(() => {
        if (routeSoundId) {
            setSoundId(routeSoundId);
            setSoundName(routeSoundName || getSoundName(routeSoundId));
        }
    }, [routeSoundId, routeSoundName]);

    // Load existing alarm if editing
    useEffect(() => {
        if (!isNew) {
            loadAlarm();
        }
    }, [id, isNew]);

    const loadAlarm = async () => {
        const alarms = await getAlarms();
        const alarm = alarms.find(a => a.id === id);
        if (alarm) {
            const [h, m] = alarm.time.split(':').map(Number);
            setHours(h);
            setMinutes(m);
            setLabel(alarm.label);
            setDays(alarm.days);

            // Load sound - but only if we're NOT coming back from sound selection screen
            // If routeSoundId is present, it means user just selected a sound, so don't overwrite
            if (alarm.soundUri && !routeSoundId) {
                setSoundId(alarm.soundUri);
                setSoundName(getSoundName(alarm.soundUri));
            }
        }
        setLoading(false);
    };

    const toggleDay = (index: number) => {
        const newDays = [...days];
        newDays[index] = !newDays[index];
        setDays(newDays);
    };

    // Get display text for selected days
    const getRepeatDisplayText = (): string => {
        const selectedDays = days.map((selected, index) => selected ? DAY_LABELS[index] : null).filter(Boolean);

        if (selectedDays.length === 0) {
            return 'Never';
        }

        if (selectedDays.length === 7) {
            return 'Every day';
        }

        // Check for weekdays (Mon-Fri)
        if (days[1] && days[2] && days[3] && days[4] && days[5] && !days[0] && !days[6]) {
            return 'Weekdays';
        }

        // Check for weekends
        if (days[0] && days[6] && !days[1] && !days[2] && !days[3] && !days[4] && !days[5]) {
            return 'Weekends';
        }

        return selectedDays.join(', ');
    };

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
        return h === 0 ? 11 : h - 1; // Index for hoursData (01-12)
    };

    const getPeriodIndex = () => hours >= 12 ? 1 : 0;

    const handleHourChange = (index: number) => {
        const newHour = index + 1; // 1-12
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

    const handleSelectSound = () => {
        router.push({
            pathname: '/alarm/sounds',
            params: { currentSoundId: soundId, alarmId: id }
        });
    };

    const handleSave = async () => {
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        const alarmData = {
            time: timeString,
            label,
            enabled: true,
            days,
            soundUri: soundId, // Store soundId in soundUri field for compatibility
        };

        try {
            if (isNew) {
                await addAlarm(alarmData);
            } else {
                await updateAlarm({
                    ...alarmData,
                    id: id!,
                    createdAt: Date.now(),
                });
            }
            router.back();
        } catch (error) {
            Alert.alert('Error', 'Failed to save alarm');
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Alarm',
            'Are you sure you want to delete this alarm?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await removeAlarm(id!);
                        router.back();
                    },
                },
            ]
        );
    };

    useEffect(() => {
        return () => {
            stopAlarmSound();
        };
    }, []);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <Text>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    const nextAlarmText = calculateNextAlarm(hours, minutes, days);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.headerButton}>
                    <Ionicons name="close" size={24} color={Colors.text} />
                </Pressable>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{isNew ? 'Add alarm' : 'Edit alarm'}</Text>
                    <Text style={styles.headerSubtitle}>{nextAlarmText}</Text>
                </View>
                <Pressable onPress={handleSave} style={styles.headerButton}>
                    <Ionicons name="checkmark" size={24} color={Colors.text} />
                </Pressable>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Time Picker */}
                <GestureHandlerRootView style={styles.timePicker}>
                    {/* AM/PM Picker */}
                    <WheelPicker
                        data={periodData}
                        selectedIndex={getPeriodIndex()}
                        onIndexChange={handlePeriodChange}
                        style={styles.periodPicker}
                        infinite={false}
                    />

                    {/* Hours Picker */}
                    <WheelPicker
                        data={hoursData}
                        selectedIndex={getDisplayHour()}
                        onIndexChange={handleHourChange}
                        style={styles.hourPicker}
                        infinite={true}
                    />

                    {/* Minutes Picker */}
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
                    {/* 1. Repeat - shows selected days */}
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

                    {/* Repeat Day Picker (expandable) */}
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

                    {/* Divider */}
                    <View style={styles.settingsDivider} />

                    {/* 2. Label - input field */}
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

                    {/* Divider */}
                    <View style={styles.settingsDivider} />

                    {/* 3. Alarm Sound - shows sound name, press to navigate */}
                    <Pressable style={styles.settingsRow} onPress={handleSelectSound}>
                        <Text style={styles.settingsLabel}>Alarm sound</Text>
                        <View style={styles.settingsValueContainer}>
                            <Text style={styles.settingsValue} numberOfLines={1} ellipsizeMode="tail">
                                {soundName}
                            </Text>
                            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                        </View>
                    </Pressable>
                </View>

                {/* Delete Button */}
                {!isNew && (
                    <Pressable style={styles.deleteButton} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                        <Text style={styles.deleteText}>Delete Alarm</Text>
                    </Pressable>
                )}

                <View style={styles.bottomSpacer} />
            </ScrollView>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    headerButton: {
        padding: Spacing.sm,
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semibold,
        color: Colors.text,
    },
    headerSubtitle: {
        fontSize: FontSize.xs,
        fontFamily: FontFamily.regular,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    content: {
        flex: 1,
    },
    timePicker: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.xl,
        gap: Spacing.md,
    },
    periodPicker: {
        width: 80,
    },
    hourPicker: {
        width: 100,
    },
    minutePicker: {
        width: 100,
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
        minHeight: 52,
    },
    settingsLabel: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.text,
        flexShrink: 0,
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
        flexShrink: 1,
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
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.lg,
        marginTop: Spacing.xl,
        gap: Spacing.sm,
    },
    deleteText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.medium,
        color: Colors.danger,
    },
    bottomSpacer: {
        height: Spacing.xxl,
    },
});
