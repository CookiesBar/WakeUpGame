// Hard paywall drawn inside the app's own full-screen view, not a modal card: there's
// nothing to swipe away, so the RevenueCat design's buttons are the only way out.
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PurchasesOffering } from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import Mascot from '@/components/Mascot';
import { Cta, TextButton } from '@/components/onboarding/kit';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/wakeyTheme';
import { posthog } from '@/utils/analytics';
import { checkPremiumStatus, markOfferSeen, paywallSequence } from '@/utils/revenueCat';

export default function PaywallGate({ onUnlocked }: { onUnlocked: () => void }) {
    const [real, setReal] = useState(!__DEV__);
    if (!real) return <DevPaywall onClose={onUnlocked} onShowReal={() => setReal(true)} />;
    return <RealPaywall onUnlocked={onUnlocked} />;
}

function RealPaywall({ onUnlocked }: { onUnlocked: () => void }) {
    // undefined = loading; [] = no offerings (offline): the view falls back to the current offering
    const [sequence, setSequence] = useState<PurchasesOffering[]>();
    const [index, setIndex] = useState(0);
    useEffect(() => {
        paywallSequence().then(setSequence);
    }, []);

    const offering = sequence?.[index];
    const unlockIfPremium = async () => {
        if (await checkPremiumStatus()) onUnlocked();
    };
    // Only the closable copy and the offer have a close button; each leads one step on.
    const dismiss = () => {
        posthog.capture('paywall_closed', { offering: offering?.identifier ?? null });
        if (sequence && index < sequence.length - 1) {
            markOfferSeen();
            setIndex(index + 1);
        }
    };

    if (!sequence) return <View style={styles.fill} />;
    return (
        <RevenueCatUI.Paywall
            key={offering?.identifier ?? 'current'}
            style={styles.fill}
            options={{ offering }}
            onPurchaseCompleted={onUnlocked}
            onRestoreCompleted={unlockIfPremium}
            onDismiss={dismiss}
        />
    );
}

/** Dev builds only: a stand-in that can be closed, so the rest of the app can be tested. */
function DevPaywall({ onClose, onShowReal }: { onClose: () => void; onShowReal: () => void }) {
    return (
        <SafeAreaView style={[styles.fill, styles.dev]}>
            <View style={styles.devBody}>
                <Mascot mood="happy" size={170} />
                <Text style={styles.devTitle}>Your alarm is ready</Text>
                <Text style={styles.devNote}>Mock hard paywall (dev build only). Release builds show the RevenueCat paywall here, full screen.</Text>
            </View>
            <View style={styles.devFooter}>
                <Cta label="Close (dev)" onPress={onClose} />
                <TextButton label="Show the real paywall" onPress={onShowReal} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    fill: { flex: 1, backgroundColor: Colors.paper },
    dev: { justifyContent: 'space-between', padding: Spacing.xl },
    devBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
    devTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.h2, color: Colors.ink900, textAlign: 'center' },
    devNote: { fontFamily: FontFamily.body, fontSize: FontSize.sm, lineHeight: 20, color: Colors.ink500, textAlign: 'center' },
    devFooter: { gap: Spacing.sm },
});
