/**
 * RevenueCat integration (iOS).
 *
 * PHASE 1: the SDK is configured at startup but the app is NOT gated — there is
 * no paywall presentation yet. The hard paywall is a later phase and will gate on
 * the `premium_access` entitlement via RevenueCatUI.presentPaywallIfNeeded (clean
 * entitlement-gated presentation), NOT an infinite re-present loop.
 */
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

const REVENUECAT_IOS_API_KEY = 'appl_scqLeeBOZfDbZLrUxqPmuoTQMHC';

/** Configured in the RevenueCat dashboard — used by the deferred paywall phase. */
export const ENTITLEMENT_IDENTIFIER = 'premium_access';
export const OFFERING_IDENTIFIER = 'ofrng9f389105cf';

let isConfigured = false;

export async function configureRevenueCat(): Promise<void> {
  if (isConfigured) return;
  if (Platform.OS !== 'ios') return;

  try {
    await Purchases.configure({ apiKey: REVENUECAT_IOS_API_KEY });
    isConfigured = true;
  } catch (err) {
    console.error('configureRevenueCat failed:', err);
  }
}

export async function checkPremiumStatus(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_IDENTIFIER] !== undefined;
  } catch (err) {
    console.error('checkPremiumStatus failed:', err);
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_IDENTIFIER] !== undefined;
  } catch (err) {
    console.error('restorePurchases failed:', err);
    return false;
  }
}
