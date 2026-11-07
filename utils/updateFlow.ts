// What's New → review, once per major version (pure: no RN, so node can check it).

/** The major version last shown What's New (set at onboarding too, so fresh installs skip it). */
export const LAST_MAJOR_KEY = 'whatsNewMajor';
/** When the person last tapped "Rate Wakey" (ms); the review screen skips them for a year after. */
export const RATED_AT_KEY = 'reviewRatedAt';
export const RATE_COOLDOWN_MS = 365 * 24 * 60 * 60 * 1000;

export const major = (version?: string | null) => parseInt(version ?? '', 10) || 0;

/** Onboarded before this build and never shown this major: an update from an older major. */
export const whatsNewDue = (onboarded: boolean, lastShown: string | null, version?: string | null) =>
    onboarded && major(version) > (lastShown === null ? 0 : Number(lastShown));

export const reviewDue = (ratedAt: string | null, now: number) => ratedAt === null || now - Number(ratedAt) >= RATE_COOLDOWN_MS;
