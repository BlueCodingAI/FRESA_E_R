import { SITE_EN, SITE_RU } from "./site-messages";

export type Locale = "en" | "ru";

export const LOCALES: readonly Locale[] = ["en", "ru"] as const;
export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "site-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ru";
}

export function getLocaleFromCookieString(cookie: string | undefined | null): Locale {
  if (!cookie) return DEFAULT_LOCALE;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`));
  const raw = match?.[1];
  if (!raw) return DEFAULT_LOCALE;
  const decoded = decodeURIComponent(raw);
  return isLocale(decoded) ? decoded : DEFAULT_LOCALE;
}

function applyVars(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const en = SITE_EN[key];
  const ru = SITE_RU[key];
  let s: string | undefined =
    locale === "ru" ? ru || en : en || ru;
  if (s === undefined) s = key;
  return applyVars(s, vars);
}
