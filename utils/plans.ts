// Paywall math from the live store prices: nothing here is a hard-coded price.

/** Whole-percent saving of yearly over 52 weeks of weekly, rounded down so it never overstates; 0 if not cheaper. */
export const yearlySaving = (yearly: number, weekly: number): number =>
  weekly > 0 ? Math.max(0, Math.floor((1 - yearly / (weekly * 52)) * 100)) : 0;

/** The yearly price spread over 12 months, in the store's currency. */
export const perMonth = (yearly: number, currency: string, locale?: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(yearly / 12);
