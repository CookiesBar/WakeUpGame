import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { isSupportedLocale, matchLocale, setLocale, SupportedLocale, t, Translate } from '@/i18n';

const LANGUAGE_KEY = '@wakeup_language';

/** 'system' auto-detects from the device; anything else is an explicit override. */
export type LanguagePref = 'system' | SupportedLocale;

/** First of the device's preferred languages that this app ships copy for, else English. */
function detectDeviceLocale(): SupportedLocale {
    for (const locale of Localization.getLocales()) {
        const match = matchLocale(locale.languageCode);
        if (match) return match;
    }
    return 'en';
}

interface LocaleContextValue {
    pref: LanguagePref;
    locale: SupportedLocale;
    setPref: (pref: LanguagePref) => void;
    t: Translate;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
    const [pref, setPrefState] = useState<LanguagePref>('system');

    useEffect(() => {
        AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
            if (saved === 'system' || isSupportedLocale(saved)) setPrefState(saved);
        });
    }, []);

    const locale = useMemo<SupportedLocale>(
        () => (pref === 'system' ? detectDeviceLocale() : pref),
        [pref]
    );

    // Sync during render (idempotent) so the first frame already uses the right locale.
    setLocale(locale);

    const value = useMemo<LocaleContextValue>(
        () => ({
            pref,
            locale,
            setPref: (next) => {
                setPrefState(next);
                AsyncStorage.setItem(LANGUAGE_KEY, next).catch(() => {});
            },
            // New identity per locale so consumers re-render on a language change.
            t: (key, vars) => t(key, vars),
        }),
        [pref, locale]
    );

    return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
    const ctx = useContext(LocaleContext);
    if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
    return ctx;
}
