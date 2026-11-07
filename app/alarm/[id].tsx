// Alarm editor (v3 white): a sheet of grouped settings. No Wakey here: the sheet is for settings.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TimeWheel from '@/components/TimeWheel';
import { WSwitch } from '@/components/white';
import { ARRIVE, W, WFont } from '@/constants/white';
import { useAlarms } from '@/contexts/AlarmContext';
import { useLocale } from '@/contexts/LocaleContext';
import { strings, t } from '@/i18n';
import { clockText, repeatText, uses24h } from '@/utils/clockFormat';
import { MathLevel } from '@/utils/math';
import { bedtimes } from '@/utils/sleepCycle';
import { DEFAULT_SOUND_ID, getSoundName, stopAlarmSound, takePickedSound } from '@/utils/sounds';
import { Alarm } from '@/utils/storage';
import { nextAlarmDate } from '@/utils/time';
import { DEFAULT_MATH_LEVEL, DEFAULT_STEPS, MATH_LEVELS, STEP_OPTIONS } from '@/utils/wakeCheck';


const tick = () => Haptics.selectionAsync().catch(() => {});

export default function AlarmEditScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const isNew = id === 'new';
    const { alarms, addAlarm, updateAlarm, removeAlarm } = useAlarms();
    useLocale(); // re-render on language change
    const insets = useSafeAreaInsets();

    // Form state, filled from the context on the first render.
    const [original] = useState<Alarm | null>(() => (isNew ? null : alarms.find(a => a.id === id) ?? null));
    const [mins, setMins] = useState(() => {
        if (!original) return 7 * 60;
        const [h, m] = original.time.split(':').map(Number);
        return h * 60 + m;
    });
    const [label, setLabel] = useState(original?.label ?? '');
    const [days, setDays] = useState<boolean[]>(original?.days ?? Array(7).fill(true)); // new alarms: every day
    const [wakeCheck, setWakeCheck] = useState(original?.wakeCheck !== false);
    const [gradualVolume, setGradualVolume] = useState(!!original?.gradualVolume);
    const [steps, setSteps] = useState<number>(original?.steps ?? DEFAULT_STEPS);
    const [mathLevel, setMathLevel] = useState<MathLevel>(original?.mathLevel ?? DEFAULT_MATH_LEVEL);
    const [soundId, setSoundId] = useState<string>(original?.soundUri || DEFAULT_SOUND_ID);

    // Build the time drums once the push has landed (fallback: 600 ms, past the system push).
    const navigation = useNavigation();
    const [arrived, setArrived] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setArrived(true), 600);
        const off = navigation.addListener('transitionEnd' as never, () => setArrived(true));
        return () => {
            clearTimeout(timer);
            off();
        };
    }, [navigation]);

    // Pick up the sound chosen on the sounds screen when we're back in focus
    useFocusEffect(useCallback(() => {
        const picked = takePickedSound();
        if (picked) setSoundId(picked);
    }, []));

    // The alarm is gone (deleted elsewhere): nothing to edit.
    useEffect(() => {
        if (!isNew && !original) router.back();
    }, [isNew, original]);

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

    if (!isNew && !original) return <View style={styles.screen} />;

    const at = nextAlarmDate(hours, minutes, days, new Date());
    const bed = bedtimes(at, new Date()).find(b => !b.passed);
    const bedLine = bed ? t('edit.bedByLine', { time: clockText(bed.at.getHours(), bed.at.getMinutes()), h: bed.cycles * 1.5 }) : null;
    const cycleSteps = () => setSteps(STEP_OPTIONS[(STEP_OPTIONS.indexOf(steps as (typeof STEP_OPTIONS)[number]) + 1) % STEP_OPTIONS.length]);
    const cycleMath = () => setMathLevel(MATH_LEVELS[(MATH_LEVELS.indexOf(mathLevel) + 1) % MATH_LEVELS.length]);

    return (
        <View style={[styles.screen, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Pressable style={styles.headerButton} onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
                    <Text style={styles.headerText}>{t('common.cancel')}</Text>
                </Pressable>
                <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
                    {isNew ? t('edit.addTitle') : t('edit.editTitle')}
                </Text>
                <Pressable style={styles.headerButton} onPress={handleSave} accessibilityRole="button" hitSlop={8}>
                    <Text style={[styles.headerText, styles.save]}>{t('common.save')}</Text>
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
                <TimeWheel minutes={mins} onChange={setMins} twelveHour={!uses24h()} accessibilityLabel={t('edit.wheelLabel')} ready={arrived} />
                <BedLine text={bedLine} />

                <Repeat days={days} onChange={setDays} />

                <View style={[styles.group, styles.gap]}>
                    <Row first icon="pricetag-outline" label={t('edit.label')}>
                        <TextInput
                            style={styles.input}
                            placeholder={t('edit.labelPlaceholder')}
                            placeholderTextColor={W.dim}
                            value={label}
                            onChangeText={setLabel}
                            maxLength={16}
                            accessibilityLabel={t('edit.label')}
                        />
                    </Row>
                </View>

                <Text style={styles.caption}>{t('edit.wakeTask')}</Text>
                <View style={styles.group}>
                    <Row first icon="walk-outline" label={t('edit.walkRow')} value={t('edit.stepsValue', { count: steps })} onPress={cycleSteps} />
                    <Row icon="calculator-outline" label={t('edit.mathRow')} value={t(`edit.mathLevel_${mathLevel}`)} onPress={cycleMath} />
                    <Row icon="eye-outline" label={t('edit.wakeCheck')}>
                        <WSwitch value={wakeCheck} onValueChange={setWakeCheck} accessibilityLabel={t('edit.wakeCheck')} />
                    </Row>
                </View>

                <Text style={styles.caption}>{t('edit.soundSection')}</Text>
                <View style={styles.group}>
                    <Row
                        first
                        icon="musical-notes-outline"
                        label={t('edit.sound')}
                        value={getSoundName(soundId)}
                        onPress={() => router.push({ pathname: '/alarm/sounds', params: { currentSoundId: soundId } })}
                    />
                    <Row icon="volume-medium-outline" label={t('edit.gentleStart')}>
                        <WSwitch value={gradualVolume} onValueChange={setGradualVolume} accessibilityLabel={t('edit.gradualVolumeHint')} />
                    </Row>
                </View>

                {!isNew && (
                    <Pressable style={styles.delete} onPress={handleDelete} accessibilityRole="button" hitSlop={8}>
                        <Text style={styles.deleteText}>{t('edit.delete')}</Text>
                    </Pressable>
                )}
            </ScrollView>
        </View>
    );
}

/** The Repeat card: the days text, then a tap target per weekday (Sunday first, like `days`). */
export function Repeat({ days, onChange }: { days: boolean[]; onChange: (days: boolean[]) => void }) {
    const { letter, short } = strings().days;
    return (
        <View style={styles.repeat}>
            <View style={styles.repeatTop}>
                <Text style={styles.label}>{t('edit.repeat')}</Text>
                <Text style={styles.value}>{repeatText(days)}</Text>
            </View>
            <View style={styles.days}>
                {letter.map((l, i) => (
                    <Pressable
                        key={i}
                        style={[styles.day, days[i] && styles.dayOn]}
                        onPress={() => {
                            tick();
                            onChange(days.map((on, j) => (j === i ? !on : on)));
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={short[i]}
                        accessibilityState={{ selected: days[i] }}
                    >
                        <Text style={[styles.dayText, days[i] && styles.dayTextOn]}>{l}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

/**
 * "Bed by 9:15 PM for 9 hours of sleep". Its slot is always there, so nothing below jumps;
 * when no bedtime is left tonight it fades out (keeping its last words while it goes) and back in.
 */
export function BedLine({ text }: { text: string | null }) {
    const last = useRef(text ?? '');
    if (text) last.current = text;
    const shown = useSharedValue(text ? 1 : 0);
    useEffect(() => {
        shown.value = withTiming(text ? 1 : 0, { duration: 200, easing: ARRIVE });
    }, [text, shown]);
    const fade = useAnimatedStyle(() => ({ opacity: shown.value }));
    return (
        <Animated.View style={[styles.bed, fade]} accessibilityElementsHidden={!text} importantForAccessibility={text ? 'auto' : 'no-hide-descendants'}>
            <Ionicons name="moon-outline" size={14} color={W.graphite} />
            <Text style={styles.footnote} numberOfLines={1}>{last.current}</Text>
        </Animated.View>
    );
}

/** A grouped-list row: blue icon tile, label, then a value with a chevron (tap cycles or opens) or a control. */
export function Row({ first, icon, label, value, onPress, children }: {
    first?: boolean;
    icon: ComponentProps<typeof Ionicons>['name'];
    label: string;
    value?: string;
    onPress?: () => void;
    children?: ReactNode;
}) {
    const body = (
        <View style={[styles.row, !first && styles.rule]}>
            <View style={styles.tile}>
                <Ionicons name={icon} size={18} color={W.blueText} />
            </View>
            <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
            {value !== undefined && (
                <View style={styles.valueRow}>
                    <Text style={styles.value} numberOfLines={1}>{value}</Text>
                    <Ionicons name="chevron-forward" size={16} color={W.chev} />
                </View>
            )}
            {children}
        </View>
    );
    if (!onPress) return <View style={styles.indent}>{body}</View>;
    return (
        <Pressable
            style={({ pressed }) => [styles.indent, pressed && styles.pressed]}
            onPress={() => {
                tick();
                onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${label}, ${value}`}
        >
            {body}
        </Pressable>
    );
}

/** Exported for screens built from the same parts (onboarding). */
export const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: W.mist },
    header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
    headerButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
    headerText: { fontFamily: WFont.medium, fontSize: 17, color: W.ink },
    save: { fontFamily: WFont.bold },
    title: { flex: 1, textAlign: 'center', fontFamily: WFont.semibold, fontSize: 17, lineHeight: 22, color: W.ink },
    content: { paddingHorizontal: 20, paddingTop: 8 },
    bed: { height: 18, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    footnote: { fontFamily: WFont.medium, fontSize: 13, lineHeight: 18, color: W.graphite, fontVariant: ['tabular-nums'] },

    repeat: { marginTop: 16, backgroundColor: W.paper, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
    repeatTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
    days: { flexDirection: 'row', justifyContent: 'space-between' },
    day: { width: 40, height: 40, borderRadius: 999, backgroundColor: W.mist, alignItems: 'center', justifyContent: 'center' },
    dayOn: { backgroundColor: W.blue },
    dayText: { fontFamily: WFont.bold, fontSize: 15, color: W.ink },
    dayTextOn: { color: W.paper },

    caption: { marginTop: 20, marginBottom: 8, paddingHorizontal: 20, fontFamily: WFont.semibold, fontSize: 13, lineHeight: 18, color: W.graphite },
    group: { backgroundColor: W.paper, borderRadius: 24, overflow: 'hidden' },
    gap: { marginTop: 16 },
    indent: { paddingLeft: 16 },
    pressed: { backgroundColor: W.hair },
    row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingRight: 16 },
    rule: { borderTopWidth: 1, borderTopColor: W.hair },
    tile: { width: 30, height: 30, borderRadius: 8, backgroundColor: W.blueSoft, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { flexGrow: 1, flexShrink: 1, fontFamily: WFont.medium, fontSize: 17, lineHeight: 22, color: W.ink },
    label: { fontFamily: WFont.medium, fontSize: 17, lineHeight: 22, color: W.ink },
    valueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
    value: { fontFamily: WFont.regular, fontSize: 17, lineHeight: 22, color: W.graphite, flexShrink: 1 },
    input: { flexGrow: 1, flexBasis: 0, minWidth: 0, textAlign: 'right', fontFamily: WFont.regular, fontSize: 17, color: W.ink, paddingVertical: 0 },

    delete: { alignItems: 'center', paddingVertical: 24 },
    deleteText: { fontFamily: WFont.semibold, fontSize: 17, color: W.red },
});
