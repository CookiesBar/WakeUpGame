import WheelPicker from '@/components/WheelPicker';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { pickCustomSound, previewSound, stopAlarmSound } from '@/utils/sounds';
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
    View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AlarmEditScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const isNew = id === 'new';
    const { addAlarm, updateAlarm, removeAlarm, refreshCustomSounds, customSounds } = useAlarms();

    // Form state
    const [hours, setHours] = useState(7);
    const [minutes, setMinutes] = useState(0);
    const [label, setLabel] = useState('');
    const [days, setDays] = useState<boolean[]>([false, false, false, false, false, false, false]);

    const [soundUri, setSoundUri] = useState<string | null>(null);
    const [soundName, setSoundName] = useState('Default');
    const [loading, setLoading] = useState(!isNew);

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

            setSoundUri(alarm.soundUri);

            // Find sound name
            if (alarm.soundUri) {
                const sound = customSounds.find(s => s.uri === alarm.soundUri);
                setSoundName(sound?.name || 'Custom');
            }
        }
        setLoading(false);
    };

    const toggleDay = (index: number) => {
        const newDays = [...days];
        newDays[index] = !newDays[index];
        setDays(newDays);
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

    const handleSelectSound = async () => {
        const sound = await pickCustomSound();
        if (sound) {
            setSoundUri(sound.uri);
            setSoundName(sound.name);
            await refreshCustomSounds();
        }
    };

    const handlePreviewSound = () => {
        previewSound(soundUri);
    };

    const handleSave = async () => {
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

        const alarmData = {
            time: timeString,
            label,
            enabled: true,
            days,
            soundUri,
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

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.headerButton}>
                    <Ionicons name="close" size={28} color={Colors.text} />
                </Pressable>
                <Text style={styles.headerTitle}>{isNew ? 'New Alarm' : 'Edit Alarm'}</Text>
                <Pressable onPress={handleSave} style={styles.headerButton}>
                    <Text style={styles.saveButton}>Save</Text>
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

                {/* Repeat Days */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Repeat</Text>
                    <View style={styles.daysRow}>
                        {DAY_LABELS.map((day, index) => (
                            <Pressable
                                key={day}
                                style={[styles.dayButton, days[index] && styles.dayButtonActive]}
                                onPress={() => toggleDay(index)}
                            >
                                <Text style={[styles.dayText, days[index] && styles.dayTextActive]}>
                                    {day}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Label */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Label</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Alarm name"
                        placeholderTextColor={Colors.textMuted}
                        value={label}
                        onChangeText={setLabel}
                    />
                </View>

                {/* Sound */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Sound</Text>
                    <View style={styles.soundRow}>
                        <Pressable style={styles.soundSelect} onPress={handleSelectSound}>
                            <Ionicons name="musical-notes" size={20} color={Colors.textSecondary} />
                            <Text style={styles.soundName}>{soundName}</Text>
                            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                        </Pressable>
                        <Pressable style={styles.previewButton} onPress={handlePreviewSound}>
                            <Ionicons name="play" size={20} color={Colors.accent} />
                        </Pressable>
                    </View>
                    <Pressable
                        style={styles.defaultSoundButton}
                        onPress={() => {
                            setSoundUri(null);
                            setSoundName('Default');
                        }}
                    >
                        <Text style={styles.defaultSoundText}>Use default sound</Text>
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
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerButton: {
        padding: Spacing.sm,
    },
    headerTitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.semibold,
        color: Colors.text,
    },
    saveButton: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semibold,
        color: Colors.accent,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
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
    section: {
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.semibold,
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Spacing.md,
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayButton: {
        width: 44,
        height: 44,
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
    input: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.text,
    },
    soundRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    soundSelect: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
    },
    soundName: {
        flex: 1,
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: Colors.text,
    },
    previewButton: {
        width: 44,
        height: 44,
        backgroundColor: Colors.surfaceAlt,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    defaultSoundButton: {
        marginTop: Spacing.sm,
        alignSelf: 'flex-start',
    },
    defaultSoundText: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        color: Colors.accent,
    },

    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.lg,
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
