"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
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
        className="px-3 py-2 rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all bg-transparent text-sm font-semibold tracking-wide"
        aria-label={t("lang.switch")}
        title={t("lang.switch")}
      >
        {locale.toUpperCase()}
      </button>

      {open && (
        <div
          className={`absolute right-0 mt-2 bg-[#1a1f3a] border border-cyan-500/30 rounded-xl shadow-2xl overflow-hidden z-[80] ${
            flagsOnly ? "min-w-[4rem]" : "min-w-[7rem]"
          }`}
        >
          <button
            type="button"
            onClick={() => applyLocale("en")}
            className={`w-full flex items-center ${flagsOnly ? "justify-center px-3 py-3" : "gap-3 px-4 py-3 text-left"} transition-colors ${
              locale === "en" ? "bg-cyan-500/10 text-cyan-300" : "text-gray-200 hover:bg-cyan-500/10 hover:text-cyan-300"
            }`}
          >{flagsOnly ? "EN" : <span className="font-medium tracking-tight">EN</span>}
          </button>
          <button
            type="button"
            onClick={() => applyLocale("ru")}
            className={`w-full flex items-center ${flagsOnly ? "justify-center px-3 py-3" : "gap-3 px-4 py-3 text-left"} transition-colors ${
              locale === "ru" ? "bg-cyan-500/10 text-cyan-300" : "text-gray-200 hover:bg-cyan-500/10 hover:text-cyan-300"
            }`}
          >{flagsOnly ? "RU" : <span className="font-medium tracking-tight">RU</span>}
          </button>
        </div>
      )}
    </div>
  );
}

