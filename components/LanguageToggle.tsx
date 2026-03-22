"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { useI18n } from "@/components/I18nProvider";

/**
 * Single-button language toggle (EN ↔ RU). No dropdown — one click switches locale.
 */
export default function LanguageToggle({
  compactTrigger,
}: {
  compactTrigger?: boolean;
}) {
  const router = useRouter();
  const { t, locale, setLocale: setCtxLocale } = useI18n();

  const toggleLocale = () => {
    const next: Locale = locale === "en" ? "ru" : "en";
    setCtxLocale(next);
    router.refresh();
  };

  const label = locale.toUpperCase();
  const other = locale === "en" ? "RU" : "EN";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLocale();
      }}
      className={`rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all bg-transparent font-semibold tracking-wide ${
        compactTrigger ? "w-[42px] h-[42px] p-0 text-xs" : "px-3 py-2 text-sm"
      }`}
      aria-label={t("lang.switchTo", { lang: other })}
      title={t("lang.switchTo", { lang: other })}
      data-testid="language-toggle"
    >
      {label}
    </button>
  );
}
