"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StarsBackground from "@/components/StarsBackground";

function getToken() {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("auth-token="))
    ?.split("=")[1];
}

export default function BulkTranslatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [forceRetranslateText, setForceRetranslateText] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [forceRegenerateAudio, setForceRegenerateAudio] = useState(false);
  const [scope, setScope] = useState({
    introduction: true,
    chapterMetadata: true,
    sections: true,
    quizQuestions: true,
    additionalQuestions: true,
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!["Admin", "Developer", "Editor"].includes(data.user?.role)) {
        router.push("/");
        return;
      }
      setLoading(false);
    })();
  }, [router]);

  const runBulk = async () => {
    const token = getToken();
    if (!token) {
      alert("Not authenticated");
      return;
    }
    if (
      !confirm(
        "This will translate English content to Russian using OpenAI" +
          (generateAudio ? " and generate Russian audio with Inworld." : ".") +
          " It may take several minutes. Continue?"
      )
    ) {
      return;
    }
    setRunning(true);
    setLogs([]);
    setErrors([]);
    setMessage("");
    try {
      const res = await fetch("/api/admin/bulk-translate-to-russian", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          forceRetranslateText,
          generateAudio,
          forceRegenerateAudio,
          scope,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || "Request failed");
        setErrors(data.errors || []);
        setLogs(data.logs || []);
        return;
      }
      setLogs(data.logs || []);
      setErrors(data.errors || []);
      setMessage(data.message || "Done.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] flex items-center justify-center text-white">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0e27] via-[#1a1f3a] to-[#0a0e27] relative overflow-hidden">
      <StarsBackground />
      <div className="relative z-10 container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              Bulk EN → RU + audio
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Translate all course & quiz content to Russian and optionally generate RU audio (Inworld).
            </p>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 bg-[#1a1f3a]/80 border border-cyan-500/30 rounded-lg text-cyan-400 hover:bg-cyan-500/10 text-sm"
          >
            ← Admin home
          </Link>
        </div>

        <div className="bg-[#1a1f3a]/90 backdrop-blur-lg rounded-2xl border border-cyan-500/20 p-6 space-y-6">
          <div className="space-y-3 text-sm text-gray-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={forceRetranslateText}
                onChange={(e) => setForceRetranslateText(e.target.checked)}
                className="rounded border-cyan-500/50"
              />
              <span>
                <strong className="text-white">Re-translate Russian text</strong> even when Russian
                fields already exist (overwrites existing RU copy)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={generateAudio}
                onChange={(e) => setGenerateAudio(e.target.checked)}
                className="rounded border-cyan-500/50"
              />
              <span>
                <strong className="text-white">Generate Russian audio</strong> (requires{" "}
                <code className="text-cyan-400">INWORLD_API_KEY</code>)
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer ml-6">
              <input
                type="checkbox"
                checked={forceRegenerateAudio}
                onChange={(e) => setForceRegenerateAudio(e.target.checked)}
                disabled={!generateAudio}
                className="rounded border-cyan-500/50 disabled:opacity-40"
              />
              <span className={!generateAudio ? "opacity-50" : ""}>
                Regenerate RU audio even if Russian audio URLs already exist
              </span>
            </label>
          </div>

          <div>
            <p className="text-white font-semibold mb-2 text-sm">Include</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-300">
              {(
                [
                  ["introduction", "Introduction page"],
                  ["chapterMetadata", "Chapter titles & descriptions"],
                  ["sections", "All chapter sections (text + section RU audio)"],
                  ["quizQuestions", "All quiz questions (chapter + eligibility + …)"],
                  ["additionalQuestions", "Additional exam questions"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scope[key as keyof typeof scope]}
                    onChange={(e) =>
                      setScope((s) => ({ ...s, [key]: e.target.checked }))
                    }
                    className="rounded border-cyan-500/50"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={running}
            onClick={runBulk}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-600 hover:to-blue-700 transition-all"
          >
            {running ? "Running… (keep this tab open)" : "Run bulk translation + audio"}
          </button>

          {message && (
            <p
              className={`text-sm ${errors.length ? "text-amber-300" : "text-green-400"}`}
            >
              {message}
            </p>
          )}

          {errors.length > 0 && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4">
              <p className="text-red-300 font-semibold text-sm mb-2">Errors</p>
              <ul className="text-xs text-red-200/90 space-y-1 max-h-40 overflow-y-auto font-mono">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {logs.length > 0 && (
            <div className="rounded-lg border border-cyan-500/30 bg-[#0a0e27]/80 p-4">
              <p className="text-cyan-300 font-semibold text-sm mb-2">Log</p>
              <ul className="text-xs text-gray-400 space-y-1 max-h-96 overflow-y-auto font-mono whitespace-pre-wrap">
                {logs.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Requires <code className="text-gray-400">OPENAI_API_KEY</code>. Large courses can take a long
            time; run on your server with a generous HTTP timeout if needed.
          </p>
        </div>
      </div>
    </div>
  );
}
