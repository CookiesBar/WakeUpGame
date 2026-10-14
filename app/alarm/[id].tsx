import { GlassButton } from '@/components/Glass';
import WheelPicker from '@/components/WheelPicker';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { strings, t } from '@/i18n';
import { MathLevel } from '@/utils/math';
import { DEFAULT_SOUND_ID, getSoundName, stopAlarmSound, takePickedSound } from '@/utils/sounds';
import { DEFAULT_MATH_LEVEL, DEFAULT_STEPS, MATH_LEVELS, STEP_OPTIONS } from '@/utils/wakeCheck';
import { bedtimes } from '@/utils/sleepCycle';
import { Alarm, getAlarms } from '@/utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Switch,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

// When the alarm next rings
const nextAlarmDate = (hours: number, minutes: number, days: boolean[]): Date => {
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

    return alarmTime;
};

// Header subtitle: "Alarm in 7 h 20 min"
const calculateNextAlarm = (alarmTime: Date): string => {
    const diffMs = alarmTime.getTime() - Date.now();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours === 0) {
        return t('edit.inMinutes', { m: diffMinutes });
    } else if (diffHours < 24) {
        return t('edit.inHours', { h: diffHours, m: diffMinutes });
    } else {
        return t('edit.inDays', { d: Math.floor(diffHours / 24), h: diffHours % 24 });
    }
};

const formatHM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function AlarmEditScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const isNew = id === 'new';
    const { addAlarm, updateAlarm, removeAlarm } = useAlarms();
    useLocale(); // re-render on language change

    // Form state
    const [hours, setHours] = useState(7);
    const [minutes, setMinutes] = useState(0);
    const [label, setLabel] = useState('');
    const [days, setDays] = useState<boolean[]>(Array(7).fill(true)); // new alarms: every day
    const [wakeCheck, setWakeCheck] = useState(true);
    const [steps, setSteps] = useState<number>(DEFAULT_STEPS);
    const [mathLevel, setMathLevel] = useState<MathLevel>(DEFAULT_MATH_LEVEL);
    const [original, setOriginal] = useState<Alarm | null>(null);

    const [soundId, setSoundId] = useState<string>(DEFAULT_SOUND_ID);
    const [loading, setLoading] = useState(!isNew);

    // Repeat day picker starts open; the row header collapses it
    const [showRepeatPicker, setShowRepeatPicker] = useState(true);

    // Pick up the sound chosen on the sounds screen when we're back in focus
    useFocusEffect(useCallback(() => {
        const picked = takePickedSound();
        if (picked) setSoundId(picked);
    }, []));

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
            setWakeCheck(alarm.wakeCheck !== false);
            setSteps(alarm.steps ?? DEFAULT_STEPS);
            setMathLevel(alarm.mathLevel ?? DEFAULT_MATH_LEVEL);
            setOriginal(alarm);

            if (alarm.soundUri) {
                setSoundId(alarm.soundUri);
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
        const selectedDays = days.map((selected, index) => selected ? strings().days.short[index] : null).filter(Boolean);

        if (selectedDays.length === 0) {
            return t('edit.never');
        }

        if (selectedDays.length === 7) {
            return t('edit.everyDay');
        }

        // Check for weekdays (Mon-Fri)
        if (days[1] && days[2] && days[3] && days[4] && days[5] && !days[0] && !days[6]) {
            return t('edit.weekdays');
        }

        // Check for weekends
        if (days[0] && days[6] && !days[1] && !days[2] && !days[3] && !days[4] && !days[5]) {
            return t('edit.weekends');
        }

        return selectedDays.join(', ');
    };

    // Generate wheel picker data (24-hour clock: index = hour)
    const hoursData = useMemo(() =>
        Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
        []);

    const minutesData = useMemo(() =>
        Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')),
        []);


    const handleSelectSound = () => {
        router.push({
            pathname: '/alarm/sounds',
            params: { currentSoundId: soundId }
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
            wakeCheck,
            steps,
            mathLevel,
        };

        try {
            if (isNew) {
                await addAlarm(alarmData);
            } else {
                // Spread the original so fields the editor doesn't show (createdAt) survive
                await updateAlarm({
                    ...original!,
                    ...alarmData,
                    id: id!,
                });
            }
            router.back();
        } catch (error) {
            Alert.alert(t('common.error'), t('edit.saveFailed'));
        }
    };

    const handleDelete = () => {
        Alert.alert(
            t('edit.delete'),
            t('edit.deleteConfirm'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
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
                    <Text>{t('edit.loading')}</Text>
                </View>
            </SafeAreaView>
        );
    }

    const nextAlarmAt = nextAlarmDate(hours, minutes, days);
    const nextAlarmText = calculateNextAlarm(nextAlarmAt);
    const beds = bedtimes(nextAlarmAt, new Date());
    const suggested = beds.find(b => !b.passed);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <GlassButton icon="close" color={Colors.text} onPress={() => router.back()} accessibilityLabel={t('common.cancel')} />
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{isNew ? t('edit.addTitle') : t('edit.editTitle')}</Text>
                    <Text style={styles.headerSubtitle}>{nextAlarmText}</Text>
                </View>
                <GlassButton icon="checkmark" color="#FFFFFF" tintColor={Colors.accent} onPress={handleSave} accessibilityLabel={t('common.save')} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Time Picker */}
                <GestureHandlerRootView style={styles.timePicker}>
                    <WheelPicker
                        data={hoursData}
                        selectedIndex={hours}
                        onIndexChange={setHours}
                        style={styles.hourPicker}
                        infinite={true}
                    />

                    <Text style={styles.timeColon}>:</Text>
                    <WheelPicker
                        data={minutesData}
                        selectedIndex={minutes}
                        onIndexChange={setMinutes}
                        style={styles.minutePicker}
                        infinite={true}
                    />
                </GestureHandlerRootView>

                {/* Sleep cycle bedtime hints (display only) */}
                <View style={styles.bedtimes}>
                    <Text style={styles.bedtimesLabel}>{t('edit.bedBy')}</Text>
                    <View style={styles.bedtimeRow}>
                        {beds.map(b => (
                            <View
                                key={b.cycles}
                                style={[styles.bedtime, b.passed && styles.bedtimePassed]}
                                accessible
                                accessibilityLabel={t('edit.bedtimeA11y', { time: formatHM(b.at), h: b.cycles * 1.5 })}
                            >
                                <Text style={[styles.bedtimeTime, b === suggested && styles.bedtimeSuggested]}>{formatHM(b.at)}</Text>
                                <Text style={styles.bedtimeHours}>{t('edit.sleepHours', { h: b.cycles * 1.5 })}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Alarm name + Repeat */}
                <View style={styles.settingsList}>
                    {/* Alarm name */}
                    <View style={styles.settingsRow}>
                        <Text style={styles.settingsLabel}>{t('edit.label')}</Text>
                        <TextInput
                            style={styles.settingsInput}
                            placeholder={t('edit.labelPlaceholder')}
                            placeholderTextColor={Colors.textMuted}
                            value={label}
                            onChangeText={setLabel}
                            maxLength={16}
                        />
                    </View>

                    <View style={styles.settingsDivider} />

                    {/* Repeat - day picker open by default */}
                    <Pressable
                        style={styles.settingsRow}
                        onPress={() => setShowRepeatPicker(!showRepeatPicker)}
                    >
                        <Text style={styles.settingsLabel}>{t('edit.repeat')}</Text>
                        <View style={styles.settingsValueContainer}>
                            <Text style={styles.settingsValue} numberOfLines={1} ellipsizeMode="tail">
                                {getRepeatDisplayText()}
                            </Text>
                            <Ionicons name={showRepeatPicker ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
                        </View>
                    </Pressable>

                    {/* Repeat Day Picker (expandable) */}
                    {showRepeatPicker && (
                        <View style={styles.repeatPickerContainer}>
                            <View style={styles.daysRow}>
                                {strings().days.short.map((day, index) => (
                                    <Pressable
                                        key={day}
                                        style={[styles.dayButton, days[index] && styles.dayButtonActive]}
                                        onPress={() => toggleDay(index)}
                                    >
                                        <Text style={[styles.dayText, days[index] && styles.dayTextActive]}>
                                            {strings().days.letter[index]}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* Alarm sound */}
                <View style={styles.settingsList}>
                    <Pressable style={styles.settingsRow} onPress={handleSelectSound}>
                        <Text style={styles.settingsLabel}>{t('edit.sound')}</Text>
                        <View style={styles.settingsValueContainer}>
                            <Text style={styles.settingsValue} numberOfLines={1} ellipsizeMode="tail">
                                {getSoundName(soundId)}
                            </Text>
                            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                        </View>
                    </Pressable>
                </View>

                {/* Wake-up games + Still awake? check */}
                <View style={styles.settingsList}>
                    {/* Wake-up game difficulty */}
                    <View style={styles.settingsRow}>
                        <Text style={styles.settingsLabel}>{t('edit.steps')}</Text>
                        <View style={styles.chips}>
                            {STEP_OPTIONS.map(n => (
                                <Pressable
                                    key={n}
                                    style={[styles.chip, steps === n && styles.chipActive]}
                                    onPress={() => setSteps(n)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: steps === n }}
                                    accessibilityLabel={t('edit.stepsValue', { count: n })}
                                >
                                    <Text style={[styles.chipText, steps === n && styles.chipTextActive]}>{n}</Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    <View style={styles.settingsDivider} />

                    <View style={styles.settingsRow}>
                        <Text style={styles.settingsLabel}>{t('edit.math')}</Text>
                        <View style={styles.chips}>
                            {MATH_LEVELS.map(level => (
                                <Pressable
                                    key={level}
                                    style={[styles.chip, mathLevel === level && styles.chipActive]}
                                    onPress={() => setMathLevel(level)}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: mathLevel === level }}
                                >
                                    <Text style={[styles.chipText, mathLevel === level && styles.chipTextActive]}>
                                        {t(`edit.mathLevel_${level}`)}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    <View style={styles.settingsDivider} />

                    {/* Still awake? check */}
                    <View style={styles.settingsRow}>
                        <View style={styles.wakeCheckText}>
                            <Text style={styles.settingsLabel}>{t('edit.wakeCheck')}</Text>
                            <Text style={styles.settingsHint}>{t('edit.wakeCheckHint')}</Text>
                        </View>
                        <Switch
                            value={wakeCheck}
                            onValueChange={setWakeCheck}
                            trackColor={{ true: Colors.accent, false: Colors.surfaceAlt }}
                            accessibilityLabel={t('edit.wakeCheck')}
                        />
                    </View>
                </View>

                {/* Delete Button */}
                {!isNew && (
                    <Pressable style={styles.deleteButton} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                        <Text style={styles.deleteText}>{t('edit.delete')}</Text>
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
    bedtimes: {
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: -Spacing.md,
        marginBottom: Spacing.lg,
    },
    bedtimesLabel: {
        fontSize: FontSize.xs,
        fontFamily: FontFamily.medium,
        color: Colors.textSecondary,
    },
    bedtimeRow: {
        flexDirection: 'row',
        gap: Spacing.xl,
    },
    bedtime: {
        alignItems: 'center',
    },
    bedtimeTime: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.medium,
        color: Colors.textSecondary,
        fontVariant: ['tabular-nums'],
    },
    bedtimeSuggested: {
        color: Colors.accent,
        fontFamily: FontFamily.bold,
    },
    bedtimeHours: {
        fontSize: FontSize.xs,
        fontFamily: FontFamily.regular,
        color: Colors.textMuted,
    },
    bedtimePassed: {
        opacity: 0.4,
    },
    timeColon: {
        fontSize: FontSize.title,
        fontFamily: FontFamily.bold,
        color: Colors.text,
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
        marginBottom: Spacing.lg,
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
    chips: {
        flexDirection: 'row',
        gap: Spacing.xs,
        marginLeft: Spacing.md,
    },
    chip: {
        paddingHorizontal: Spacing.sm + 4,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
        backgroundColor: Colors.surfaceAlt,
    },
    chipActive: {
        backgroundColor: Colors.accent,
    },
    chipText: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        color: Colors.textSecondary,
    },
    chipTextActive: {
        color: Colors.background,
    },
    wakeCheckText: {
        flex: 1,
        marginRight: Spacing.md,
    },
    settingsHint: {
        fontSize: FontSize.xs,
        fontFamily: FontFamily.regular,
        color: Colors.textSecondary,
        marginTop: 2,
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
        marginTop: Spacing.sm,
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
