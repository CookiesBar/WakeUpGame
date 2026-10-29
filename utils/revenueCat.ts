/**
 * RevenueCat Integration Utility
 * Handles subscription management and paywall presentation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants,{ ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { type PurchasesOffering } from 'react-native-purchases';

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
 * Offerings for the hard paywall, shown in order. Until the one-time offer has been seen:
 * the copy with an X ("closable"), then the offer ("winback"), then the main paywall
 * with no X. After that, only the main one. Empty where RevenueCat isn't set up.
 */
export async function paywallSequence(): Promise<PurchasesOffering[]> {
    try {
        if (!(await ready())) return [];
        const { all } = await Purchases.getOfferings();
        const offer = all[OFFER_OFFERING_IDENTIFIER];
        const closable = all[CLOSABLE_OFFERING_IDENTIFIER];
        const offerPending = !!offer && !!closable && !(await AsyncStorage.getItem(OFFER_SEEN_KEY));
        return (offerPending ? [closable, offer, all[OFFERING_IDENTIFIER]] : [all[OFFERING_IDENTIFIER]]).filter(Boolean);
    } catch (error) {
        console.error('Error loading paywall offerings:', error);
        return []; // offline: the paywall view falls back to the current offering
    }
}

// Hard paywall: true when the app should stay behind it. RevenueCat is only
// configured on iOS, and Expo Go only has its mock mode (nothing can be bought),
// so skip it there. Dev builds always show the closable mock, to test the flow.
export const needsPaywall = async (): Promise<boolean> => {
    if (__DEV__) return true;
    if (Platform.OS !== 'ios' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
    return !(await checkPremiumStatus());
};

/** PostHog experiment flag: 'early' shows the paywall right after the onboarding game. */
export const PAYWALL_POSITION_FLAG = 'onboarding-paywall-position';

export const markOfferSeen =() => AsyncStorage.setItem(OFFER_SEEN_KEY, '1').catch(() => undefined);

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
