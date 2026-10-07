"use client";

/**
 * Lampiran file di chat AI.
 * - File dikirim LANGSUNG dari browser ke My Workspace Agent di laptop -> <folder project>\_Masuk.
 * - Isi file dibaca DI BROWSER (PDF/Word/Excel/teks). Hanya teksnya yang dikirim ke AI, dan hanya
 *   bila "Baca isi" dicentang. AI lalu menyimpan fakta penting (NIB, NPWP, dll) sebagai catatan dokumen.
 */

import React, { useEffect, useState } from "react";
import { FileText, Loader2, X, AlertTriangle, CheckCircle2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  agent,
  formatBytes,
  loadAgentSettings,
  type LocalApp,
  type UploadResult,
} from "@/lib/local-agent/client";
import { canExtract, estimateTokens, extractText, type ExtractResult } from "@/lib/files/extractText";
import { buildFileBlock } from "@/lib/ai/fileBlocks";

export interface PendingFile {
  id: string;
  file: File;
  progress: number; // 0..1
  status: "ready" | "uploading" | "done" | "error";
  error?: string;
  result?: UploadResult;
  read: boolean; // izinkan AI membaca isi
  extract?: ExtractResult | "loading";
}

export type AgentState = "checking" | "ok" | "offline" | "no-token";

// Perkiraan biaya input gpt-4o-mini: $0.15 / 1 juta token, kurs ~Rp 16.500
const IDR_PER_TOKEN = (0.15 / 1_000_000) * 16500;

export function newPendingFile(file: File): PendingFile {
  return {
    id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    progress: 0,
    status: "ready",
    read: canExtract(file.name),
    extract: canExtract(file.name) ? "loading" : undefined,
  };
}

/** Jalankan ekstraksi untuk file yang baru ditambahkan. */
export function useExtraction(files: PendingFile[], update: (id: string, patch: Partial<PendingFile>) => void) {
  useEffect(() => {
    for (const f of files) {
      if (f.extract === "loading" && !(f as any)._started) {
        (f as any)._started = true;
        extractText(f.file).then((r) => update(f.id, { extract: r, read: f.read && r.ok }));
      }
    }
  }, [files, update]);
}

/** Daftar aplikasi dari agent (untuk pilihan "Simpan ke"). */
export function useAgentApps(enabled: boolean) {
  const [apps, setApps] = useState<LocalApp[]>([]);
  const [state, setState] = useState<AgentState>("checking");
  useEffect(() => {
    if (!enabled) return;
    const s = loadAgentSettings();
    if (!s.token) {
      setState("no-token");
      return;
    }
    setState("checking");
    agent
      .list(s)
      .then((list) => {
        setApps(list);
        setState("ok");
      })
      .catch(() => setState("offline"));
  }, [enabled]);
  return { apps, state };
}

/** Total token isi file yang akan dikirim ke AI. */
export function readTokens(files: PendingFile[]) {
  return files.reduce((s, f) => (f.read && f.extract && f.extract !== "loading" && f.extract.ok ? s + estimateTokens(f.extract.chars) : s), 0);
}

/**
 * Upload berurutan ke agent; mengembalikan teks untuk AI:
 * ringkasan lokasi file + blok [ISI FILE] untuk file yang diizinkan dibaca.
 */
export async function uploadAll(
  files: PendingFile[],
  appId: string,
  update: (id: string, patch: Partial<PendingFile>) => void
): Promise<string> {
  const s = loadAgentSettings();
  const lines: string[] = [];
  const blocks: string[] = [];
  let appName = "";
  for (const pf of files) {
    update(pf.id, { status: "uploading", progress: 0 });
    try {
      const r = await agent.uploadFile(s, appId, pf.file, (p) => update(pf.id, { progress: p }));
      appName = r.app;
      update(pf.id, { status: "done", progress: 1, result: r });
      lines.push(`- ${r.savedAs} (${formatBytes(r.bytes)}) → ${r.path}`);
      if (pf.read && pf.extract && pf.extract !== "loading" && pf.extract.ok) {
        blocks.push(buildFileBlock({ name: r.savedAs, project: r.app, path: r.path }, pf.extract.text));
      }
    } catch (e) {
      update(pf.id, { status: "error", error: (e as Error).message });
      lines.push(`- GAGAL: ${pf.file.name} (${(e as Error).message})`);
    }
  }
  return [`📎 File dikirim ke folder project ${appName || appId}:\n${lines.join("\n")}`, ...blocks].join("\n\n");
}

export function AttachmentBar({
  files,
  onRemove,
  onToggleRead,
  apps,
  agentState,
  targetId,
  onTargetChange,
  disabled,
}: {
  files: PendingFile[];
  onRemove: (id: string) => void;
  onToggleRead: (id: string, read: boolean) => void;
  apps: LocalApp[];
  agentState: AgentState;
  targetId: string;
  onTargetChange: (id: string) => void;
  disabled?: boolean;
}) {
  if (files.length === 0) return null;
  const tokens = readTokens(files);
  return (
    <div className="border-t border-line bg-card/60 px-4 py-2.5 space-y-2">
      <div className="flex flex-wrap gap-2">
        {files.map((f) => {
          const ex = f.extract;
          const readable = ex && ex !== "loading" && ex.ok;
          return (
            <span
              key={f.id}
              title={f.error || f.result?.path || (ex && ex !== "loading" && !ex.ok ? ex.reason : f.file.name)}
              className={cn(
                "relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border px-3 py-1 text-[11px]",
                f.status === "error" ? "border-red/40 text-red" : "border-line text-ink"
              )}
            >
              {f.status === "uploading" && (
                <span className="absolute inset-y-0 left-0 bg-teal/15" style={{ width: `${Math.round(f.progress * 100)}%` }} />
              )}
              <span className="relative inline-flex items-center gap-1.5">
                {f.status === "uploading" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : f.status === "done" ? (
                  <CheckCircle2 className="h-3 w-3 text-ok" />
                ) : f.status === "error" ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <FileText className="h-3 w-3 text-teal" />
                )}
                <span className="max-w-[160px] truncate">{f.file.name}</span>
                <span className="text-mute">{formatBytes(f.file.size)}</span>

                {/* Izin baca isi */}
                {ex === "loading" && <Loader2 className="h-3 w-3 animate-spin text-mute" />}
                {readable && (
                  <label className="inline-flex items-center gap-1 rounded-full bg-teal/10 px-1.5 text-teal cursor-pointer">
                    <input
                      type="checkbox"
                      checked={f.read}
                      disabled={disabled || f.status !== "ready"}
                      onChange={(e) => onToggleRead(f.id, e.target.checked)}
                      className="h-3 w-3"
                    />
                    <BookOpen className="h-3 w-3" />
                    baca ~{estimateTokens((ex as any).chars).toLocaleString("id-ID")} token
                    {(ex as any).truncated ? " (dipotong)" : ""}
                  </label>
                )}
                {ex && ex !== "loading" && !ex.ok && <span className="text-mute italic">tidak dibaca</span>}

                {f.status === "ready" && !disabled && (
                  <button type="button" onClick={() => onRemove(f.id)} aria-label="Hapus lampiran">
                    <X className="h-3 w-3 text-mute hover:text-ink" />
                  </button>
                )}
              </span>
            </span>
          );
        })}
      </div>

      {tokens > 0 && (
        <p className="text-[11px] text-mute">
          Isi file yang dibaca AI: ~{tokens.toLocaleString("id-ID")} token ≈ Rp {Math.max(1, Math.round(tokens * IDR_PER_TOKEN))}.
          Fakta penting (mis. NIB) akan disimpan sebagai catatan dokumen project.
        </p>
      )}

      {agentState === "ok" && (
        <label className="flex items-center gap-2 text-[11px] text-mute">
          <span className="font-semibold text-ink">Simpan ke:</span>
          <select
            value={targetId}
            onChange={(e) => onTargetChange(e.target.value)}
            disabled={disabled}
            className="h-7 rounded-full border border-line bg-card px-2 text-[11px] text-ink focus:border-teal focus:outline-none"
          >
            <option value="">-- pilih project --</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="truncate">
            {targetId ? `→ ${apps.find((a) => a.id === targetId)?.inbox || ""}` : "(otomatis bila nama project disebut di pesan)"}
          </span>
        </label>
      )}
      {agentState === "checking" && (
        <p className="flex items-center gap-1.5 text-[11px] text-mute">
          <Loader2 className="h-3 w-3 animate-spin" /> Menghubungi agent...
        </p>
      )}
      {(agentState === "offline" || agentState === "no-token") && (
        <p className="flex items-center gap-1.5 text-[11px] text-red">
          <AlertTriangle className="h-3 w-3" />
          {agentState === "no-token"
            ? "Token agent belum diatur. Buka Work > Lokal > Pengaturan Agent."
            : "Agent tidak aktif. File hanya bisa dikirim dari laptop dengan agent menyala (Work > Lokal > Nyalakan Agent)."}
        </p>
      )}
    </div>
  );
}
