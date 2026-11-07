// After a major update (v3 white): What's New → "Enjoying Wakey?" (skipped for a year after a rating).
// What's New: a 3.0 eyebrow and title over soft colour, then a carousel of Liquid Glass feature cards (real glass on
// iOS 26 via components/Glass, a frosted white fallback elsewhere) that steps itself every 3.2 s until you swipe.
// Review: a gold laurel around five stars, then the 3.0 features as rows in one Liquid Glass card (the streak row
// uses the app's own Flame), a pill CTA with its icon in its own circle. Close sits top left. A selection haptic on taps.
// No reviews block: Wakey has too few real 5-star App Store reviews to quote yet (2026-11-07).
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as StoreReview from 'expo-store-review';
import { useEffect, useRef, useState, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import { BackHandler, Linking, Platform, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import Svg, { Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glass from '@/components/Glass';
import Wakey from '@/components/Wakey';
import { Flame, Tap } from '@/components/white';
import { W, WFont } from '@/constants/white';
import { useLocale } from '@/contexts/LocaleContext';
import { posthog } from '@/utils/analytics';
import { RATED_AT_KEY } from '@/utils/updateFlow';

const WRITE_REVIEW = Platform.OS === 'ios' ? 'itms-apps://apps.apple.com/app/id6757119095?action=write-review' : 'market://details?id=com.wakeupgame.app';
const FEEDBACK = 'mailto:tnkhoa9000@gmail.com';
type Icon = ComponentProps<typeof Ionicons>['name'];

const tick = () => Haptics.selectionAsync().catch(() => {});
const fade = (i: number) => FadeIn.duration(320).delay(60 * i);

export default function WhatsNew({ askReview, onDone }: { askReview: boolean; onDone: () => void }) {
    const { t } = useLocale();
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState<'new' | 'review'>('new');
    const [rated, setRated] = useState(false);

    const next = () => (step === 'new' && askReview ? setStep('review') : onDone());
    useEffect(() => {
        posthog.capture('whats_new_step_viewed', { step });
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            next();
            return true;
        });
        return () => sub.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step]);

    const rate = async () => {
        posthog.capture(rated ? 'review_write_tapped' : 'review_rate_tapped');
        if (rated) return Linking.openURL(WRITE_REVIEW).catch(() => {});
        setRated(true);
        await AsyncStorage.setItem(RATED_AT_KEY, String(Date.now())).catch(() => {});
        if (await StoreReview.isAvailableAsync().catch(() => false)) StoreReview.requestReview().catch(() => {});
    };

    const feedback = () => {
        posthog.capture('review_feedback_tapped');
        Linking.openURL(`${FEEDBACK}?subject=${encodeURIComponent(t('review.mailSubject'))}`).catch(() => {});
    };

    return (
        <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Backdrop />
            </View>
            <Animated.View key={step} exiting={FadeOut.duration(140)} style={s.body}>
                {step === 'new' ? (
                    <NewPage />
                ) : (
                    <>
                        <Animated.View entering={fade(0)} style={s.closeBar}>
                            <Tap
                                style={s.close}
                                onPress={() => {
                                    tick();
                                    onDone();
                                }}
                                accessibilityLabel={t('review.close')}
                                hitSlop={8}
                            >
                                <Ionicons name="close" size={22} color={W.ink} />
                            </Tap>
                        </Animated.View>
                        <ScrollView contentContainerStyle={s.center} showsVerticalScrollIndicator={false}>
                            <Animated.View entering={fade(1)}>
                                <LaurelStars />
                            </Animated.View>
                            <Animated.Text entering={fade(2)} style={[s.title, s.centerText]} accessibilityRole="header">
                                {t('review.title')}
                            </Animated.Text>
                            <Animated.Text entering={fade(3)} style={[s.lead, s.centerText]}>
                                {t('review.body')}
                            </Animated.Text>
                            <Animated.View entering={fade(4)} style={s.listWrap}>
                                <Glass glassEffectStyle="regular" style={s.list} fallback={s.glassFallback}>
                                    {FEATURES.map((f, i) => (
                                        <View key={f.key} style={[s.row, i > 0 && s.rowLine]}>
                                            <FeatureIcon f={f} size={40} />
                                            <Text style={s.rowText} numberOfLines={2}>
                                                {t(`whatsNew.${f.key}`)}
                                            </Text>
                                        </View>
                                    ))}
                                </Glass>
                            </Animated.View>
                        </ScrollView>
                    </>
                )}
            </Animated.View>

            <View style={s.footer}>
                {step === 'new' ? (
                    <Pill label={t('whatsNew.cta')} icon="arrow-forward" onPress={next} />
                ) : (
                    <>
                        <Pill label={rated ? t('review.write') : t('review.rate')} icon={rated ? 'create-outline' : 'star-outline'} onPress={rate} />
                        <Tap
                            style={s.textButton}
                            onPress={() => {
                                tick();
                                feedback();
                            }}
                            hitSlop={8}
                        >
                            <Ionicons name="mail-outline" size={17} color={W.graphite} />
                            <Text style={s.textButtonText}>{t('review.feedback')}</Text>
                        </Tap>
                    </>
                )}
            </View>
        </View>
    );
}

type Feature = { key: string; icon: Icon | 'wakey' | 'flame' };
const FEATURES: readonly Feature[] = [
    { key: 'wakey', icon: 'wakey' },
    { key: 'silent', icon: 'volume-high-outline' },
    { key: 'streak', icon: 'flame' },
    { key: 'more', icon: 'language-outline' },
];

/** A feature's mark: Wakey's head, the app's streak Flame on amber, or a blue line icon, in a soft circle. */
function FeatureIcon({ f, size }: { f: Feature; size: number }) {
    if (f.icon === 'wakey')
        return (
            <View style={[s.badge, { width: size, height: size }]}>
                <Wakey head size={Math.round(size * 0.9)} mood="happy" accessibilityLabel="Wakey" />
            </View>
        );
    const warm = f.icon === 'flame';
    return (
        <View style={[s.badge, { width: size, height: size }, warm && s.badgeWarm]}>
            {warm ? <Flame size={Math.round(size * 0.56)} /> : <Ionicons name={f.icon as Icon} size={Math.round(size * 0.47)} color={W.blueText} />}
        </View>
    );
}
const STEP_MS = 3200;
const PAUSE_MS = 6000; // after a swipe, the carousel waits this long before stepping again
const GAP = 12;

/** The title and the carousel (the soft colour behind the glass is drawn full-screen by WhatsNew). */
function NewPage() {
    const { t } = useLocale();
    return (
        <View style={s.flex}>
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                <Animated.View entering={fade(0)} style={s.head}>
                    <Eyebrow />
                    <Text style={[s.title, s.centerText]} accessibilityRole="header">{t('whatsNew.title')}</Text>
                </Animated.View>
                <Animated.View entering={fade(1)}>
                    <Carousel />
                </Animated.View>
            </ScrollView>
        </View>
    );
}

function Carousel() {
    const { t } = useLocale();
    const { width } = useWindowDimensions();
    const reduced = useReducedMotion();
    const cardW = Math.min(320, width - 72); // the next card peeks in
    const side = (width - cardW) / 2;
    const ref = useRef<ComponentRef<typeof ScrollView>>(null);
    const [index, setIndex] = useState(0);
    const [rearm, setRearm] = useState(0); // re-arms the timer after a pause
    const pausedUntil = useRef(0);

    // Steps itself (wrapping to the first), but waits after a swipe. Off under Reduce Motion.
    useEffect(() => {
        if (reduced) return;
        const wait = Math.max(STEP_MS, pausedUntil.current - Date.now());
        const timer = setTimeout(() => {
            if (Date.now() < pausedUntil.current) return setRearm(n => n + 1);
            const next = (index + 1) % FEATURES.length;
            ref.current?.scrollTo({ x: next * (cardW + GAP), animated: true });
            setIndex(next);
        }, wait);
        return () => clearTimeout(timer);
    }, [index, rearm, reduced, cardW]);

    const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (cardW + GAP)));

    return (
        <View>
            <ScrollView
                ref={ref}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={cardW + GAP}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: side, gap: GAP }}
                onScrollBeginDrag={() => (pausedUntil.current = Date.now() + PAUSE_MS)}
                onMomentumScrollEnd={settle}
            >
                {FEATURES.map(f => (
                    <Glass key={f.key} glassEffectStyle="regular" style={[s.glass, { width: cardW }]} fallback={s.glassFallback}>
                        <View style={s.art}>
                            {f.icon === 'wakey' ? <Wakey head size={92} mood="happy" accessibilityLabel="Wakey" /> : <FeatureIcon f={f} size={64} />}
                        </View>
                        <Text style={s.glassTitle}>{t(`whatsNew.${f.key}`)}</Text>
                        <Text style={s.glassSub}>{t(`whatsNew.${f.key}Body`)}</Text>
                    </Glass>
                ))}
            </ScrollView>
            <View style={s.dots} accessible accessibilityLabel={`${index + 1} / ${FEATURES.length}`}>
                {FEATURES.map((f, i) => (
                    <View key={f.key} style={[s.dot, i === index && s.dotOn]} />
                ))}
            </View>
        </View>
    );
}

/** Two big soft glows (Wakey Blue top left, sun lower right) on Mist. */
function Backdrop() {
    return (
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none">
            <Defs>
                <RadialGradient id="wnBlue" cx="12" cy="34" r="62" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor={W.blue} stopOpacity="0.34" />
                    <Stop offset="1" stopColor={W.blue} stopOpacity="0" />
                </RadialGradient>
                <RadialGradient id="wnSun" cx="92" cy="64" r="56" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor={W.sun} stopOpacity="0.34" />
                    <Stop offset="1" stopColor={W.sun} stopOpacity="0" />
                </RadialGradient>
            </Defs>
            <Rect width="100" height="100" fill="url(#wnBlue)" />
            <Rect width="100" height="100" fill="url(#wnSun)" />
        </Svg>
    );
}

// One laurel branch (the left; the right is its mirror): a stem curving up from the bottom centre, leaves
// in pairs along it (each 38° either side of the stem's direction), smaller toward the tip, one leaf on top. 60x100 box.
const STEM = 'M54 96 C30 88 12 66 14 8';
const bez = (t: number, p0: number, p1: number, p2: number, p3: number) => {
    const u = 1 - t;
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};
const tangent = (t: number, p0: number, p1: number, p2: number, p3: number) => {
    const u = 1 - t;
    return 3 * u * u * (p1 - p0) + 6 * u * t * (p2 - p1) + 3 * t * t * (p3 - p2);
};
const LEAVES = [
    ...Array.from({ length: 6 }, (_, i) => {
        const t = 0.12 + i * 0.15; // bottom to tip
        const dir = (Math.atan2(tangent(t, 96, 88, 66, 8), tangent(t, 54, 30, 12, 14)) * 180) / Math.PI;
        const at = { x: bez(t, 54, 30, 12, 14), y: bez(t, 96, 88, 66, 8), len: 19 - i * 1.4 };
        return [{ ...at, angle: dir - 38 }, { ...at, angle: dir + 38 }];
    }).flat(),
    { x: 14, y: 8, len: 12, angle: -90 },
];
const leaf = (l: number) => `M0 0 C${l * 0.3} ${-l * 0.4} ${l * 0.75} ${-l * 0.36} ${l} 0 C${l * 0.75} ${l * 0.36} ${l * 0.3} ${l * 0.4} 0 0Z`;

function Branch({ flip }: { flip?: boolean }) {
    return (
        <Svg width={62} height={98} viewBox="-4 -4 68 108" style={flip ? s.flip : undefined}>
            <Path d={STEM} stroke={LAUREL} strokeWidth={2.5} strokeLinecap="round" fill="none" />
            {LEAVES.map((l, i) => (
                <G key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.angle})`}>
                    <Path d={leaf(l.len)} fill={LAUREL} />
                </G>
            ))}
        </Svg>
    );
}

/** The award mark over "Enjoying Wakey?": five stars on a gentle arc inside a gold laurel. */
function LaurelStars() {
    return (
        <View style={s.laurel} accessible accessibilityLabel="5/5">
            <Branch />
            <View style={s.starRow}>
                {[0, 1, 2, 3, 4].map(i => (
                    <Ionicons key={i} name="star" size={[22, 27, 32, 27, 22][i]} color={W.sun} style={{ marginTop: [14, 4, 0, 4, 14][i] }} />
                ))}
            </View>
            <Branch flip />
        </View>
    );
}

/** Language-neutral tag over the title: a spark and the version. */
function Eyebrow() {
    return (
        <View style={s.eyebrow}>
            <Ionicons name="sparkles-outline" size={12} color={W.blueText} />
            <Text style={s.eyebrowText}>3.0</Text>
        </View>
    );
}

/** The pill CTA, its icon nested in its own circle flush with the right edge. */
function Pill({ label, icon, onPress }: { label: string; icon: Icon; onPress: () => void }) {
    return (
        <Tap
            style={s.pill}
            onPress={() => {
                tick();
                onPress();
            }}
        >
            <Text style={s.pillText}>{label}</Text>
            <View style={s.pillIcon}>
                <Ionicons name={icon} size={18} color={W.paper} />
            </View>
        </Tap>
    );
}

const LAUREL = '#E2A11B'; // a deeper gold than the stars, so the stars read first
const R = 28; // shell radius; core = R − padding
const PAD = 6;
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: W.mist },
    body: { flex: 1 },
    flex: { flex: 1 },
    scroll: { paddingTop: 40, paddingBottom: 24, flexGrow: 1, justifyContent: 'center' },
    head: { alignItems: 'center', paddingHorizontal: 28, marginBottom: 22 },
    glass: { borderRadius: 30, padding: 22, minHeight: 270, overflow: 'hidden' },
    glassFallback: { backgroundColor: 'rgba(255,255,255,0.62)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.95)' },
    art: { height: 110, justifyContent: 'center', marginBottom: 10 },
    badge: { borderRadius: 999, backgroundColor: W.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: W.hair, alignItems: 'center', justifyContent: 'center' },
    glassTitle: { fontFamily: WFont.heavy, fontSize: 24, lineHeight: 29, letterSpacing: -0.6, color: W.ink },
    glassSub: { fontFamily: WFont.regular, fontSize: 16, lineHeight: 23, color: W.graphite, marginTop: 6 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 18 },
    dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: 'rgba(11,13,16,0.16)' },
    dotOn: { width: 20, backgroundColor: W.ink },

    eyebrow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: W.blueSoft, marginBottom: 14 },
    eyebrowText: { fontFamily: WFont.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.6, color: W.blueText },
    title: { fontFamily: WFont.heavy, fontSize: 34, lineHeight: 38, letterSpacing: -1, color: W.ink, marginBottom: 12 },
    lead: { fontFamily: WFont.regular, fontSize: 17, lineHeight: 25, color: W.graphite, maxWidth: 300 },
    centerText: { textAlign: 'center' },

    shell: { padding: PAD, borderRadius: R, backgroundColor: 'rgba(11,13,16,0.035)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(11,13,16,0.06)' },
    core: { borderRadius: R - PAD, backgroundColor: W.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: W.hair },

    badgeWarm: { backgroundColor: W.sunSoft, borderColor: W.sunSoft },

    closeBar: { height: 56, paddingHorizontal: 16, alignItems: 'flex-start', justifyContent: 'center' },
    close: { width: 40, height: 40, borderRadius: 999, backgroundColor: W.paper, alignItems: 'center', justifyContent: 'center' },
    center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: 24 },
    laurel: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginBottom: 20 },
    starRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 2, paddingBottom: 40 },
    flip: { transform: [{ scaleX: -1 }] },
    listWrap: { alignSelf: 'stretch', marginTop: 26 },
    list: { borderRadius: 28, paddingHorizontal: 18, paddingVertical: 6, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 62, paddingVertical: 10 },
    rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(11,13,16,0.08)' },
    rowText: { flex: 1, fontFamily: WFont.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2, color: W.ink },

    footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 6 },
    pill: { height: 58, borderRadius: 999, backgroundColor: W.cta, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 64 },
    pillText: { fontFamily: WFont.bold, fontSize: 17, color: W.paper },
    pillIcon: { position: 'absolute', right: 8, width: 42, height: 42, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
    textButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12 },
    textButtonText: { fontFamily: WFont.semibold, fontSize: 16, color: W.graphite },
});
