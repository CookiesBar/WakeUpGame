// Alarm editor (v3): set the time on the curved wheel while Wakey watches it spin.
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TimeWheel from '@/components/TimeWheel';
import Wakey from '@/components/Wakey';
import { PopButton, PopSwitch, PopView } from '@/components/pop';
import { Pop, PopFont } from '@/constants/pop';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { strings, t } from '@/i18n';
import { clockText, formatClock, repeatText, uses24h } from '@/utils/clockFormat';
import { MathLevel } from '@/utils/math';
import { bedtimes } from '@/utils/sleepCycle';
import { DEFAULT_SOUND_ID, getSoundName, stopAlarmSound, takePickedSound } from '@/utils/sounds';
import { Alarm, getAlarms } from '@/utils/storage';
import { nextAlarmDate, untilParts } from '@/utils/time';
import { DEFAULT_MATH_LEVEL, DEFAULT_STEPS, MATH_LEVELS, STEP_OPTIONS } from '@/utils/wakeCheck';

// Header subtitle: "Alarm in 7 h 20 min"
const ringsIn = (at: Date): string => {
    const { d, h, m } = untilParts(at, new Date());
    if (d > 0) return t('edit.inDays', { d, h });
    if (h > 0) return t('edit.inHours', { h, m });
    return t('edit.inMinutes', { m });
};

const hourLabel = (h: number) => {
    if (uses24h()) return `${String(h).padStart(2, '0')}:00`;
    return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
};

export default function AlarmEditScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const isNew = id === 'new';
    const { addAlarm, updateAlarm, removeAlarm } = useAlarms();
    useLocale(); // re-render on language change
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const look = useSharedValue(0);

    // Form state
    const [mins, setMins] = useState(7 * 60);
    const [label, setLabel] = useState('');
    const [days, setDays] = useState<boolean[]>(Array(7).fill(true)); // new alarms: every day
    const [wakeCheck, setWakeCheck] = useState(true);
    const [gradualVolume, setGradualVolume] = useState(false);
    const [steps, setSteps] = useState<number>(DEFAULT_STEPS);
    const [mathLevel, setMathLevel] = useState<MathLevel>(DEFAULT_MATH_LEVEL);
    const [original, setOriginal] = useState<Alarm | null>(null);
    const [soundId, setSoundId] = useState<string>(DEFAULT_SOUND_ID);
    const [loading, setLoading] = useState(!isNew);

    // Pick up the sound chosen on the sounds screen when we're back in focus
    useFocusEffect(useCallback(() => {
        const picked = takePickedSound();
        if (picked) setSoundId(picked);
    }, []));

    useEffect(() => {
        if (isNew) return;
        (async () => {
            const alarm = (await getAlarms()).find(a => a.id === id);
            if (alarm) {
                const [h, m] = alarm.time.split(':').map(Number);
                setMins(h * 60 + m);
                setLabel(alarm.label);
                setDays(alarm.days);
                setWakeCheck(alarm.wakeCheck !== false);
                setGradualVolume(!!alarm.gradualVolume);
                setSteps(alarm.steps ?? DEFAULT_STEPS);
                setMathLevel(alarm.mathLevel ?? DEFAULT_MATH_LEVEL);
                setOriginal(alarm);
                if (alarm.soundUri) setSoundId(alarm.soundUri);
            }
            setLoading(false);
        })();
    }, [id, isNew]);

    useEffect(() => () => {
        stopAlarmSound();
    }, []);

    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;

    const handleSave = async () => {
        const alarmData = {
            time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
            label,
            enabled: true,
            days,
            soundUri: soundId, // Store soundId in soundUri field for compatibility
            wakeCheck,
            gradualVolume,
            steps,
            mathLevel,
        };
        try {
            if (isNew) await addAlarm(alarmData);
            // Spread the original so fields the editor doesn't show (createdAt) survive
            else await updateAlarm({ ...original!, ...alarmData, id: id! });
            router.back();
        } catch {
            Alert.alert(t('common.error'), t('edit.saveFailed'));
        }
    };

    const handleDelete = () => {
        Alert.alert(t('edit.delete'), t('edit.deleteConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                    await removeAlarm(id!);
                    router.back();
                },
            },
        ]);
    };

    if (loading) {
        return <View style={styles.screen} />;
    }

    const at = nextAlarmDate(hours, minutes, days, new Date());
    const bed = bedtimes(at, new Date()).find(b => !b.passed);
    const { time, ap } = formatClock(hours, minutes);
    const cycleSteps = () => setSteps(STEP_OPTIONS[(STEP_OPTIONS.indexOf(steps as (typeof STEP_OPTIONS)[number]) + 1) % STEP_OPTIONS.length]);
    const cycleMath = () => setMathLevel(MATH_LEVELS[(MATH_LEVELS.indexOf(mathLevel) + 1) % MATH_LEVELS.length]);

    return (
        <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
            <View style={styles.header}>
                <PopButton style={styles.pill} depth={3} onPress={() => router.back()}>
                    <Text style={styles.pillText}>{t('common.cancel')}</Text>
                </PopButton>
                <Text style={styles.title} numberOfLines={1}>{isNew ? t('edit.addTitle') : label || t('edit.editTitle')}</Text>
                <PopButton style={[styles.pill, styles.save]} depth={3} onPress={handleSave}>
                    <Text style={[styles.pillText, styles.saveText]}>{t('common.save')}</Text>
                </PopButton>
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
                <View style={styles.timeBlock}>
                    <View style={styles.timeRow}>
                        <Text style={styles.time}>{time}</Text>
                        {!!ap && <Text style={styles.ap}>{ap}</Text>}
                    </View>
                    <Text style={styles.ringsIn}>{ringsIn(at)}</Text>
                    {bed && (
                        <Text style={styles.bed}>
                            {t('edit.bedByLine', { time: clockText(bed.at.getHours(), bed.at.getMinutes()), h: bed.cycles * 1.5 })}
                        </Text>
                    )}
                    <View style={styles.wakey} pointerEvents="none">
                        <Wakey size={118} arms="down" lookX={look} />
                    </View>
                </View>

                <TimeWheel
                    minutes={mins}
                    onChange={setMins}
                    width={width - 40}
                    look={look}
                    hourLabel={hourLabel}
                    hint={t('edit.wheelHint')}
                    accessibilityLabel={t('edit.wheelLabel')}
                    accessibilityValue={ap ? `${time} ${ap}` : time}
                />

                <View style={styles.days}>
                    {strings().days.letter.map((letter, i) => (
                        <PopButton
                            key={i}
                            containerStyle={styles.dayBox}
                            style={[styles.day, days[i] && styles.dayOn]}
                            depth={3}
                            haptic="selection"
                            onPress={() => setDays(d => d.map((on, j) => (j === i ? !on : on)))}
                            accessibilityLabel={strings().days.short[i]}
                            accessibilityState={{ selected: days[i] }}
                        >
                            <Text style={[styles.dayText, days[i] && styles.dayTextOn]}>{letter}</Text>
                        </PopButton>
                    ))}
                </View>
                <Text style={styles.repeat}>{repeatText(days)}</Text>

                <View style={styles.tiles}>
                    <PopButton
                        containerStyle={styles.tileBox}
                        style={styles.tile}
                        haptic="selection"
                        onPress={cycleSteps}
                        accessibilityLabel={`${t('edit.walkTile')}, ${t('edit.stepsValue', { count: steps })}`}
                        accessibilityHint={t('edit.tileHint')}
                    >
                        <Text style={styles.tileLabel}>1. {t('edit.walkTile')}</Text>
                        <Text style={styles.tileValue}>{t('edit.stepsValue', { count: steps })}</Text>
                    </PopButton>
                    <PopButton
                        containerStyle={styles.tileBox}
                        style={[styles.tile, styles.tileSun]}
                        haptic="selection"
                        onPress={cycleMath}
                        accessibilityLabel={`${t('edit.mathTile')}, ${t(`edit.mathLevel_${mathLevel}`)}`}
                        accessibilityHint={t('edit.tileHint')}
                    >
                        <Text style={[styles.tileLabel, styles.tileLabelSun]}>2. {t('edit.mathTile')}</Text>
                        <Text style={styles.tileValue}>{t(`edit.mathLevel_${mathLevel}`)}</Text>
                    </PopButton>
                </View>

                <PopView style={styles.settings} containerStyle={styles.settingsBox}>
                    <View style={styles.row}>
                        <Text style={styles.rowTitle}>{t('edit.label')}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={t('edit.labelPlaceholder')}
                            placeholderTextColor={Pop.faint}
                            value={label}
                            onChangeText={setLabel}
                            maxLength={16}
                            accessibilityLabel={t('edit.label')}
                        />
                    </View>
                    <View style={styles.rule} />
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>{t('edit.wakeCheck')}</Text>
                            <Text style={styles.rowHint}>{t('edit.wakeCheckHint')}</Text>
                        </View>
                        <PopSwitch value={wakeCheck} onValueChange={setWakeCheck} accessibilityLabel={t('edit.wakeCheck')} />
                    </View>
                    <View style={styles.rule} />
                    <View style={styles.row}>
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>{t('edit.gradualVolume')}</Text>
                            <Text style={styles.rowHint}>{t('edit.gradualVolumeHint')}</Text>
                        </View>
                        <PopSwitch value={gradualVolume} onValueChange={setGradualVolume} accessibilityLabel={t('edit.gradualVolume')} />
                    </View>
                    <View style={styles.rule} />
                    <Pressable
                        style={styles.row}
                        onPress={() => router.push({ pathname: '/alarm/sounds', params: { currentSoundId: soundId } })}
                        accessibilityRole="button"
                    >
                        <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>{t('edit.sound')}</Text>
                            <Text style={styles.rowHint} numberOfLines={1}>{getSoundName(soundId)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={Pop.ink} />
                    </Pressable>
                </PopView>

                {!isNew && (
                    <Pressable style={styles.delete} onPress={handleDelete} accessibilityRole="button" hitSlop={8}>
                        <Ionicons name="trash-outline" size={18} color={Pop.danger} />
                        <Text style={styles.deleteText}>{t('edit.delete')}</Text>
                    </Pressable>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: Pop.paper },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, gap: 12 },
    pill: { height: 40, borderRadius: 999, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
    pillText: { fontFamily: PopFont.bold, fontSize: 15, color: Pop.ink },
    save: { backgroundColor: Pop.blue },
    saveText: { color: Pop.white, fontFamily: PopFont.heavy },
    title: { flex: 1, textAlign: 'center', fontFamily: PopFont.heavy, fontSize: 17, color: Pop.ink },
    content: { paddingHorizontal: 20, paddingTop: 14 },

    timeBlock: { minHeight: 120, gap: 4, paddingRight: 120, marginBottom: 6 },
    timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    time: { fontFamily: PopFont.heavy, fontSize: 72, lineHeight: 76, letterSpacing: -3.2, color: Pop.ink, fontVariant: ['tabular-nums'] },
    ap: { fontFamily: PopFont.heavy, fontSize: 20, color: Pop.ink },
    ringsIn: { fontFamily: PopFont.heavy, fontSize: 15, color: Pop.ink },
    bed: { fontFamily: PopFont.semibold, fontSize: 13, color: Pop.sub },
    wakey: { position: 'absolute', right: 0, bottom: -26 },

    days: { flexDirection: 'row', gap: 6, marginTop: 18 },
    dayBox: { flex: 1 },
    day: { height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    dayOn: { backgroundColor: Pop.blue },
    dayText: { fontFamily: PopFont.heavy, fontSize: 15, color: Pop.ink },
    dayTextOn: { color: Pop.white },
    repeat: { marginTop: 6, fontFamily: PopFont.semibold, fontSize: 13, color: Pop.sub, textAlign: 'center' },

    tiles: { flexDirection: 'row', gap: 12, marginTop: 16 },
    tileBox: { flex: 1 },
    tile: { height: 84, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'space-between' },
    tileSun: { backgroundColor: Pop.sun },
    tileLabel: { fontFamily: PopFont.bold, fontSize: 12, color: Pop.sub },
    tileLabelSun: { color: Pop.ink },
    tileValue: { fontFamily: PopFont.heavy, fontSize: 22, letterSpacing: -0.4, color: Pop.ink },

    settingsBox: { marginTop: 16 },
    settings: { borderRadius: 22, paddingHorizontal: 16 },
    row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { fontFamily: PopFont.heavy, fontSize: 15, color: Pop.ink },
    rowHint: { fontFamily: PopFont.semibold, fontSize: 12, lineHeight: 16, color: Pop.sub },
    rule: { height: 1.5, backgroundColor: '#E3E7EF' },
    input: { flex: 1, textAlign: 'right', fontFamily: PopFont.semibold, fontSize: 15, color: Pop.ink, paddingVertical: 0 },

    delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 20 },
    deleteText: { fontFamily: PopFont.bold, fontSize: 15, color: Pop.danger },
});
