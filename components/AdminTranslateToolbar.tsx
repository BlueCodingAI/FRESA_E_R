"use client";

import { useState } from "react";

type Props = {
  getToken: () => string | undefined;
  enValue: string;
  ruValue: string;
  setEn: (v: string) => void;
  setRu: (v: string) => void;
  format: "html" | "plain";
  className?: string;
  compact?: boolean;
};

export default function AdminTranslateToolbar({
  getToken,
  enValue,
  ruValue,
  setEn,
  setRu,
  format,
  className = "",
  compact,
}: Props) {
  const [busy, setBusy] = useState(false);

  const run = async (direction: "en_to_ru" | "ru_to_en") => {
    const src = direction === "en_to_ru" ? enValue : ruValue;
    if (!src?.trim()) {
      alert(
        direction === "en_to_ru"
          ? "English field is empty — nothing to translate."
          : "Russian field is empty — nothing to translate."
      );
      return;
    }
    setBusy(true);
    try {
      const token = getToken();
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
        body: JSON.stringify({ text: src, direction, format }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Translation failed");
      if (direction === "en_to_ru") setRu(data.translated);
      else setEn(data.translated);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Translation failed");
    } finally {
      setBusy(false);
    }
  };

  const btn =
    "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25";

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      role="group"
      aria-label="Translate with OpenAI"
    >
      <span className={`text-gray-500 ${compact ? "text-[10px]" : "text-xs"}`}>
        OpenAI:
      </span>
      <button type="button" disabled={busy} className={btn} onClick={() => run("en_to_ru")}>
        {busy ? "…" : "EN → RU"}
      </button>
      <button type="button" disabled={busy} className={btn} onClick={() => run("ru_to_en")}>
        {busy ? "…" : "RU → EN"}
      </button>
    </div>
  );
}
