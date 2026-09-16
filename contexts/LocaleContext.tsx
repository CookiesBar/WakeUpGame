import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { i18n, isSupportedLocale, SupportedLocale, Translate } from '@/i18n';

const LANGUAGE_KEY = '@wakeup_language';

/** 'system' auto-detects from the device; anything else is an explicit override. */
export type LanguagePref = 'system' | SupportedLocale;

/** First of the device's preferred languages that this app ships copy for, else English. */
function detectDeviceLocale(): SupportedLocale {
  for (const locale of Localization.getLocales()) {
    if (isSupportedLocale(locale.languageCode)) return locale.languageCode;
  }
  return 'en';
}

interface LocaleContextValue {
  /** The user's raw preference — 'system' or a locale they picked explicitly. */
  pref: LanguagePref;
  /** The locale actually in effect right now. */
  locale: SupportedLocale;
  setPref: (pref: LanguagePref) => void;
  t: Translate;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<LanguagePref>('system');

  // Load a saved override, if any. Defaults to 'system' (and therefore the
  // device's language) until this resolves, so there's no blank first frame.
  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY).then((saved) => {
      if (saved && (saved === 'system' || isSupportedLocale(saved))) {
        setPrefState(saved as LanguagePref);
      }
    });
  }, []);

  const locale = useMemo<SupportedLocale>(
    () => (pref === 'system' ? detectDeviceLocale() : pref),
    [pref]
  );

  // Keep the i18n-js singleton in sync every render (idempotent) rather than
  // in an effect, so the very first render already uses the right locale.
  i18n.locale = locale;

  const value = useMemo<LocaleContextValue>(
    () => ({
      pref,
      locale,
      setPref: (next) => {
        setPrefState(next);
        AsyncStorage.setItem(LANGUAGE_KEY, next).catch(() => {});
      },
      t: (key, options) => i18n.t(key, options),
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
