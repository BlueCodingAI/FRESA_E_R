"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { FlagRussia, FlagUS } from "@/components/LocaleFlagIcons";
import { useI18n } from "@/components/I18nProvider";

export default function LanguageSwitcher({ flagsOnly }: { flagsOnly?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { t, locale, setLocale: setCtxLocale } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!open) return;
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const applyLocale = (next: Locale) => {
    setCtxLocale(next);
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all bg-transparent"
        aria-label={t("lang.switch")}
        title={t("lang.switch")}
      >
        {/* Globe icon */}
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5 0 4.5-4 4.5-9S14.5 3 12 3 7.5 7 7.5 12 9.5 21 12 21Zm-9-9h18"
          />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute right-0 mt-2 bg-[#1a1f3a] border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden z-[80] ${
            flagsOnly ? "min-w-[4rem]" : "min-w-[11.5rem]"
          }`}
        >
          <button
            type="button"
            onClick={() => applyLocale("en")}
            className={`w-full flex items-center ${flagsOnly ? "justify-center px-3 py-3" : "gap-3 px-4 py-3 text-left"} transition-colors ${
              locale === "en" ? "bg-cyan-500/10 text-cyan-300" : "text-gray-200 hover:bg-cyan-500/10 hover:text-cyan-300"
            }`}
          >
            <FlagUS />
            {!flagsOnly && <span className="font-medium tracking-tight">{t("lang.menu_us")}</span>}
          </button>
          <button
            type="button"
            onClick={() => applyLocale("ru")}
            className={`w-full flex items-center ${flagsOnly ? "justify-center px-3 py-3" : "gap-3 px-4 py-3 text-left"} transition-colors ${
              locale === "ru" ? "bg-cyan-500/10 text-cyan-300" : "text-gray-200 hover:bg-cyan-500/10 hover:text-cyan-300"
            }`}
          >
            <FlagRussia />
            {!flagsOnly && <span className="font-medium tracking-tight">{t("lang.menu_ru")}</span>}
          </button>
        </div>
      )}
    </div>
  );
}

