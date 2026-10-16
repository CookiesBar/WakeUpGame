/**
 * RevenueCat Integration Utility
 * Handles subscription management and paywall presentation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants,{ ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

import { posthog } from '@/utils/analytics';

// RevenueCat API Key for iOS
const REVENUECAT_IOS_API_KEY = 'appl_scqLeeBOZfDbZLrUxqPmuoTQMHC';

// Entitlement identifier configured in RevenueCat dashboard
const ENTITLEMENT_IDENTIFIER = 'premium_access';

// Main offering ("#1 Wakey Paywall"); the SDK keys offerings by identifier, not the REST id
const OFFERING_IDENTIFIER = 'default';

// Same paywall plus a close button that leads to the one-time offer (offering "closable")
const CLOSABLE_OFFERING_IDENTIFIER = 'closable';

// One-time discounted offer shown when the main paywall is closed (RevenueCat offering "winback")
const OFFER_OFFERING_IDENTIFIER = 'winback';
const OFFER_SEEN_KEY = '@paywall_offer_seen';

let isConfigured = false;

/**
 * Configure RevenueCat SDK
 * Should be called once at app startup
 */
export async function configureRevenueCat(): Promise<void> {
    if (isConfigured) {
        return;
    }

    try {
        // Only configure for iOS. Expo Go rejects the real App Store key
        // (RevenueCat needs a Test Store key there), so purchases are off in Expo Go.
        if (Platform.OS === 'ios' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
            if (__DEV__) await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
            await Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY });
            isConfigured = true;
            // One id in both tools, so RevenueCat's PostHog integration lands trials and
            // purchases on the same person as their onboarding events.
            const appUserId = await Purchases.getAppUserID();
            posthog.identify(appUserId);
            await Purchases.setAttributes({ $posthogUserId: appUserId });
            console.log('RevenueCat configured successfully');
        } else {
            console.log('RevenueCat: skipped (not iOS, or running in Expo Go)');
        }
    } catch (error) {
        console.error('Failed to configure RevenueCat:', error);
    }
}

/** Configure on first use; false where RevenueCat isn't set up (non-iOS). */
const ready = async (): Promise<boolean> => {
    await configureRevenueCat();
    return isConfigured;
};

/**
 * Present the RevenueCat paywall
 * @returns true if user purchased or restored, false otherwise
 */
export async function presentPaywall(): Promise<boolean> {
    try {
        // The onboarding paywall runs before app start configures RevenueCat.
        if (!(await ready())) return false;
        // "Wakey - Paywall" offering; undefined falls back to the default offering
        const offerings = await Purchases.getOfferings();
        // Until the one-time offer has been shown, use the copy with an X; closing it opens
        // the offer. Otherwise use the main paywall with no X, so closing never just reopens
        // the same screen. The SDK adds an X unless told not to, and the hard-paywall loop
        // in _layout re-presented the closed main paywall every 3 s.
        const offer = offerings.all[OFFER_OFFERING_IDENTIFIER];
        const closable = offerings.all[CLOSABLE_OFFERING_IDENTIFIER];
        const offerPending = !!offer && !!closable && !(await AsyncStorage.getItem(OFFER_SEEN_KEY));
        let result = await RevenueCatUI.presentPaywall({
            offering: offerPending ? closable : offerings.all[OFFERING_IDENTIFIER],
            displayCloseButton: offerPending,
        });
        const sawOffer = offerPending && result === PAYWALL_RESULT.CANCELLED;
        if (sawOffer) {
            await AsyncStorage.setItem(OFFER_SEEN_KEY, '1');
            result = await RevenueCatUI.presentPaywall({ offering: offer });
        }
        posthog.capture('paywall_closed', { result, saw_offer: sawOffer });
        return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    } catch (error) {
        console.error('Error presenting paywall:', error);
        return false;
    }
}

/**
 * Check if user has premium access
 * @returns true if user has active premium subscription
 */
export async function checkPremiumStatus(): Promise<boolean> {
    try {
        if (!(await ready())) return false;
        const customerInfo = await Purchases.getCustomerInfo();
        const hasPremium = customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER] !== undefined;
        console.log('Premium status:', hasPremium);
        return hasPremium;
    } catch (error) {
        console.error('Error checking premium status:', error);
        return false;
    }
}

/** Opens the App Store's manage-subscriptions sheet. */
export const manageSubscription = () =>
    isConfigured ? Purchases.showManageSubscriptions().catch(() => {}) : undefined;
