"use client";

import { useI18n } from "@/components/I18nProvider";

export default function AudioPlayerLoadingFallback() {
  const { t } = useI18n();
  return <div className="text-white">{t("chapter.loadingAudio")}</div>;
}
