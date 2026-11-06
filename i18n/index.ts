// Tiny i18n: nested string tables + `%{var}` interpolation, English fallback.
import cs from './locales/cs';
import da from './locales/da';
import de from './locales/de';
import el from './locales/el';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import hu from './locales/hu';
import it from './locales/it';
import ja from './locales/ja';
import ko from './locales/ko';
import nb from './locales/nb';
import nl from './locales/nl';
import pl from './locales/pl';
import pt from './locales/pt';
import sk from './locales/sk';
import sv from './locales/sv';

export const translations = { en, cs, da, de, es, fr, it, hu, nl, nb, pl, pt, sk, sv, el, ja, ko };
export type SupportedLocale = keyof typeof translations;

/** In the language picker's order (iOS-style: Latin scripts A–Z, then Greek, then CJK), each in its own name. */
export const LANGUAGE_NAMES: Record<SupportedLocale, string> = {
    cs: 'Čeština',
    da: 'Dansk',
    de: 'Deutsch',
    en: 'English',
    es: 'Español',
    fr: 'Français',
    it: 'Italiano',
    hu: 'Magyar',
    nl: 'Nederlands',
    nb: 'Norsk',
    pl: 'Polski',
    pt: 'Português',
    sk: 'Slovenčina',
    sv: 'Svenska',
    el: 'Ελληνικά',
    ja: '日本語',
    ko: '한국어',
};
export const SUPPORTED_LOCALES = Object.keys(LANGUAGE_NAMES) as SupportedLocale[];

export function isSupportedLocale(code: string | null | undefined): code is SupportedLocale {
    return !!code && Object.prototype.hasOwnProperty.call(translations, code);
}

/** A device language code to ours: Norwegian comes as no / nb / nn. */
export const matchLocale = (code: string | null | undefined): SupportedLocale | null =>
    code === 'no' || code === 'nn' ? 'nb' : isSupportedLocale(code) ? code : null;

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
export const strings = (): typeof en => translations[current];
