"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import StarsBackground from "@/components/StarsBackground";
import RichTextEditor from "@/components/RichTextEditor";
import AdminTranslateToolbar from "@/components/AdminTranslateToolbar";

interface IntroductionData {
  id?: string;
  text: string;
  textRu?: string | null;
  audioUrl: string;
  timestampsUrl: string;
  audioUrlRu?: string | null;
  timestampsUrlRu?: string | null;
}

export default function IntroductionEditPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [showTTSSettings, setShowTTSSettings] = useState(false);
  const [introData, setIntroData] = useState<IntroductionData>({
    text: "Hello, future real estate professional. My name is Mr Listings. Welcome to my 63 hour pre-license education course for sales associates, approved by Florida Real Estate Commission.",
    textRu: "",
    audioUrl: "/audio/intro.mp3",
    timestampsUrl: "/timestamps/intro.timestamps.json",
    audioUrlRu: "",
    timestampsUrlRu: "",
  });

  const [ttsSettings, setTtsSettings] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("inworld-tts-settings");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          /* ignore */
        }
      }
    }
    return {
      modelId: "inworld-tts-1",
      audioEncoding: "MP3",
      speakingRate: 1.0,
      sampleRateHertz: 48000,
      bitRate: 128000,
      temperature: 1.1,
      timestampType: "WORD",
      applyTextNormalization: "APPLY_TEXT_NORMALIZATION_UNSPECIFIED",
    };
  });

  const saveTTSSettings = (settings: typeof ttsSettings) => {
    setTtsSettings(settings);
    if (typeof window !== "undefined") {
      localStorage.setItem("inworld-tts-settings", JSON.stringify(settings));
    }
  };

  const stripHTML = (html: string): string => {
    if (typeof document === "undefined") {
      return html
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    }
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").trim();
  };

  const buildAudioRequest = (
    html: string,
    context: "section" | "quiz" | "introduction" = "introduction",
    fileKey?: string
  ) => ({
    text: stripHTML(html),
    type: "both",
    context,
    ...(fileKey ? { fileKey } : {}),
    ...ttsSettings,
  });

  useEffect(() => {
    fetchIntroduction();
  }, []);

  const getToken = () =>
    document.cookie
      .split("; ")
      .find((row) => row.startsWith("auth-token="))
      ?.split("=")[1];

  const fetchIntroduction = async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/admin/introduction", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.introduction) {
          const i = data.introduction;
          setIntroData({
            ...i,
            textRu: i.textRu ?? "",
            audioUrlRu: i.audioUrlRu ?? "",
            timestampsUrlRu: i.timestampsUrlRu ?? "",
          });
        }
      }
    } catch (err) {
      console.error("Error fetching introduction:", err);
    } finally {
      setLoading(false);
    }
  };

  const persistIntroduction = async (payload: IntroductionData) => {
    const token = getToken();
    const saveResponse = await fetch("/api/admin/introduction", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    return saveResponse.ok;
  };

  const handleGenerateIntroAudio = async (lang: "en" | "ru") => {
    const html = lang === "en" ? introData.text : introData.textRu || "";
    if (!stripHTML(html)) {
      alert(lang === "en" ? "Enter English text first." : "Enter Russian text first.");
      return;
    }
    try {
      setGeneratingAudio(true);
      const token = getToken();
      const response = await fetch("/api/admin/generate-audio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(
          buildAudioRequest(html, "introduction", lang === "en" ? "en" : "ru")
        ),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`❌ ${error.error || "Generation failed"}`);
        return;
      }
      const data = await response.json();
      const updated: IntroductionData =
        lang === "en"
          ? {
              ...introData,
              audioUrl: data.audioUrl,
              timestampsUrl: data.timestampsUrl,
            }
          : {
              ...introData,
              audioUrlRu: data.audioUrl,
              timestampsUrlRu: data.timestampsUrl,
            };
      setIntroData(updated);
      const saved = await persistIntroduction(updated);
      alert(
        saved
          ? `✅ ${lang.toUpperCase()} audio saved.\n${data.audioUrl}`
          : `⚠️ Generated but save failed — use Save Introduction.`
      );
    } catch (err) {
      console.error(err);
      alert("Failed to generate audio");
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleGenerateBothIntroAudio = async () => {
    const enOk = stripHTML(introData.text);
    const ruOk = stripHTML(introData.textRu || "");
    if (!enOk && !ruOk) {
      alert("Add at least EN or RU text before generating.");
      return;
    }
    try {
      setGeneratingAudio(true);
      const token = getToken();
      let next = { ...introData };
      if (enOk) {
        const r = await fetch("/api/admin/generate-audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(buildAudioRequest(introData.text, "introduction", "en")),
        });
        if (r.ok) {
          const d = await r.json();
          next = { ...next, audioUrl: d.audioUrl, timestampsUrl: d.timestampsUrl };
        } else {
          const e = await r.json();
          alert(`EN audio failed: ${e.error}`);
        }
      }
      if (ruOk) {
        const r2 = await fetch("/api/admin/generate-audio", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            buildAudioRequest(introData.textRu || "", "introduction", "ru")
          ),
        });
        if (r2.ok) {
          const d2 = await r2.json();
          next = {
            ...next,
            audioUrlRu: d2.audioUrl,
            timestampsUrlRu: d2.timestampsUrl,
          };
        } else {
          const e2 = await r2.json();
          alert(`RU audio failed: ${e2.error}`);
        }
      }
      setIntroData(next);
      await persistIntroduction(next);
      alert("✅ Generate-all finished (saved).");
    } catch (err) {
      console.error(err);
      alert("Failed");
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch("/api/admin/introduction", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify(introData),
      });
      if (res.ok) alert("Introduction saved.");
      else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Save failed");
      }
    } catch {
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] relative overflow-hidden">
      <StarsBackground />

      <div className="relative z-10 container mx-auto px-4 py-4 md:py-8">
        <div className="mb-4 md:mb-6">
          <Link
            href="/admin"
            className="text-cyan-400 hover:text-cyan-300 mb-3 md:mb-4 inline-block text-sm md:text-base"
          >
            ← Back to Admin Panel
          </Link>
          <h1 className="text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 mb-2">
            Edit Introduction (EN + RU)
          </h1>
        </div>

        <div className="bg-[#1a1f3a]/90 backdrop-blur-lg rounded-2xl shadow-2xl border border-purple-500/20 p-4 md:p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <AdminTranslateToolbar
              getToken={getToken}
              enValue={introData.text}
              ruValue={introData.textRu || ""}
              setEn={(v) => setIntroData({ ...introData, text: v })}
              setRu={(v) => setIntroData({ ...introData, textRu: v })}
              format="html"
            />
            <button
              type="button"
              onClick={() => setShowTTSSettings(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold rounded-lg"
            >
              ⚙️ TTS
            </button>
            <button
              type="button"
              disabled={generatingAudio}
              onClick={handleGenerateBothIntroAudio}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
            >
              {generatingAudio ? "…" : "🎙️ Generate EN + RU audio"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-cyan-500/20 bg-[#0a0e27]/40 p-4 space-y-3">
              <h3 className="text-sm font-bold text-cyan-300">🇺🇸 English</h3>
              <RichTextEditor
                value={introData.text}
                onChange={(v) => setIntroData({ ...introData, text: v })}
                rows={6}
                placeholder="Introduction (English)…"
              />
              <button
                type="button"
                disabled={generatingAudio || !stripHTML(introData.text)}
                onClick={() => handleGenerateIntroAudio("en")}
                className="w-full py-2 bg-green-600/80 hover:bg-green-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40"
              >
                Generate EN audio
              </button>
              <div>
                <label className="text-xs text-gray-400">Audio URL (EN)</label>
                <input
                  className="w-full mt-1 px-3 py-2 bg-[#0a0e27]/60 border border-cyan-500/30 rounded text-white text-sm"
                  value={introData.audioUrl}
                  onChange={(e) =>
                    setIntroData({ ...introData, audioUrl: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Timestamps (EN)</label>
                <input
                  className="w-full mt-1 px-3 py-2 bg-[#0a0e27]/60 border border-cyan-500/30 rounded text-white text-sm"
                  value={introData.timestampsUrl}
                  onChange={(e) =>
                    setIntroData({ ...introData, timestampsUrl: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-pink-500/20 bg-[#0a0e27]/40 p-4 space-y-3">
              <h3 className="text-sm font-bold text-pink-300">🇷🇺 Русский</h3>
              <RichTextEditor
                value={introData.textRu || ""}
                onChange={(v) => setIntroData({ ...introData, textRu: v })}
                rows={6}
                placeholder="Вступление (русский)…"
              />
              <button
                type="button"
                disabled={generatingAudio || !stripHTML(introData.textRu || "")}
                onClick={() => handleGenerateIntroAudio("ru")}
                className="w-full py-2 bg-pink-600/80 hover:bg-pink-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40"
              >
                Generate RU audio
              </button>
              <div>
                <label className="text-xs text-gray-400">Audio URL (RU)</label>
                <input
                  className="w-full mt-1 px-3 py-2 bg-[#0a0e27]/60 border border-pink-500/30 rounded text-white text-sm"
                  value={introData.audioUrlRu || ""}
                  onChange={(e) =>
                    setIntroData({ ...introData, audioUrlRu: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Timestamps (RU)</label>
                <input
                  className="w-full mt-1 px-3 py-2 bg-[#0a0e27]/60 border border-pink-500/30 rounded text-white text-sm"
                  value={introData.timestampsUrlRu || ""}
                  onChange={(e) =>
                    setIntroData({ ...introData, timestampsUrlRu: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Introduction"}
            </button>
            <Link
              href="/admin"
              className="px-6 py-3 bg-[#0a0e27]/50 border border-gray-500/30 rounded-lg text-gray-300 text-center"
            >
              Cancel
            </Link>
          </div>
        </div>

        {showTTSSettings && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1f3a] rounded-2xl border border-purple-500/20 p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto text-white space-y-4">
              <h2 className="text-xl font-bold">Inworld TTS</h2>
              <p className="text-xs text-gray-400">
                Model, rate, temperature — same as chapter admin.
              </p>
              <select
                value={ttsSettings.modelId}
                onChange={(e) =>
                  saveTTSSettings({ ...ttsSettings, modelId: e.target.value })
                }
                className="w-full px-3 py-2 bg-[#0a0e27] border border-purple-500/30 rounded"
              >
                <option value="inworld-tts-1">inworld-tts-1</option>
                <option value="inworld-tts-1-max">inworld-tts-1-max</option>
              </select>
              <label className="block text-sm">
                Speaking rate: {ttsSettings.speakingRate}
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  value={ttsSettings.speakingRate}
                  onChange={(e) =>
                    saveTTSSettings({
                      ...ttsSettings,
                      speakingRate: parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </label>
              <label className="block text-sm">
                Temperature: {ttsSettings.temperature}
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={ttsSettings.temperature}
                  onChange={(e) =>
                    saveTTSSettings({
                      ...ttsSettings,
                      temperature: parseFloat(e.target.value),
                    })
                  }
                  className="w-full"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowTTSSettings(false)}
                className="w-full py-2 bg-green-600 rounded-lg font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
