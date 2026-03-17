"use client";

import { DEFAULT_LOCALE, getLocaleFromCookieString, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export const SITE_LOCALE_EVENT = "site-locale-change";

export function getClientLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  return getLocaleFromCookieString(document.cookie);
}

export function setClientLocale(locale: Locale) {
  const oneYearSeconds = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${oneYearSeconds}; samesite=lax`;
  window.dispatchEvent(new CustomEvent(SITE_LOCALE_EVENT, { detail: locale }));
}

