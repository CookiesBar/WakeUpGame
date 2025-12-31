# Troubleshooting RevenueCat Error 23 (ConfigurationError)

You are seeing **Error 23**: `PermissionsError` or `ConfigurationError`. This means the app cannot talk to the App Store or fetch products.

## 1. Are you on a Simulator?
**The Issue:** The iOS Simulator **cannot** fetch products or make purchases by default. It requires a special "StoreKit Configuration File".
**The Fix:**
- **Best Option:** Run on a specific physical iPhone/iPad.
  ```bash
  npx expo run:ios --device
  ```
- **Simulator Option:** You must create a `.storekit` file in Xcode (requires a Mac).

## 2. Check Bundle Identifier
Your app's Bundle ID must match **exactly** in 3 places:
1. `app.json` ("bundleIdentifier") -> `com.wakeupgame.app`
2. **RevenueCat Dashboard** (Project Settings > Apps)
3. **App Store Connect** (My Apps)

## 3. Check Agreements
1. Go to **App Store Connect** > **Agreements, Tax, and Banking**.
2. Make sure the **"Paid Apps"** agreement is "Active" (not "New" or "Pending").
3. If it is not active, Apple will return Error 23.

## 4. Check Product Identifiers
1. **RevenueCat**: Check the "Entitlements" and "Offerings".
2. **App Store Connect**: Check "In-App Purchases".
3. The **Product ID** (e.g., `premium_monthly`) must match perfectly.

## 5. Enable Debug Logs (Already Done)
I have enabled debug logs in your code. Re-run the app and look at the terminal for lines starting with `[Purchases]`. They will give a more specific error message from Apple.
