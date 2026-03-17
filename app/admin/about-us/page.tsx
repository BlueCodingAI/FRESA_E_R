"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StarsBackground from "@/components/StarsBackground";
import RichTextEditor from "@/components/RichTextEditor";

export default function AdminAboutUsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("About Us");
  const [titleRu, setTitleRu] = useState("О нас");
  const [content, setContent] = useState("");
  const [contentRu, setContentRu] = useState("");
  const [activeLang, setActiveLang] = useState<"en" | "ru">("en");

  const getToken = () =>
    document.cookie
      .split("; ")
      .find((row) => row.startsWith("auth-token="))
      ?.split("=")[1];

  useEffect(() => {
    fetchPage();
  }, []);

  const fetchPage = async () => {
    try {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await fetch("/api/admin/pages/about_us", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setTitle(data.title || "About Us");
        setTitleRu(data.titleRu || "О нас");
        setContent(data.content || "");
        setContentRu(data.contentRu || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch("/api/admin/pages/about_us", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          content,
          titleRu: titleRu.trim(),
          contentRu,
        }),
      });
      if (res.ok) {
        alert("About Us page saved successfully!");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Failed to save");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] relative flex items-center justify-center">
        <StarsBackground />
        <div className="relative z-10 w-10 h-10 border-2 border-cyan-500/50 border-t-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] relative overflow-hidden">
      <StarsBackground />
      <div className="relative z-10 container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center text-gray-400 hover:text-cyan-400 text-sm mb-2"
            >
              ← Admin
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              Edit About Us
            </h1>
            <p className="text-gray-400 text-sm mt-1">Content appears on the public About Us page.</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/about-us"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 text-sm"
            >
              View page
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="bg-[#1a1f3a]/90 backdrop-blur-lg rounded-2xl border border-cyan-500/20 p-4 md:p-6 max-w-4xl">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="inline-flex rounded-xl bg-[#0a0e27]/40 border border-cyan-500/20 p-1">
              <button
                type="button"
                onClick={() => setActiveLang("en")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeLang === "en" ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" : "text-gray-300 hover:text-cyan-300"
                }`}
              >
                🇺🇸 English
              </button>
              <button
                type="button"
                onClick={() => setActiveLang("ru")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeLang === "ru" ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" : "text-gray-300 hover:text-cyan-300"
                }`}
              >
                🇷🇺 Russian
              </button>
            </div>
            <div className="text-xs text-gray-400 hidden sm:block">
              Editing: <span className="text-gray-200 font-medium">{activeLang === "en" ? "English" : "Russian"}</span>
            </div>
          </div>

          <label className="block text-sm font-medium text-gray-300 mb-2">
            Page title ({activeLang === "en" ? "EN" : "RU"})
          </label>
          <input
            type="text"
            value={activeLang === "en" ? title : titleRu}
            onChange={(e) => (activeLang === "en" ? setTitle(e.target.value) : setTitleRu(e.target.value))}
            className="w-full px-4 py-3 bg-[#0a0e27]/50 border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 mb-6"
            placeholder={activeLang === "en" ? "About Us" : "О нас"}
          />

          <label className="block text-sm font-medium text-gray-300 mb-2">
            Content (HTML) ({activeLang === "en" ? "EN" : "RU"})
          </label>
          <RichTextEditor
            value={activeLang === "en" ? content : contentRu}
            onChange={(v) => (activeLang === "en" ? setContent(v) : setContentRu(v))}
            placeholder={activeLang === "en" ? "Enter About Us content…" : "Введите контент для страницы…"}
            rows={14}
            className="min-h-[320px]"
          />
        </div>
      </div>
    </div>
  );
}
