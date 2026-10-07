/**
 * Draf instruksi untuk Claude Code yang disusun AI Asisten (tool send_to_claude_code).
 * Server TIDAK menjalankan apa pun: draf dikirim ke browser, lalu pengguna menekan "Jalankan"
 * dan browser meneruskannya ke agent di laptop (127.0.0.1). Murni, diuji di tests/claudeTask.test.ts.
 */

export type ClaudeTaskMode = "edit" | "read";
export type ClaudeTaskModel = "sonnet" | "opus" | "haiku";

export interface ClaudeTaskDraft {
  id: string;
  project: string;
  instruction: string;
  mode: ClaudeTaskMode;
  model: ClaudeTaskModel;
  /** Status run terakhir dari kartu ini (disimpan di riwayat chat). */
  lastRun?: {
    status: "done" | "error" | "stopped" | "timeout";
    summary: string | null;
    files: string[];
    finishedAt: number;
    costUsd: number | null;
  };
}

const MAX_INSTRUCTION = 12000;

/** Validasi argumen tool dari AI. Mengembalikan draf atau pesan error untuk AI. */
export function makeClaudeTask(args: any, seq: number): { draft?: ClaudeTaskDraft; error?: string } {
  const project = String(args?.project || "").trim();
  const instruction = String(args?.instruction || "").trim();
  if (!project) return { error: "project wajib diisi" };
  if (instruction.length < 15) return { error: "instruction terlalu singkat; tulis tujuan, konteks, batasan, dan kriteria selesai" };
  if (instruction.length > MAX_INSTRUCTION) return { error: `instruction maksimal ${MAX_INSTRUCTION} karakter` };
  if (/\[\[RAHASIA_\d+\]\]|🔒\[disimpan aman\]/.test(instruction))
    return { error: "Instruksi tidak boleh berisi rahasia/placeholder. Hapus bagian itu; Claude Code membaca kredensial dari .env project sendiri." };
  const mode: ClaudeTaskMode = args?.mode === "read" ? "read" : "edit";
  const model: ClaudeTaskModel = ["sonnet", "opus", "haiku"].includes(args?.model) ? args.model : "sonnet";
  return { draft: { id: `ct${Date.now().toString(36)}${seq}`, project, instruction, mode, model } };
}

/** Cocokkan nama project draf ke aplikasi di agent (nama project di apps.json claude.project, nama app, atau id). */
export function matchAgentApp(
  project: string,
  apps: { id: string; name: string; claude?: { project?: string } }[]
): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const p = norm(project);
  if (!p) return null;
  const exact = apps.filter((a) => [a.claude?.project, a.name, a.id.replace(/-/g, " ")].some((n) => n && norm(n) === p));
  if (exact.length === 1) return exact[0].id;
  const partial = apps.filter((a) =>
    [a.claude?.project, a.name, a.id.replace(/-/g, " ")].some((n) => n && (norm(n).includes(p) || p.includes(norm(n))))
  );
  return partial.length === 1 ? partial[0].id : null;
}
