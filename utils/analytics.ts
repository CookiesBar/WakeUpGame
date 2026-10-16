// PostHog product analytics + feature flags. Set EXPO_PUBLIC_POSTHOG_KEY (and
// EXPO_PUBLIC_POSTHOG_HOST for EU cloud) in .env; without a key nothing is sent.
import PostHog from 'posthog-react-native';

const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;

export const posthog = new PostHog(key || 'disabled', {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    disabled: !key || __DEV__,
    captureAppLifecycleEvents: true,
});
