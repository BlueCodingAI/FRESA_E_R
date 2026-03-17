"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getClientLocale, setClientLocale, SITE_LOCALE_EVENT } from "@/lib/locale-client";
import { t as translate, type Locale } from "@/lib/i18n";

type TI18n = {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<TI18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(getClientLocale());
    setMounted(true);
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<Locale>;
      if (ce.detail === "en" || ce.detail === "ru") {
        setLocaleState(ce.detail);
        return;
      }
      setLocaleState(getClientLocale());
    };
    window.addEventListener(SITE_LOCALE_EVENT, onChange);
    return () => window.removeEventListener(SITE_LOCALE_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.lang = locale === "ru" ? "ru" : "en";
  }, [locale, mounted]);

  const setLocale = useCallback((next: Locale) => {
    setClientLocale(next);
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );

  const value = useMemo(() => ({ locale, t, setLocale }), [locale, t, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export default I18nProvider;

export function useI18n(): TI18n {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "en",
      t: (key: string, vars?: Record<string, string | number>) => translate("en", key, vars),
      setLocale: () => {},
    };
  }
  return ctx;
}
