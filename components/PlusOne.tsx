// +1: the streak celebration, shown over Home once the wake-up game is done (a dark see-through overlay).
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    ReduceMotion,
    cancelAnimation,
    runOnJS,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
    type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Wakey, { type Mood } from '@/components/Wakey';
import { CtaButton, Flame, WeekDots } from '@/components/white';
import { ARRIVE, FADE_MS, W, WFont } from '@/constants/white';
import { useLocale } from '@/contexts/LocaleContext';
import { sfx } from '@/utils/sfx';
import type { StreakInfo } from '@/utils/stats';

// The ring screen sets this as it hands back to Home; Home's next focus takes it and celebrates.
let pending = false;
export const markPlusOne = () => {
    pending = true;
};
export const takePlusOne = () => {
    const p = pending;
    pending = false;
    return p;
};

/** The timeline, ms after the overlay arrives. */
const T_WIN = { content: 900, card: 1700, fly: 2000, flyMs: 560 };
/** The centre flame, and the size of the flame in a week dot (WeekDots: 32 × 0.56). */
const BIG = 120;
const SLOT = 18;
const ROLL_H = 96;
const TRAVEL = Easing.bezier(0.77, 0, 0.175, 1);
const arrive = (ms: number) => ({ duration: ms, easing: ARRIVE });
const fadeUp = (v: SharedValue<number>) => () => {
    'worklet';
    return { opacity: v.value, transform: [{ translateY: 8 * (1 - v.value) }] };
};

/**
 * A flame catches in the centre; then Wakey cheers and the count rolls 11 → 12 with its +1; then the week card
 * arrives and the same flame travels into today's slot, which lights up with the fire sound.
 * Calm: no bounce, one glow, the flicker settles as it lands. The overlay fades in and out (also under Reduce Motion).
 */
export default function PlusOne({ info, onClose }: { info: StreakInfo; onClose: () => void }) {
    const { t } = useLocale();
    const insets = useSafeAreaInsets();
    const reduced = useReducedMotion();
    const [mood, setMood] = useState<Mood>('awake');
    const [lit, setLit] = useState(false);
    const [landed, setLanded] = useState(false);
    // Where the flame catches: the middle of the week card's spot, so it never covers the count.
    const [start, setStart] = useState<{ x: number; y: number } | null>(null);
    const pageRef = useRef<ComponentRef<typeof View>>(null);
    const cardRef = useRef<ComponentRef<typeof View>>(null);
    const dotRef = useRef<ComponentRef<typeof View>>(null);

    const shown = useSharedValue(0);
    const flameIn = useSharedValue(0);
    const flicker = useSharedValue(0);
    const fly = useSharedValue(0);
    const dx = useSharedValue(0);
    const dy = useSharedValue(0);
    const contentIn = useSharedValue(reduced ? 1 : 0);
    const cardIn = useSharedValue(reduced ? 1 : 0);
    const roll = useSharedValue(reduced ? 1 : 0);

    // The overlay fades in; the flame catches with it and flickers until it lands.
    useEffect(() => {
        shown.value = withTiming(1, { duration: FADE_MS, easing: ARRIVE, reduceMotion: ReduceMotion.Never });
        if (reduced) return;
        flameIn.value = withTiming(1, arrive(380));
        flicker.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false);
        return () => cancelAnimation(flicker);
    }, [reduced, shown, flameIn, flicker]);

    const light = useCallback(() => {
        setLanded(true);
        setLit(true);
        sfx('fire');
    }, []);

    useEffect(() => {
        if (reduced) {
            setMood('proud');
            const timer = setTimeout(light, 400);
            return () => clearTimeout(timer);
        }
        const timers = [
            setTimeout(() => {
                setMood('proud');
                contentIn.value = withTiming(1, arrive(250));
                roll.value = withTiming(1, arrive(600));
            }, T_WIN.content),
            setTimeout(() => {
                cardIn.value = withTiming(1, arrive(250));
            }, T_WIN.card),
            setTimeout(() => {
                // Fly from the centre to today's dot: measure both, then travel.
                pageRef.current?.measureInWindow((px, py) => {
                    dotRef.current?.measureInWindow((x, y, w, h) => {
                        if (!start) return light();
                        dx.value = x + w / 2 - px - start.x;
                        dy.value = y + h / 2 - py - start.y;
                        fly.value = withTiming(1, { duration: T_WIN.flyMs, easing: TRAVEL }, done => {
                            if (done) runOnJS(light)();
                        });
                    });
                });
            }, T_WIN.fly),
        ];
        return () => timers.forEach(clearTimeout);
    }, [reduced, start, light, contentIn, cardIn, roll, fly, dx, dy]);

    const close = () => {
        shown.value = withTiming(0, { duration: 200, easing: ARRIVE, reduceMotion: ReduceMotion.Never }, done => {
            if (done) runOnJS(onClose)();
        });
    };

    const overlay = useAnimatedStyle(() => ({ opacity: shown.value }));
    const flame = useAnimatedStyle(() => {
        const c = flicker.value * 2 * Math.PI;
        const calm = 1 - fly.value; // the flicker settles as it travels, so it lands still
        const size = 1 + (SLOT / BIG - 1) * fly.value;
        return {
            opacity: flameIn.value,
            transform: [
                { translateX: dx.value * fly.value },
                { translateY: dy.value * fly.value },
                { scale: (0.7 + 0.3 * flameIn.value) * size },
                { scaleY: 1 + calm * (0.05 * Math.sin(c) + 0.02 * Math.sin(3 * c)) },
                { rotate: calm * 2 * Math.sin(2 * c) + 'deg' },
            ],
        };
    });
    const content = useAnimatedStyle(fadeUp(contentIn));
    const card = useAnimatedStyle(fadeUp(cardIn));
    const rolling = useAnimatedStyle(() => ({ transform: [{ translateY: -ROLL_H * roll.value }] }));
    const plus = useAnimatedStyle(() => ({ opacity: roll.value, transform: [{ translateY: 12 * (1 - roll.value) }] }));
    const count = info.count;

    return (
        <Animated.View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom + 14 }, overlay]} accessibilityViewIsModal>
            <View ref={pageRef} collapsable={false} style={styles.flex}>
                <View style={styles.page}>
                    <Animated.View style={[styles.top, content]}>
                        <Wakey size={180} arms="cheer" mood={mood} wave={mood === 'proud' ? 1 : 0} accessibilityLabel={t('ring.win')} />
                        <View style={styles.odo} accessible accessibilityLabel={count + ' ' + t('ring.inARow')}>
                            <View>
                                <View style={styles.odoBox}>
                                    <Animated.View style={rolling}>
                                        <Text style={styles.odoNum}>{Math.max(0, count - 1)}</Text>
                                        <Text style={styles.odoNum}>{count}</Text>
                                    </Animated.View>
                                </View>
                                <Animated.Text style={[styles.plus, plus]}>+1</Animated.Text>
                            </View>
                            <Text style={styles.inARow}>{t('ring.inARow')}</Text>
                        </View>
                    </Animated.View>
                    <Animated.View style={[styles.stretch, card]}>
                        <View
                            ref={cardRef}
                            collapsable={false}
                            style={styles.weekCard}
                            onLayout={() =>
                                pageRef.current?.measureInWindow((px, py) =>
                                    cardRef.current?.measureInWindow((x, y, w, h) => setStart({ x: x + w / 2 - px, y: y + h / 2 - py })),
                                )
                            }
                        >
                            <WeekDots info={info} todayLit={lit} todayRef={dotRef} />
                        </View>
                        <Text style={styles.restNote}>{t('home.noRest')}</Text>
                    </Animated.View>
                    <View style={styles.flex} />
                    <Animated.View style={[styles.stretch, content]}>
                        <CtaButton label={t('ring.startDay')} onPress={close} />
                    </Animated.View>
                </View>
                {!reduced && !landed && start && (
                    <Animated.View pointerEvents="none" style={[styles.bigFlame, { left: start.x - BIG / 2, top: start.y - BIG / 2 }, flame]}>
                        <Flame size={BIG} />
                    </Animated.View>
                )}
            </View>
        </Animated.View>
    );
}

const ON_DARK = 'rgba(255,255,255,0.72)';

const styles = StyleSheet.create({
    // Black, see-through: Home shows behind it as a faint ghost (at 0.82 it fought with the count and the card).
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)' },
    flex: { flex: 1 },
    stretch: { alignSelf: 'stretch' },
    page: { flex: 1, paddingHorizontal: 20, paddingTop: 50, alignItems: 'center' },
    top: { alignItems: 'center' },
    bigFlame: { position: 'absolute', width: BIG, height: BIG },
    odo: { marginTop: 12, alignItems: 'center' },
    odoBox: { height: ROLL_H, overflow: 'hidden' },
    odoNum: { height: ROLL_H, fontFamily: WFont.bold, fontSize: 96, lineHeight: ROLL_H, letterSpacing: -4.3, color: W.paper, textAlign: 'center', fontVariant: ['tabular-nums'] },
    plus: {
        position: 'absolute',
        top: 8,
        left: '100%',
        marginLeft: 8,
        height: 28,
        paddingHorizontal: 10,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: W.sunSoft,
        color: W.sunText,
        fontFamily: WFont.bold,
        fontSize: 15,
        lineHeight: 28,
    },
    inARow: { fontFamily: WFont.semibold, fontSize: 20, lineHeight: 25, color: ON_DARK },
    weekCard: { alignSelf: 'stretch', marginTop: 28, backgroundColor: W.paper, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 18, gap: 16 },
    restNote: { marginTop: 14, fontFamily: WFont.medium, fontSize: 13, lineHeight: 18, color: ON_DARK, textAlign: 'center' },
});
