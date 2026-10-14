// Tiny i18n: nested string tables + `%{var}` interpolation, English fallback.
import de from './locales/de';
import en from './locales/en';
import es from './locales/es';
import sv from './locales/sv';

export const translations = { en, es, sv, de };

export const SUPPORTED_LOCALES = ['en', 'es', 'sv', 'de'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(code: string | null | undefined): code is SupportedLocale {
    return !!code && (SUPPORTED_LOCALES as readonly string[]).includes(code);
}

let current: SupportedLocale = 'en';
export const setLocale = (locale: SupportedLocale) => { current = locale; };

const lookup = (dict: unknown, key: string): unknown =>
    key.split('.').reduce<any>((node, part) => node?.[part], dict);

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export const t: Translate = (key, vars) => {
    const found = lookup(translations[current], key) ?? lookup(en, key);
    const text = typeof found === 'string' ? found : key;
    return vars ? text.replace(/%\{(\w+)\}/g, (_, name) => String(vars[name] ?? '')) : text;
};

// Arrays (weekday names etc.) for the current locale.
export const strings = () => translations[current];
