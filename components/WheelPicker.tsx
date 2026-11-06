// Apple-style drum picker: rows ride a cylinder (rotateX under perspective) and the centre row
// sits in a horizontal band the caller draws. Drag 1:1; a flick projects with Apple's scroll
// deceleration and a critically damped spring lands it on a row. One selection tick per row.
import { Colors, FontFamily } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    cancelAnimation,
    interpolateColor,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withSpring,
    type SharedValue,
} from 'react-native-reanimated';

const DECEL = 0.998; // UIScrollView normal rate
// response 0.35 s, damping ratio 1: lands without bounce.
const SPRING = { mass: 1, stiffness: (2 * Math.PI / 0.35) ** 2, damping: (4 * Math.PI) / 0.35 };

const mod = (a: number, n: number) => {
    'worklet';
    return ((a % n) + n) % n;
};

interface WheelPickerProps {
    data: string[];
    selectedIndex: number;
    onIndexChange: (index: number) => void;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
    /** Centre row colour, outer row colour. */
    colors?: readonly [string, string];
    infinite?: boolean;
    /** Value range of an infinite wheel when it is longer than `data` (a 12-row hour wheel spanning 24 h). */
    cycle?: number;
    itemHeight?: number;
    visibleItems?: number;
    accessibilityLabel?: string;
}

function Row({ i, n, infinite, pos, h, radius, step, text, textStyle, colors }: {
    i: number;
    n: number;
    infinite: boolean;
    pos: SharedValue<number>;
    h: number;
    radius: number;
    step: number;
    text: string;
    textStyle?: StyleProp<TextStyle>;
    colors: readonly [string, string];
}) {
    const style = useAnimatedStyle(() => {
        const d = infinite ? mod(i - pos.value + n / 2, n) - n / 2 : i - pos.value;
        const a = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * step));
        return {
            opacity: Math.abs(a) >= Math.PI / 2 ? 0 : 0.35 + 0.65 * Math.cos(a),
            color: interpolateColor(Math.min(1, Math.abs(d)), [0, 1], colors as [string, string]),
            transform: [{ perspective: 700 }, { translateY: radius * Math.sin(a) }, { rotateX: `${-a}rad` }],
        };
    });
    return (
        <Animated.Text style={[styles.row, { top: radius - h / 2, height: h, lineHeight: h }, textStyle, style]} numberOfLines={1}>
            {text}
        </Animated.Text>
    );
}

export default function WheelPicker({
    data,
    selectedIndex,
    onIndexChange,
    style,
    textStyle,
    colors = ['#000000', Colors.textMuted],
    infinite = true,
    cycle,
    itemHeight = 44,
    visibleItems = 5,
    accessibilityLabel,
}: WheelPickerProps) {
    const reduced = useReducedMotion();
    const n = data.length;
    const span = infinite ? cycle ?? n : n;
    const height = itemHeight * visibleItems;
    const radius = height / 2; // ±90° reaches the edges, so about 7 rows show, the outer ones squeezed
    const step = itemHeight / radius;

    const pos = useSharedValue(selectedIndex);
    const start = useSharedValue(selectedIndex);
    const emitted = useRef(selectedIndex);
    // True from touch-down until the landing spring settles.
    const moving = useSharedValue(false);

    // The parent moved the value (not an echo of our own emit): jump to the nearest equivalent row.
    // While the wheel moves, every prop change is a late echo of one of our own emits: a hard flick
    // emits faster than React renders, and treating a stale echo as a move cancelled the spin.
    useEffect(() => {
        if (moving.value || selectedIndex === emitted.current) return;
        emitted.current = selectedIndex;
        cancelAnimation(pos);
        const here = Math.round(pos.value);
        pos.value = infinite ? here + mod(selectedIndex - here + span / 2, span) - span / 2 : selectedIndex;
    }, [selectedIndex, infinite, span, pos]);

    const tickAt = useRef(0);
    const changed = useCallback((index: number) => {
        const now = Date.now();
        if (now - tickAt.current > 30) {
            tickAt.current = now;
            Haptics.selectionAsync().catch(() => {});
        }
        emitted.current = index;
        onIndexChange(index);
    }, [onIndexChange]);

    useAnimatedReaction(
        () => (infinite ? mod(Math.round(pos.value), span) : Math.max(0, Math.min(n - 1, Math.round(pos.value)))),
        (cur, prev) => {
            if (prev !== null && cur !== prev) runOnJS(changed)(cur);
        },
    );

    const land = (target: number, velocity = 0) => {
        'worklet';
        const t = infinite ? target : Math.max(0, Math.min(n - 1, target));
        if (reduced) {
            pos.value = t;
            moving.value = false;
            return;
        }
        moving.value = true;
        pos.value = withSpring(t, { ...SPRING, velocity }, finished => {
            if (finished) moving.value = false;
        });
    };

    const pan = Gesture.Pan()
        .activeOffsetY([-5, 5])
        .onBegin(() => {
            moving.value = true;
            cancelAnimation(pos); // grab it mid-spin
        })
        .onStart(() => {
            start.value = pos.value;
        })
        .onUpdate(e => {
            let p = start.value - e.translationY / itemHeight;
            if (!infinite) {
                if (p < 0) p *= 0.3; // rubber band past the ends
                else if (p > n - 1) p = n - 1 + (p - n + 1) * 0.3;
            }
            pos.value = p;
        })
        .onEnd(e => {
            const v = -e.velocityY / itemHeight; // rows per second
            land(Math.round(pos.value + ((v / 1000) * DECEL) / (1 - DECEL)), v);
        })
        .onFinalize((_, success) => {
            if (!success) land(Math.round(pos.value)); // a touch that never became a drag
        });

    const nudge = (delta: number) => {
        cancelAnimation(pos);
        land(Math.round(pos.value) + delta);
    };

    return (
        <GestureDetector gesture={pan}>
            <View
                style={[styles.container, { height }, style]}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel={accessibilityLabel}
                accessibilityValue={{ text: data[mod(selectedIndex, n)] }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                onAccessibilityAction={e => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
            >
                {data.map((text, i) => (
                    <Row
                        key={i}
                        i={i}
                        n={n}
                        infinite={infinite}
                        pos={pos}
                        h={itemHeight}
                        radius={radius}
                        step={step}
                        text={text}
                        textStyle={textStyle}
                        colors={colors}
                    />
                ))}
            </View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: { width: 100, overflow: 'hidden' },
    row: {
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        fontSize: 28,
        fontFamily: FontFamily.bold,
        fontVariant: ['tabular-nums'],
    },
});
