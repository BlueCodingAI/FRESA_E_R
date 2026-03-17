import { DEFAULT_LOCALE, getLocaleFromCookieString, type Locale } from "@/lib/i18n";
import type { NextRequest } from "next/server";

export function getRequestLocale(request: NextRequest): Locale {
  try {
    const fromCookieStore = request.cookies.get("site-locale")?.value;
    if (fromCookieStore === "en" || fromCookieStore === "ru") return fromCookieStore;
  } catch {
    // ignore
  }
  const raw = request.headers.get("cookie");
  return getLocaleFromCookieString(raw);
}

export function pickLocalized<T extends { title?: string; titleRu?: string | null; content?: string; contentRu?: string | null }>(
  locale: Locale,
  obj: T
) {
  if (locale === "ru") {
    return {
      ...obj,
      title: obj.titleRu ?? obj.title,
      content: obj.contentRu ?? obj.content,
    };
  }
  return {
    ...obj,
    title: obj.title,
    content: obj.content,
  };
}

