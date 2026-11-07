// The v3 paywall (canvas "Paywall v3", option C): a night-to-morning scene with Wakey on top, then a grouped list
// of plans. Drawn inside the app's own full-screen view. Only the first paywall a person sees has an X; after that the plans
// (or Restore) are the only way on. Prices come live from the RevenueCat offering. No free trial is offered.
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import DayNight from '@/components/DayNight';
import { CtaButton, Tap, rise } from '@/components/white';
import { PRIVACY_URL, TERMS_URL } from '@/constants/legal';
import { W, WFont } from '@/constants/white';
import { useLocale } from '@/contexts/LocaleContext';
import { posthog } from '@/utils/analytics';
import { perMonth, yearlySaving } from '@/utils/plans';
import { buy, loadPlans, markPaywallSeen, paywallClosable, restore, type Plans } from '@/utils/revenueCat';

type Pick = 'yearly' | 'lifetime' | 'weekly';
const ORDER: Pick[] = ['yearly', 'lifetime', 'weekly'];

/** Dev builds where RevenueCat can't load (web, Expo Go): the planned US prices, so the screen can be checked. */
const DEV_PLANS: Plans = {
    yearly: { price: 19.99, priceString: '$19.99', currencyCode: 'USD', pkg: null },
    lifetime: { price: 39.99, priceString: '$39.99', currencyCode: 'USD', pkg: null },
    weekly: { price: 1.99, priceString: '$1.99', currencyCode: 'USD', pkg: null },
};

export default function PaywallGate({ onUnlocked }: { onUnlocked: () => void }) {
    const { t } = useLocale();
    const { height } = useWindowDimensions();
    const sceneH = Math.round(Math.min(210, Math.max(150, height * 0.25)));
    const [plans, setPlans] = useState<Plans | null>(); // undefined = loading, null = couldn't load
    const [closable, setClosable] = useState(false);
    const [pick, setPick] = useState<Pick>('yearly');
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        setPlans(undefined);
        loadPlans().then(p => setPlans(p ?? (__DEV__ ? DEV_PLANS : null)));
    }, []);
    useEffect(() => {
        load();
        paywallClosable().then(first => {
            const canClose = __DEV__ || first;
            setClosable(canClose);
            markPaywallSeen();
            posthog.capture('paywall_viewed', { closable: canClose });
        });
    }, [load]);

    const chosen = plans?.[pick] ? pick : ORDER.find(k => plans?.[k]);
    const plan = chosen && plans?.[chosen];

    const choose = (k: Pick) => {
        Haptics.selectionAsync().catch(() => {});
        setPick(k);
    };
    const purchase = async () => {
        if (!plan || !chosen || busy) return;
        const props = { plan: chosen };
        if (!plan.pkg) return onUnlocked(); // dev stand-in: nothing to buy
        setBusy(true);
        try {
            if (await buy(plan.pkg)) {
                posthog.capture('purchase_completed', props);
                onUnlocked();
            }
        } catch {
            Alert.alert(t('paywall.failed'));
        } finally {
            setBusy(false);
        }
    };
    const onRestore = async () => {
        if (busy) return;
        setBusy(true);
        try {
            if (await restore()) {
                onUnlocked();
            } else Alert.alert(t('paywall.restoreNone'));
        } catch {
            Alert.alert(t('paywall.failed'));
        } finally {
            setBusy(false);
        }
    };
    const close = () => {
        posthog.capture('paywall_closed');
        onUnlocked();
    };
    const open = (url: string) => WebBrowser.openBrowserAsync(url).catch(() => {});

    const y = plans?.yearly, l = plans?.lifetime, w = plans?.weekly;
    const month = y ? perMonth(y.price, y.currencyCode) : '';
    const save = y && w ? yearlySaving(y.price, w.price) : 0;
    const cta = !plan ? t('paywall.ctaYearly')
        : chosen === 'yearly' ? t('paywall.ctaYearly')
        : chosen === 'lifetime' ? t('paywall.ctaLifetime', { price: plan.priceString })
        : t('paywall.ctaWeekly', { price: plan.priceString });
    const fine = !plan ? ''
        : chosen === 'yearly' ? t('paywall.fineYearly', { price: plan.priceString })
        : chosen === 'lifetime' ? t('paywall.fineLifetime')
        : t('paywall.fineWeekly');

    return (
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
            <View style={styles.header}>
                {closable ? (
                    <Tap style={styles.close} onPress={close} accessibilityLabel={t('paywall.close')} hitSlop={8}>
                        <Ionicons name="close" size={20} color={W.graphite} />
                    </Tap>
                ) : (
                    <View />
                )}
                <Tap style={styles.restore} onPress={onRestore} disabled={busy}>
                    <Text style={styles.restoreText}>{t('paywall.restore')}</Text>
                </Tap>
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                <Animated.View entering={rise()} style={styles.shell}>
                    <DayNight height={sceneH} accessibilityLabel={t('paywall.wakeyA11y')} />
                </Animated.View>
                <Animated.Text entering={rise(40)} style={styles.title} accessibilityRole="header">{t('paywall.title')}</Animated.Text>
                <Animated.Text entering={rise(80)} style={styles.sub}>{t('paywall.sub')}</Animated.Text>

                {plans === undefined ? (
                    <ActivityIndicator style={styles.loading} color={W.graphite} />
                ) : plans === null ? (
                    <View style={styles.offline}>
                        <Text style={styles.sub}>{t('paywall.offline')}</Text>
                        <Tap style={styles.retry} onPress={load}>
                            <Text style={styles.restoreText}>{t('paywall.retry')}</Text>
                        </Tap>
                    </View>
                ) : (
                    <Animated.View entering={rise(120)} style={styles.stage}>
                        <View style={styles.card}>
                            {y && (
                                <Row
                                    on={chosen === 'yearly'}
                                    onPress={() => choose('yearly')}
                                    first
                                    title={t('paywall.yearly')}
                                    badge={save > 0 ? t('paywall.save', { pct: save }) : undefined}
                                    sub={t('paywall.yearlyMonth', { month })}
                                    price={y.priceString}
                                    unit={t('paywall.perYear')}
                                />
                            )}
                            {l && (
                                <Row
                                    on={chosen === 'lifetime'}
                                    onPress={() => choose('lifetime')}
                                    first={!y}
                                    title={t('paywall.lifetime')}
                                    badge={t('paywall.payOnce')}
                                    outline
                                    sub={t('paywall.lifetimeSub')}
                                    price={l.priceString}
                                />
                            )}
                            {w && (
                                <Row
                                    on={chosen === 'weekly'}
                                    onPress={() => choose('weekly')}
                                    first={!y && !l}
                                    title={t('paywall.weekly')}
                                    price={w.priceString}
                                    unit={t('paywall.perWeek')}
                                    small
                                />
                            )}
                        </View>
                    </Animated.View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <CtaButton label={cta} onPress={purchase} disabled={!plan || busy} />
                {!!fine && <Text style={styles.fine}>{fine}</Text>}
                <Text style={styles.fine}>
                    <Text style={styles.link} onPress={() => open(TERMS_URL)} accessibilityRole="link">{t('legal.terms')}</Text>
                    {'  ·  '}
                    <Text style={styles.link} onPress={() => open(PRIVACY_URL)} accessibilityRole="link">{t('legal.privacy')}</Text>
                </Text>
            </View>
        </SafeAreaView>
    );
}

function Row({ on, first, onPress, title, badge, outline, sub, price, unit, small }: {
    on: boolean; first?: boolean; onPress: () => void; title: string; badge?: string; outline?: boolean; sub?: string; price: string; unit?: string; small?: boolean;
}) {
    return (
        <Tap
            style={[styles.row, first && styles.rowFirst, small && styles.rowSmall, on && styles.rowOn]}
            onPress={onPress}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
        >
            <View style={[styles.radio, on && styles.radioOn]}>{on && <View style={styles.dot} />}</View>
            <View style={styles.rowText}>
                <View style={styles.rowTitle}>
                    <Text style={[styles.name, small && styles.nameSmall]}>{title}</Text>
                    {!!badge && (
                        <View style={[styles.badge, outline && styles.badgeOutline]}>
                            <Text style={[styles.badgeText, outline && styles.badgeTextOutline]}>{badge}</Text>
                        </View>
                    )}
                </View>
                {!!sub && <Text style={styles.rowSub}>{sub}</Text>}
            </View>
            <Text style={[styles.price, small && styles.priceSmall]}>
                {price}
                {!!unit && <Text style={styles.unit}>{unit}</Text>}
            </Text>
        </Tap>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: W.mist },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 52 },
    close: { width: 36, height: 36, borderRadius: 18, backgroundColor: W.paper, alignItems: 'center', justifyContent: 'center' },
    restore: { height: 44, justifyContent: 'center', paddingHorizontal: 4 },
    restoreText: { fontFamily: WFont.semibold, fontSize: 15, color: W.blueText },
    body: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 },
    // Double bezel: the scene sits in a faint tray with one hairline, concentric radii (32 outside, 26 inside).
    shell: { marginBottom: 20, padding: 5, borderRadius: 32, backgroundColor: 'rgba(11,13,16,0.035)', borderWidth: 1, borderColor: W.hair },
    title: { fontFamily: WFont.heavy, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, color: W.ink },
    sub: { marginTop: 8, maxWidth: 300, fontFamily: WFont.medium, fontSize: 16, lineHeight: 23, color: W.graphite },
    loading: { marginTop: 80 },
    offline: { marginTop: 40, gap: 8 },
    retry: { alignSelf: 'flex-start', height: 44, justifyContent: 'center' },
    stage: { marginTop: 20 },
    card: { backgroundColor: W.paper, borderRadius: 24, borderWidth: 1, borderColor: W.hair, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: W.hair },
    rowFirst: { borderTopWidth: 0 },
    rowSmall: { paddingVertical: 12 },
    rowOn: { backgroundColor: W.blueSoft },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: W.chev, alignItems: 'center', justifyContent: 'center' },
    radioOn: { borderColor: W.blue },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: W.blue },
    rowText: { flex: 1, gap: 2 },
    rowTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    name: { fontFamily: WFont.bold, fontSize: 17, color: W.ink },
    nameSmall: { fontFamily: WFont.semibold, fontSize: 15, color: W.graphite },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: W.blue },
    badgeOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: W.ink, paddingVertical: 1 },
    badgeText: { fontFamily: WFont.bold, fontSize: 12, color: W.paper },
    badgeTextOutline: { color: W.ink },
    rowSub: { fontFamily: WFont.medium, fontSize: 13, lineHeight: 18, color: W.graphite },
    price: { fontFamily: WFont.bold, fontSize: 17, color: W.ink },
    priceSmall: { fontFamily: WFont.semibold, fontSize: 15, color: W.graphite },
    unit: { fontFamily: WFont.medium, fontSize: 13, color: W.graphite },
    footer: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, gap: 8 },
    fine: { textAlign: 'center', fontFamily: WFont.medium, fontSize: 13, lineHeight: 18, color: W.graphite },
    link: { color: W.blueText, fontFamily: WFont.semibold },
});
