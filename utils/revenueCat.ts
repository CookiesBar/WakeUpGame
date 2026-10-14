/**
 * RevenueCat Integration Utility
 * Handles subscription management and paywall presentation
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

// RevenueCat API Key for iOS
const REVENUECAT_IOS_API_KEY = 'appl_scqLeeBOZfDbZLrUxqPmuoTQMHC';

// Entitlement identifier configured in RevenueCat dashboard
const ENTITLEMENT_IDENTIFIER = 'premium_access';

// Offering identifier for "Wakey - Paywall"
const OFFERING_IDENTIFIER = 'ofrng9f389105cf';

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
        const result = await RevenueCatUI.presentPaywall({
            offering: offerings.all[OFFERING_IDENTIFIER],
            displayCloseButton: false, // User cannot skip the paywall
        });
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
