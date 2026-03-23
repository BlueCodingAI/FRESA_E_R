"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StarsBackground from "@/components/StarsBackground";

function getToken() {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("auth-token="))
    ?.split("=")[1];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Plan = {
  hasIntroduction: boolean;
  chapterCount: number;
  sectionCount: number;
  quizQuestionCount: number;
  additionalQuestionCount: number;
};

type Defaults = {
  sectionsBatch: number;
  quizBatch: number;
  chapterMetadataBatch: number;
};

export default function BulkTranslatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [forceRetranslateText, setForceRetranslateText] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [forceRegenerateAudio, setForceRegenerateAudio] = useState(false);
  const [generateEnglishAudio, setGenerateEnglishAudio] = useState(false);
  const [forceRegenerateEnglishAudio, setForceRegenerateEnglishAudio] =
    useState(false);
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
  const [progressLabel, setProgressLabel] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const abortRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const appendLogs = useCallback((lines: string[]) => {
    if (lines.length === 0) return;
    setLogs((prev) => [...prev, ...lines]);
  }, []);

  const appendErrors = useCallback((lines: string[]) => {
    if (lines.length === 0) return;
    setErrors((prev) => [...prev, ...lines]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

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

  const postBatch = async (
    body: Record<string, unknown>,
    token: string,
    retries = 2
  ): Promise<Record<string, unknown>> => {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch("/api/admin/bulk-translate-to-russian", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const text = await res.text();
        let data: Record<string, unknown> = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error(
            `Bad response (${res.status}): ${text.slice(0, 180)}${text.length > 180 ? "…" : ""}`
          );
        }
        if (!res.ok) {
          throw new Error(
            (data.error as string) || `Request failed (${res.status})`
          );
        }
        return data;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (attempt < retries) {
          appendLogs([
            `… retry ${attempt + 1}/${retries} after error: ${lastErr.message}`,
          ]);
          await sleep(2000);
        }
      }
    }
    throw lastErr ?? new Error("Unknown error");
  };

  const runBulk = async () => {
    const token = getToken();
    if (!token) {
      alert("Not authenticated");
      return;
    }
    if (
      !confirm(
        "This runs in small batches to avoid server timeouts. Keep this tab open until finished. Continue?"
      )
    ) {
      return;
    }

    abortRef.current = false;
    setRunning(true);
    setLogs([]);
    setErrors([]);
    setMessage("");
    setProgressPercent(0);
    setCurrentStep(0);
    setProgressLabel("Starting…");

    const baseOpts = {
      forceRetranslateText,
      generateAudio,
      forceRegenerateAudio,
      generateEnglishAudio,
      forceRegenerateEnglishAudio,
    };

    try {
      // --- Plan ---
      setProgressLabel("Fetching plan…");
      const planRes = await postBatch({ mode: "plan", ...baseOpts }, token);
      const plan = planRes.plan as Plan;
      const defaults = planRes.defaults as Defaults;

      const chBatch = defaults.chapterMetadataBatch;
      const secBatch = defaults.sectionsBatch;
      const qBatch = defaults.quizBatch;

      let steps = 0;
      if (scope.introduction && plan.hasIntroduction) steps += 1;
      if (scope.chapterMetadata && plan.chapterCount > 0) {
        steps += Math.ceil(plan.chapterCount / chBatch);
      }
      if (scope.sections && plan.sectionCount > 0) {
        steps += Math.ceil(plan.sectionCount / secBatch);
      }
      if (scope.quizQuestions && plan.quizQuestionCount > 0) {
        steps += Math.ceil(plan.quizQuestionCount / qBatch);
      }
      if (scope.additionalQuestions && plan.additionalQuestionCount > 0) {
        steps += Math.ceil(plan.additionalQuestionCount / qBatch);
      }
      if (steps === 0) {
        setMessage("Nothing to process with current selections.");
        setRunning(false);
        return;
      }
      setTotalSteps(steps);

      let step = 0;
      const bump = (label: string) => {
        step += 1;
        setCurrentStep(step);
        setProgressPercent(Math.round((step / steps) * 100));
        setProgressLabel(label);
      };

      appendLogs([
        `Plan: intro=${plan.hasIntroduction}, chapters=${plan.chapterCount}, sections=${plan.sectionCount}, quiz=${plan.quizQuestionCount}, additional=${plan.additionalQuestionCount}`,
        `Audio: RU=${generateAudio}, EN=${generateEnglishAudio}`,
        `Batch sizes: chapter meta=${chBatch}, sections=${secBatch}, quiz/additional=${qBatch}`,
        `---`,
      ]);

      // Introduction
      if (abortRef.current) throw new Error("Stopped by user");
      if (scope.introduction && plan.hasIntroduction) {
        setProgressLabel("Introduction…");
        const r = await postBatch({ mode: "introduction", ...baseOpts }, token);
        appendLogs((r.logs as string[]) || []);
        appendErrors((r.errors as string[]) || []);
        bump("Introduction done");
      }

      // Chapter metadata (paged)
      if (abortRef.current) throw new Error("Stopped by user");
      if (scope.chapterMetadata && plan.chapterCount > 0) {
        let off = 0;
        let more = true;
        while (more) {
          if (abortRef.current) throw new Error("Stopped by user");
          setProgressLabel(`Chapter titles & descriptions (${off}/${plan.chapterCount})…`);
          const r = await postBatch(
            {
              mode: "chapterMetadata",
              offset: off,
              limit: chBatch,
              ...baseOpts,
            },
            token
          );
          appendLogs((r.logs as string[]) || []);
          appendErrors((r.errors as string[]) || []);
          more = Boolean(r.hasMore);
          off = r.nextOffset as number;
          bump(`Chapter metadata batch → ${off}`);
        }
      }

      // Sections (paged)
      if (abortRef.current) throw new Error("Stopped by user");
      if (scope.sections && plan.sectionCount > 0) {
        let off = 0;
        let more = true;
        while (more) {
          if (abortRef.current) throw new Error("Stopped by user");
          setProgressLabel(`Sections (${off}/${plan.sectionCount})…`);
          const r = await postBatch(
            {
              mode: "sections",
              offset: off,
              limit: secBatch,
              ...baseOpts,
            },
            token
          );
          appendLogs((r.logs as string[]) || []);
          appendErrors((r.errors as string[]) || []);
          more = Boolean(r.hasMore);
          off = r.nextOffset as number;
          bump(`Sections batch → ${off}`);
        }
      }

      // Quiz questions (paged)
      if (abortRef.current) throw new Error("Stopped by user");
      if (scope.quizQuestions && plan.quizQuestionCount > 0) {
        let off = 0;
        let more = true;
        while (more) {
          if (abortRef.current) throw new Error("Stopped by user");
          setProgressLabel(`Quiz questions (${off}/${plan.quizQuestionCount})…`);
          const r = await postBatch(
            {
              mode: "quizQuestions",
              offset: off,
              limit: qBatch,
              ...baseOpts,
            },
            token
          );
          appendLogs((r.logs as string[]) || []);
          appendErrors((r.errors as string[]) || []);
          more = Boolean(r.hasMore);
          off = r.nextOffset as number;
          bump(`Quiz batch → ${off}`);
        }
      }

      // Additional questions (paged)
      if (abortRef.current) throw new Error("Stopped by user");
      if (scope.additionalQuestions && plan.additionalQuestionCount > 0) {
        let off = 0;
        let more = true;
        while (more) {
          if (abortRef.current) throw new Error("Stopped by user");
          setProgressLabel(`Additional questions (${off}/${plan.additionalQuestionCount})…`);
          const r = await postBatch(
            {
              mode: "additionalQuestions",
              offset: off,
              limit: qBatch,
              ...baseOpts,
            },
            token
          );
          appendLogs((r.logs as string[]) || []);
          appendErrors((r.errors as string[]) || []);
          more = Boolean(r.hasMore);
          off = r.nextOffset as number;
          bump(`Additional batch → ${off}`);
        }
      }

      setProgressPercent(100);
      setProgressLabel("Finished");
      setMessage("Bulk EN → RU run completed. Check errors below if any.");
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      setMessage(err);
      appendErrors([err]);
      appendLogs([`Stopped: ${err}`]);
    } finally {
      setRunning(false);
    }
  };

  const stopRun = () => {
    abortRef.current = true;
    setProgressLabel("Stopping after current batch…");
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
              Runs in <strong className="text-gray-300">small server batches</strong> so nginx/proxy
              timeouts don&apos;t kill the job. Live progress below.
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
                fields already exist
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
                <code className="text-cyan-400">INWORLD_API_KEY</code>) — uses{" "}
                <strong className="text-white">1 section / 1 quiz row per batch</strong> to stay
                within time limits
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
                Regenerate RU audio even if URLs already exist
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={generateEnglishAudio}
                onChange={(e) => setGenerateEnglishAudio(e.target.checked)}
                className="rounded border-cyan-500/50"
              />
              <span>
                <strong className="text-white">Generate English audio</strong> from
                English text (introduction, sections, quiz questions &amp; options &amp;
                explanations) — uses{" "}
                <code className="text-cyan-400">INWORLD_EN_VOICE_ID</code> via{" "}
                <code className="text-cyan-400">fileKey: en</code>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer ml-6">
              <input
                type="checkbox"
                checked={forceRegenerateEnglishAudio}
                onChange={(e) =>
                  setForceRegenerateEnglishAudio(e.target.checked)
                }
                disabled={!generateEnglishAudio}
                className="rounded border-cyan-500/50 disabled:opacity-40"
              />
              <span className={!generateEnglishAudio ? "opacity-50" : ""}>
                Regenerate EN audio even if URLs already exist
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
                  [
                    "sections",
                    "All chapter sections (text + optional RU/EN section audio)",
                  ],
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
                    disabled={running}
                    className="rounded border-cyan-500/50"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="rounded-xl border border-cyan-500/25 bg-[#0a0e27]/60 p-4 space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span className="text-cyan-300 font-medium truncate pr-2">{progressLabel}</span>
              <span>
                {totalSteps > 0 ? `${currentStep} / ${totalSteps} batches` : ""}{" "}
                {progressPercent > 0 ? `· ${progressPercent}%` : ""}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#1a1f3a] overflow-hidden border border-cyan-500/20">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={running}
              onClick={runBulk}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-cyan-600 hover:to-blue-700 transition-all"
            >
              {running ? "Running…" : "Run bulk translation + audio"}
            </button>
            {running && (
              <button
                type="button"
                onClick={stopRun}
                className="py-3 px-4 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 text-sm font-semibold"
              >
                Stop after current batch
              </button>
            )}
          </div>

          {message && (
            <p
              className={`text-sm ${errors.length && !message.includes("completed") ? "text-amber-300" : "text-green-400"}`}
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
              <p className="text-cyan-300 font-semibold text-sm mb-2">Live log</p>
              <ul className="text-xs text-gray-400 space-y-1 max-h-[min(70vh,480px)] overflow-y-auto font-mono whitespace-pre-wrap">
                {logs.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
                <div ref={logEndRef} />
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-500">
            <code className="text-gray-400">OPENAI_API_KEY</code> required. Each batch returns quickly;
            for huge courses, expect many batches. On the server, you can still raise{" "}
            <code className="text-gray-400">proxy_read_timeout</code> in nginx as a safety net.
          </p>
        </div>
      </div>
    </div>
  );
}
