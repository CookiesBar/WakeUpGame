/**
 * RevenueCat Integration Utility
 * Handles subscription management and paywall presentation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants,{ ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import { posthog } from '@/utils/analytics';

// RevenueCat API Key for iOS
const REVENUECAT_IOS_API_KEY = 'appl_scqLeeBOZfDbZLrUxqPmuoTQMHC';

// Entitlement identifier configured in RevenueCat dashboard
const ENTITLEMENT_IDENTIFIER = 'premium_access';

// Main offering ("#1 Wakey Paywall"); the SDK keys offerings by identifier, not the REST id
const OFFERING_IDENTIFIER = 'default';

// The first paywall can be closed once; from then on it can't (the 1.0 pattern, best converting so far).
const PAYWALL_SEEN_KEY = '@paywall_v3_seen';

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

/** One plan as the paywall shows it. `pkg` is null only for the dev stand-in (web, Expo Go). */
export type Plan = { price: number; priceString: string; currencyCode: string; pkg: PurchasesPackage | null };
export type Plans = { yearly?: Plan; lifetime?: Plan; weekly?: Plan };

const plan = (pkg: PurchasesPackage | null | undefined): Plan | undefined =>
    pkg ? { price: pkg.product.price, priceString: pkg.product.priceString, currencyCode: pkg.product.currencyCode, pkg } : undefined;

/**
 * The main offering's yearly, lifetime and weekly packages with live prices. Null where RevenueCat isn't
 * set up or the offering can't load.
 */
export async function loadPlans(): Promise<Plans | null> {
    try {
        if (!(await ready())) return null;
        const { all, current } = await Purchases.getOfferings();
        const offering = all[OFFERING_IDENTIFIER] ?? current;
        if (!offering) return null;
        return { yearly: plan(offering.annual), lifetime: plan(offering.lifetime), weekly: plan(offering.weekly) };
    } catch (error) {
        console.error('Error loading plans:', error);
        return null;
    }
}

/** Buys a plan; true once premium is active, false if cancelled. Throws on a real failure. */
export async function buy(pkg: PurchasesPackage): Promise<boolean> {
    try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        return customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER] !== undefined;
    } catch (error: any) {
        if (error?.userCancelled) return false;
        throw error;
    }
}

/** Restores purchases; true when that brings premium back. */
export async function restore(): Promise<boolean> {
    if (!(await ready())) return false;
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_IDENTIFIER] !== undefined;
}

/** Only the first paywall a person sees has a close button. */
export const paywallClosable = async () => !(await AsyncStorage.getItem(PAYWALL_SEEN_KEY).catch(() => '1'));
export const markPaywallSeen = () => AsyncStorage.setItem(PAYWALL_SEEN_KEY, '1').catch(() => undefined);

// Hard paywall: true when the app should stay behind it. RevenueCat is only
// configured on iOS, and Expo Go only has its mock mode (nothing can be bought),
// so skip it there. Dev builds always show the closable mock, to test the flow.
export const needsPaywall = async (): Promise<boolean> => {
    if (__DEV__) return true;
    if (Platform.OS !== 'ios' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
    return !(await checkPremiumStatus());
};

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
