"use client";

/**
 * Kartu instruksi Claude Code di chat AI Asisten. AI hanya MENYUSUN instruksi (tool send_to_claude_code);
 * pengguna memeriksa, boleh mengedit, lalu menekan Jalankan. Eksekusi lewat agent di laptop.
 * Status run terakhir disimpan ke riwayat chat (onRun) sehingga tetap terlihat setelah refresh.
 */

import React from "react";
import { Bot, WifiOff, CheckCircle2, XCircle } from "lucide-react";
import { ClaudeRunPanel } from "@/components/local/ClaudeRunPanel";
import { matchAgentApp, type ClaudeTaskDraft } from "@/lib/ai/claudeTask";
import type { ClaudeRun } from "@/lib/local-agent/client";
import { useAgentApps } from "./AttachmentBar";

const LAST_TEXT: Record<NonNullable<ClaudeTaskDraft["lastRun"]>["status"], string> = {
  done: "Selesai",
  error: "Gagal",
  stopped: "Dihentikan",
  timeout: "Melewati batas waktu",
};

/** Ringkas hasil run agent menjadi data yang disimpan di riwayat chat. */
export function toLastRun(run: ClaudeRun): ClaudeTaskDraft["lastRun"] | undefined {
  if (run.status === "idle" || run.status === "running") return undefined;
  return {
    status: run.status,
    summary: run.summary || null,
    files: run.files || [],
    finishedAt: run.finishedAt || Date.now(),
    costUsd: run.result?.costUsd ?? null,
  };
}

export function ClaudeTaskCard({ task, onRun }: { task: ClaudeTaskDraft; onRun?: (run: ClaudeTaskDraft["lastRun"]) => void }) {
  const { apps, state } = useAgentApps(true);
  const appId = matchAgentApp(task.project, apps) || undefined;
  const last = task.lastRun;

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-teal/40 bg-card/90 p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs font-bold text-ink">
        <Bot className="h-4 w-4 text-teal" />
        Instruksi untuk Claude Code · {task.project}
      </div>
      {last && (
        <div className="rounded-btn border border-line bg-glass p-2 text-[11px] text-ink">
          <span className={`inline-flex items-center gap-1 font-semibold ${last.status === "done" ? "text-ok" : "text-red"}`}>
            {last.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            Terakhir dijalankan: {LAST_TEXT[last.status]}
          </span>{" "}
          <span className="text-mute">{new Date(last.finishedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</span>
          {last.summary && <p className="mt-1">{last.summary}</p>}
          {!!last.files.length && <p className="mt-1 text-mute">File: {last.files.join(", ")}</p>}
        </div>
      )}
      {state === "ok" ? (
        <ClaudeRunPanel
          apps={apps}
          appId={appId}
          initialPrompt={task.instruction}
          initialMode={task.mode}
          attach="running"
          onFinished={(run) => {
            const lr = toLastRun(run);
            if (lr) onRun?.(lr);
          }}
        />
      ) : state === "checking" ? (
        <p className="text-xs text-mute">Menghubungi agent di laptop...</p>
      ) : (
        <div className="space-y-2 text-xs">
          <p className="flex items-center gap-1.5 text-orange">
            <WifiOff className="h-3.5 w-3.5" />
            {state === "no-token"
              ? "Token agent belum diisi di browser ini (halaman Work > Lokal > Pengaturan Agent)."
              : "Agent di laptop tidak aktif. Instruksi hanya bisa dijalankan dari laptop dengan agent menyala."}
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-btn border border-line bg-glass p-3 text-ink">{task.instruction}</pre>
        </div>
      )}
    </div>
  );
}
