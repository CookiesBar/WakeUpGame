// Shared building blocks for the onboarding steps: calm staggered entrances, option cards, CTA.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect } from 'react';
import { ActivityIndicator, ScrollView, type StyleProp, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';

import Pressable from '@/components/Pressable';
import { BorderRadius, Colors, FontFamily, FontSize, Shadow, Spacing } from '@/constants/wakeyTheme';

/** Long, soft ease-out: quick start, gentle settle, no overshoot. */
export const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** Staggered entrance: fade + 10 px lift. Reanimated skips it under Reduce Motion. */
export const enter = (i = 0) => () => {
    'worklet';
    const timing = { duration: 380, easing: ease };
    const delay = 60 + i * 70;
    return {
        initialValues: { opacity: 0, transform: [{ translateY: 10 }] },
        animations: {
            opacity: withDelay(delay, withTiming(1, timing)),
            transform: [{ translateY: withDelay(delay, withTiming(0, timing)) }],
        },
    };
};

/** 0 → `to` once on mount, for chart bars and timeline lines. */
export function useGrow(to: number, delay = 0, duration = 700) {
    const v = useSharedValue(0);
    useEffect(() => {
        v.value = withDelay(delay, withTiming(to, { duration, easing: ease }));
    }, [to, delay, duration, v]);
    return v;
}

export const tap = () => Haptics.selectionAsync().catch(() => {});

/** One step: scrollable content above a pinned footer. */
export function Page({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
    return (
        <View style={styles.page}>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {children}
            </ScrollView>
            {footer && <View style={styles.footer}>{footer}</View>}
        </View>
    );
}

export function Title({ title, sub }: { title: string; sub?: string }) {
    return (
        <View style={styles.titleBox}>
            <Animated.Text entering={enter(0)} style={styles.title} accessibilityRole="header">
                {title}
            </Animated.Text>
            {sub ? (
                <Animated.Text entering={enter(1)} style={styles.sub}>
                    {sub}
                </Animated.Text>
            ) : null}
        </View>
    );
}

type OptionProps = {
    label: string;
    note?: string;
    emoji?: string;
    badge?: string;
    selected: boolean;
    multi?: boolean;
    index: number;
    onPress: () => void;
    right?: ReactNode;
};

export function Option({ label, note, emoji, badge, selected, multi, index, onPress, right }: OptionProps) {
    return (
        <Animated.View entering={enter(index + 2)}>
            <Pressable
                onPress={() => {
                    tap();
                    onPress();
                }}
                style={[styles.option, selected && styles.optionOn]}
                accessibilityRole={multi ? 'checkbox' : 'radio'}
                accessibilityState={multi ? { checked: selected } : { selected }}
            >
                {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
                <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelOn]}>{label}</Text>
                    {note ? <Text style={styles.optionNote}>{note}</Text> : null}
                </View>
                {badge ? <Text style={styles.badge}>{badge}</Text> : null}
                {right ?? (
                    <View style={[multi ? styles.box : styles.radio, selected && styles.markOn]}>
                        {selected && (
                            <Animated.View entering={FadeIn.duration(150)}>
                                <Ionicons name="checkmark" size={15} color={Colors.white} />
                            </Animated.View>
                        )}
                    </View>
                )}
            </Pressable>
        </Animated.View>
    );
}

export function Cta({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={[styles.cta, (disabled || loading) && styles.ctaOff]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!disabled, busy: !!loading }}
        >
            {loading && <ActivityIndicator color={Colors.white} />}
            <Text style={styles.ctaText}>{label}</Text>
        </Pressable>
    );
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <Pressable onPress={onPress} style={styles.textButton} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.textButtonText}>{label}</Text>
        </Pressable>
    );
}

export const styles = StyleSheet.create({
    page: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    scroll: { flexGrow: 1, paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
    footer: { paddingHorizontal: Spacing.xxl, paddingBottom: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm },

    titleBox: { marginBottom: Spacing.xxl, gap: Spacing.sm },
    title: {
        fontFamily: FontFamily.displayBold,
        fontSize: 30,
        lineHeight: 36,
        letterSpacing: -0.8,
        color: Colors.ink900,
    },
    sub: { fontFamily: FontFamily.body, fontSize: FontSize.md, lineHeight: 23, color: Colors.ink500 },

    option: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        minHeight: 64,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        marginBottom: Spacing.sm + 2,
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
        borderColor: Colors.ink100,
        backgroundColor: Colors.white,
        ...Shadow.sm,
    },
    optionOn: { borderColor: Colors.primary, backgroundColor: Colors.blue50 },
    emoji: { fontSize: 24 },
    optionText: { flex: 1, gap: 2 },
    optionLabel: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.ink900 },
    optionLabelOn: { color: Colors.blue700 },
    optionNote: { fontFamily: FontFamily.body, fontSize: FontSize.sm, color: Colors.ink500 },
    badge: {
        fontFamily: FontFamily.bodyBlack,
        fontSize: 11,
        color: Colors.onAccent,
        backgroundColor: Colors.accent,
        overflow: 'hidden',
        borderRadius: BorderRadius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    radio: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: Colors.ink200,
        alignItems: 'center',
        justifyContent: 'center',
    },
    box: {
        width: 24,
        height: 24,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: Colors.ink200,
        alignItems: 'center',
        justifyContent: 'center',
    },
    markOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },

    cta: {
        height: 58,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.primary,
        flexDirection: 'row',
        gap: Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        ...Shadow.blue,
    },
    ctaOff: { opacity: 0.4 },
    ctaText: { fontFamily: FontFamily.bodyBlack, fontSize: FontSize.lg, color: Colors.white, letterSpacing: -0.2 },
    textButton: { alignSelf: 'center', paddingVertical: Spacing.sm },
    textButtonText: { fontFamily: FontFamily.bodyBold, fontSize: FontSize.md, color: Colors.ink500 },
});

/** A bar that grows from 0 to `to` (0–1) of its track, once on mount. */
export function Grow({ to, delay = 0, axis = 'width', style }: { to: number; delay?: number; axis?: 'width' | 'height'; style?: StyleProp<ViewStyle> }) {
    const v = useGrow(to, delay);
    const grow = useAnimatedStyle(() => (axis === 'width' ? { width: `${v.value * 100}%` } : { height: `${v.value * 100}%` }));
    return <Animated.View style={[style, grow]} />;
}
