/**
 * RevenueCat Integration Utility
 * Handles subscription management and paywall presentation
 */

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
        console.log('RevenueCat already configured');
        return;
    }

    try {
        // Only configure for iOS
        if (Platform.OS === 'ios') {
            await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG); // Enable debug logs
            await Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY });
            isConfigured = true;
            console.log('RevenueCat configured successfully');
        } else {
            console.log('RevenueCat: Skipping configuration for non-iOS platform');
        }
    } catch (error) {
        console.error('Failed to configure RevenueCat:', error);
    }
}

/**
 * Present the RevenueCat paywall
 * @returns true if user purchased or restored, false otherwise
 */
export async function presentPaywall(): Promise<boolean> {
    try {
        // Fetch the specific offering for "Wakey - Paywall"
        const offerings = await Purchases.getOfferings();
        const wakeyOffering = offerings.all[OFFERING_IDENTIFIER];

        const paywallOptions: { offering?: typeof wakeyOffering; displayCloseButton: boolean } = {
            displayCloseButton: false, // User cannot skip the paywall
        };

        if (wakeyOffering) {
            paywallOptions.offering = wakeyOffering;
            console.log('Using Wakey - Paywall offering:', OFFERING_IDENTIFIER);
        } else {
            console.log('Wakey offering not found, using default offering');
        }

        const result = await RevenueCatUI.presentPaywall(paywallOptions);

        console.log('Paywall result:', result);

        switch (result) {
            case PAYWALL_RESULT.PURCHASED:
                console.log('User purchased successfully');
                return true;
            case PAYWALL_RESULT.RESTORED:
                console.log('User restored purchases');
                return true;
            case PAYWALL_RESULT.NOT_PRESENTED:
                console.log('Paywall was not presented');
                return false;
            case PAYWALL_RESULT.ERROR:
                console.log('Paywall encountered an error');
                return false;
            case PAYWALL_RESULT.CANCELLED:
                console.log('User cancelled the paywall');
                return false;
            default:
                return false;
        }
    } catch (error) {
        console.error('Error presenting paywall:', error);
        return false;
    }
}

/**
 * Present paywall only if user doesn't have premium access
 * @returns true if user has access (either already had it or just purchased)
 */
export async function presentPaywallIfNeeded(): Promise<boolean> {
    try {
        // Fetch the specific offering for "Wakey - Paywall"
        const offerings = await Purchases.getOfferings();
        const wakeyOffering = offerings.all[OFFERING_IDENTIFIER];

        const paywallOptions: { offering?: typeof wakeyOffering; requiredEntitlementIdentifier: string; displayCloseButton: boolean } = {
            requiredEntitlementIdentifier: ENTITLEMENT_IDENTIFIER,
            displayCloseButton: false, // User cannot skip
        };

        if (wakeyOffering) {
            paywallOptions.offering = wakeyOffering;
            console.log('Using Wakey - Paywall offering:', OFFERING_IDENTIFIER);
        } else {
            console.log('Wakey offering not found, using default offering');
        }

        const result = await RevenueCatUI.presentPaywallIfNeeded(paywallOptions);

        return result === PAYWALL_RESULT.PURCHASED ||
            result === PAYWALL_RESULT.RESTORED ||
            result === PAYWALL_RESULT.NOT_PRESENTED; // Already has access
    } catch (error) {
        console.error('Error presenting paywall if needed:', error);
        return false;
    }
}

/**
 * Check if user has premium access
 * @returns true if user has active premium subscription
 */
export async function checkPremiumStatus(): Promise<boolean> {
    try {
        const customerInfo = await Purchases.getCustomerInfo();
        const hasPremium = customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER] !== undefined;
        console.log('Premium status:', hasPremium);
        return hasPremium;
    } catch (error) {
        console.error('Error checking premium status:', error);
        return false;
    }
}

/**
 * Restore previous purchases
 * @returns true if restoration was successful and user has premium
 */
export async function restorePurchases(): Promise<boolean> {
    try {
        const customerInfo = await Purchases.restorePurchases();
        const hasPremium = customerInfo.entitlements.active[ENTITLEMENT_IDENTIFIER] !== undefined;
        console.log('Restore purchases - Premium status:', hasPremium);
        return hasPremium;
    } catch (error) {
        console.error('Error restoring purchases:', error);
        return false;
    }
}
