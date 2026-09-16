/**
 * i18n bootstrap. Add a new shipped language by dropping a `locales/<code>.ts`
 * file (same shape as `en.ts`) and adding its code to SUPPORTED_LOCALES —
 * everything else (detection, override, fallback) picks it up automatically.
 */
import { I18n } from 'i18n-js';

import de from './locales/de';
import en from './locales/en';
import es from './locales/es';
import sv from './locales/sv';

export const translations = { en, es, sv, de };

export const SUPPORTED_LOCALES = ['en', 'es', 'sv', 'de'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const i18n = new I18n(translations);
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

export type Translate = (key: string, options?: Record<string, unknown>) => string;

export function isSupportedLocale(code: string | null | undefined): code is SupportedLocale {
  return !!code && (SUPPORTED_LOCALES as readonly string[]).includes(code);
}
