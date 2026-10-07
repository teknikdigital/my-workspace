"use client";

/**
 * Panel "Kerjakan dengan Claude Code": kirim instruksi ke Claude Code di laptop (lewat My Workspace Agent),
 * pantau progres, lihat hasil, hentikan. Dipakai di halaman Lokal dan di kartu tugas chat AI Asisten.
 * Semua request dari BROWSER ke agent di 127.0.0.1 (server Vercel tidak bisa menjangkau laptop).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Play, Square, Loader2, CheckCircle2, XCircle, FileCode2, ShieldAlert, History, Lock } from "lucide-react";
import { Markdown } from "@/components/ui/Markdown";
import { cn } from "@/lib/utils";
import {
  agent,
  CLAUDE_MIN_AGENT_VERSION,
  isOlderVersion,
  loadAgentSettings,
  type ClaudeEvent,
  type ClaudeMode,
  type ClaudeModel,
  type ClaudeRun,
  type LocalApp,
} from "@/lib/local-agent/client";

const POLL_MS = 2000;

const MODEL_OPTIONS: { id: ClaudeModel; label: string }[] = [
  { id: "sonnet", label: "Sonnet (disarankan, hemat kuota)" },
  { id: "opus", label: "Opus (tugas berat, kuota cepat habis)" },
  { id: "haiku", label: "Haiku (tugas kecil, paling hemat)" },
];

const STATUS_TEXT: Record<ClaudeRun["status"], string> = {
  idle: "Belum ada",
  running: "Sedang dikerjakan",
  done: "Selesai",
  error: "Gagal",
  stopped: "Dihentikan",
  timeout: "Melewati batas waktu",
};

export interface ClaudeRunPanelProps {
  apps: LocalApp[];
  /** Project terpilih awal (id aplikasi di agent). */
  appId?: string;
  /** Kunci pilihan project (mis. dari halaman Lokal). */
  lockApp?: boolean;
  initialPrompt?: string;
  initialMode?: ClaudeMode;
  /** Dipanggil setelah instruksi selesai (untuk menyegarkan daftar aplikasi, dll). */
  onFinished?: (run: ClaudeRun) => void;
  /** "last" = tampilkan run terakhir project ini (halaman Lokal); "running" = hanya bila sedang berjalan (kartu chat). */
  attach?: "last" | "running";
}

export function ClaudeRunPanel({ apps: appsProp, appId, lockApp, initialPrompt = "", initialMode = "edit", onFinished, attach = "last" }: ClaudeRunPanelProps) {
  // Daftar aplikasi disegarkan sendiri setelah agent di-restart (data lama belum punya info claude)
  const [apps, setApps] = useState<LocalApp[]>(appsProp);
  useEffect(() => setApps(appsProp), [appsProp]);
  const [selected, setSelected] = useState(appId || "");
  const app = apps.find((a) => a.id === selected);
  const locked = !app?.claude || app.claude.mode === "read";
  const [prompt, setPrompt] = useState(initialPrompt);
  const [mode, setMode] = useState<ClaudeMode>(initialMode);
  const [model, setModel] = useState<ClaudeModel>("sonnet");
  const [resume, setResume] = useState(false);
  const [run, setRun] = useState<ClaudeRun | null>(null);
  const [events, setEvents] = useState<ClaudeEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [agentOld, setAgentOld] = useState<string | null>(null);
  const sinceRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const effectiveMode: ClaudeMode = locked ? "read" : mode;

  useEffect(() => setSelected(appId || ""), [appId]);

  // Agent lama (< 1.4.0) belum punya fitur Claude Code
  const [checkingAgent, setCheckingAgent] = useState(false);
  const checkAgent = useCallback(() => {
    setCheckingAgent(true);
    agent
      .version(loadAgentSettings())
      .then(async (v) => {
        const old = isOlderVersion(v, CLAUDE_MIN_AGENT_VERSION);
        setAgentOld(old ? v : null);
        if (!old) setApps(await agent.list(loadAgentSettings()));
      })
      .catch(() => setAgentOld((prev) => prev || "tidak aktif"))
      .finally(() => setCheckingAgent(false));
  }, []);
  useEffect(checkAgent, [checkAgent]);

  const stopPolling = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const poll = useCallback(
    async (id: string, finishedChecks = 0) => {
      const s = loadAgentSettings();
      try {
        const r = await agent.claudeStatus(s, id, sinceRef.current);
        if (r.events?.length) setEvents((prev) => [...prev, ...r.events!].slice(-400));
        sinceRef.current = r.eventCount ?? sinceRef.current;
        setRun(r);
        if (r.status === "running") {
          timer.current = setTimeout(() => poll(id), POLL_MS);
        } else if (r.activity?.status === "sending" && finishedChecks < 8) {
          // catatan aktivitas dikirim agent setelah selesai: tunggu sebentar
          timer.current = setTimeout(() => poll(id, finishedChecks + 1), 1500);
        } else if (r.status !== "idle") {
          onFinishedRef.current?.(r);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    },
    []
  );

  // Pasang ke instruksi yang sedang/terakhir berjalan di project ini
  useEffect(() => {
    stopPolling();
    setRun(null);
    setEvents([]);
    sinceRef.current = 0;
    setError(null);
    if (!selected) return;
    const s = loadAgentSettings();
    agent
      .claudeStatus(s, selected, 0)
      .then((r) => {
        if (r.status === "idle" || (attach === "running" && r.status !== "running")) return;
        setRun(r);
        setEvents(r.events || []);
        sinceRef.current = r.eventCount || 0;
        if (r.status === "running") timer.current = setTimeout(() => poll(selected), POLL_MS);
      })
      .catch(() => undefined);
    return stopPolling;
  }, [selected, poll, attach]);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const start = async () => {
    if (!selected || !prompt.trim()) return;
    setError(null);
    setStarting(true);
    const s = loadAgentSettings();
    try {
      await agent.claudeRun(s, selected, {
        prompt: prompt.trim(),
        mode: effectiveMode,
        model,
        resume: resume ? app?.claude?.lastSessionId || null : null,
      });
      setEvents([]);
      sinceRef.current = 0;
      setRun({ status: "running" });
      stopPolling();
      timer.current = setTimeout(() => poll(selected), 800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    try {
      await agent.claudeStop(loadAgentSettings(), selected);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const running = run?.status === "running";

  if (agentOld) {
    return (
      <div className="space-y-2 rounded-btn border border-orange/40 bg-orange/10 p-3 text-xs text-ink">
        <p>
          {agentOld === "tidak aktif" ? "Agent di laptop tidak aktif." : `Agent di laptop masih versi ${agentOld}.`} Fitur Claude Code butuh
          agent versi {CLAUDE_MIN_AGENT_VERSION}. Buka Work &gt; Lokal di tab lain: Pengaturan Agent &gt; Matikan Agent, lalu Nyalakan Agent.
          Setelah itu klik tombol di bawah (tidak perlu memuat ulang halaman ini, instruksi tetap tersimpan).
        </p>
        <button
          type="button"
          onClick={checkAgent}
          disabled={checkingAgent}
          className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-card px-3 py-1.5 font-semibold hover:border-teal disabled:opacity-50"
        >
          {checkingAgent && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Cek agent lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      {/* Pengaturan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="font-semibold text-mute">Project</span>
          <select
            value={selected}
            disabled={lockApp || running}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full rounded-btn border border-line bg-card px-2 py-2 text-ink"
          >
            <option value="">Pilih project...</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.claude?.mode === "read" ? " (baca saja)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-semibold text-mute">Model</span>
          <select
            value={model}
            disabled={running}
            onChange={(e) => setModel(e.target.value as ClaudeModel)}
            className="w-full rounded-btn border border-line bg-card px-2 py-2 text-ink"
          >
            {MODEL_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["edit", "read"] as ClaudeMode[]).map((m) => (
          <button
            key={m}
            type="button"
            disabled={running || (m === "edit" && locked)}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-full border px-3 py-1 font-semibold transition-all disabled:opacity-40",
              effectiveMode === m ? "border-teal bg-teal text-white" : "border-line text-mute hover:text-ink"
            )}
          >
            {m === "edit" ? "Boleh ubah file" : "Baca saja"}
          </button>
        ))}
        {locked && selected && (
          <span className="inline-flex items-center gap-1 text-mute" title='Ubah "claude.mode" di agent/apps.json untuk membuka'>
            <Lock className="h-3 w-3" /> Project dikunci baca saja
          </span>
        )}
        {app?.claude?.lastSessionId && (
          <label className="ml-auto inline-flex items-center gap-1.5 text-mute">
            <input type="checkbox" checked={resume} disabled={running} onChange={(e) => setResume(e.target.checked)} />
            <History className="h-3 w-3" /> Lanjutkan sesi sebelumnya
          </label>
        )}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={running}
        rows={6}
        placeholder="Contoh: Tambahkan tombol export PDF di halaman laporan bulanan. Pakai library yang sudah ada, jangan tambah dependency baru. Selesai bila npm run build lulus."
        className="w-full rounded-btn border border-line bg-glass p-3 text-ink placeholder:text-mute focus:border-teal focus:outline-none"
      />

      <div className="flex items-center gap-2">
        {!running ? (
          <button
            type="button"
            onClick={start}
            disabled={!selected || !prompt.trim() || starting}
            className="inline-flex items-center gap-1.5 rounded-btn bg-teal px-4 py-2 font-bold text-white shadow-soft hover:bg-teal-dark disabled:opacity-50"
          >
            {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Jalankan di Claude Code
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1.5 rounded-btn border border-red/50 px-4 py-2 font-bold text-red hover:bg-red/10"
          >
            <Square className="h-3.5 w-3.5" /> Hentikan
          </button>
        )}
        {run && run.status !== "idle" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-semibold",
              run.status === "done" ? "text-ok" : run.status === "running" ? "text-orange" : "text-red"
            )}
          >
            {run.status === "running" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : run.status === "done" ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {STATUS_TEXT[run.status]}
          </span>
        )}
      </div>

      {error && <p className="rounded-btn bg-red/10 p-2 text-red">{error}</p>}

      {/* Progres */}
      {events.length > 0 && (
        <div
          ref={boxRef}
          className="max-h-56 overflow-auto rounded-btn border border-line bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-gray-100"
        >
          {events.map((e, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap break-words",
                e.kind === "error" ? "text-red-300" : e.kind === "tool" ? "text-teal-300" : e.kind === "info" ? "text-gray-400" : ""
              )}
            >
              <span className="text-gray-500">{new Date(e.t).toLocaleTimeString("id-ID")} </span>
              {e.kind === "tool" ? "🔧 " : e.kind === "text" ? "💬 " : ""}
              {e.text}
            </div>
          ))}
        </div>
      )}

      {/* Hasil */}
      {run && run.status !== "running" && run.status !== "idle" && (
        <div className="space-y-2 rounded-btn border border-line bg-card/80 p-3">
          <div className="flex items-center gap-2 font-bold text-ink">
            <Bot className="h-4 w-4 text-teal" /> Hasil Claude Code
          </div>
          {run.result?.text ? <Markdown text={run.result.text} /> : run.error && <p className="text-red">{run.error}</p>}
          {!!run.files?.length && (
            <div className="flex flex-wrap items-center gap-1.5">
              <FileCode2 className="h-3.5 w-3.5 text-mute" />
              {run.files.map((f) => (
                <code key={f} className="rounded bg-line/30 px-1.5 py-0.5 text-[10px]">
                  {f}
                </code>
              ))}
            </div>
          )}
          {!!run.result?.denials?.length && (
            <div className="rounded-btn bg-orange/10 p-2 text-ink">
              <div className="flex items-center gap-1 font-semibold">
                <ShieldAlert className="h-3.5 w-3.5 text-orange" /> Perintah yang ditolak (di luar daftar izin):
              </div>
              <ul className="ml-5 list-disc">
                {run.result.denials.slice(0, 8).map((d, i) => (
                  <li key={i}>
                    <code className="text-[10px]">{d}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10px] text-mute">
            {run.result?.costUsd != null &&
              `Estimasi setara harga API $${run.result.costUsd.toFixed(3)} (dengan langganan Claude, ini memotong kuota, bukan ditagih). `}
            {run.result?.numTurns ? `${run.result.numTurns} langkah. ` : ""}
            {run.activity?.status === "logged" && "Tercatat di Activity + HANDOFF.md diperbarui. "}
            {run.activity?.status === "failed" && `Gagal mencatat ke Activity: ${run.activity.message || ""} `}
            {run.mode === "edit" && run.status === "done" && "Cek perubahan dengan git diff sebelum commit."}
          </p>
        </div>
      )}
    </div>
  );
}
