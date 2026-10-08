/**
 * Ambil FILE ASLI dokumen yang pernah diunggah lewat My Workspace (folder "_Masuk" project di laptop),
 * untuk dikirim balik lewat Telegram. Hanya berhasil bila server berjalan di laptop (mode lokal).
 *
 * Aturan keamanan: hanya file di dalam folder inbox ("_Masuk") milik aplikasi yang terdaftar di
 * agent/apps.json. Path lain (mis. folder kerja, .env, folder Bio Farma di luar inbox) selalu ditolak.
 */

import fs from "fs/promises";
import path from "path";

export const MAX_SEND_BYTES = 45 * 1024 * 1024; // batas kirim Bot API 50 MB
const SEND_EXT = ["pdf", "docx", "doc", "xlsx", "xls", "pptx", "png", "jpg", "jpeg", "txt", "md", "csv"];

const isWin = (p: string) => /^[a-zA-Z]:[\\/]/.test(p);

/** true bila file berada DI DALAM folder root (bukan root itu sendiri), aman terhadap "..". */
export function isInside(file: string, root: string): boolean {
  const P = isWin(file) || isWin(root) ? path.win32 : path.posix;
  const norm = (s: string) => {
    const r = P.resolve(s);
    return P === path.win32 ? r.toLowerCase() : r;
  };
  const f = norm(file);
  const r = norm(root).replace(/[\\/]+$/, "");
  return f.startsWith(r + P.sep) && f.length > r.length + 1;
}

/** Folder inbox semua aplikasi di apps.json: <folder app>\<inboxName>. */
export function inboxRoots(cfg: any): string[] {
  const inbox = String(cfg?.inboxName || "_Masuk");
  const out: string[] = [];
  for (const app of Array.isArray(cfg?.apps) ? cfg.apps : []) {
    const folder = app?.folder || app?.processes?.[0]?.cwd;
    if (!folder) continue;
    const P = isWin(folder) ? path.win32 : path.posix;
    out.push(P.join(folder, inbox));
  }
  return out;
}

async function loadAppsConfig(): Promise<any | null> {
  const p = process.env.MW_AGENT_APPS || path.join(process.cwd(), "agent", "apps.json");
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

export type OriginalResult = { ok: true; data: Buffer; name: string } | { ok: false; reason: string };

export async function readLocalOriginal(filePath: string, cfg?: any): Promise<OriginalResult> {
  const p = String(filePath || "").trim();
  if (!p) return { ok: false, reason: "Lokasi file asli tidak tercatat" };
  const conf = cfg ?? (await loadAppsConfig());
  if (!conf) return { ok: false, reason: "File asli ada di laptop (bot sedang berjalan di server, bukan di laptop)" };
  const roots = inboxRoots(conf);
  if (!roots.some((r) => isInside(p, r))) return { ok: false, reason: "File asli bukan dari folder unggahan My Workspace (_Masuk), tidak dikirim" };
  const P = isWin(p) ? path.win32 : path.posix;
  const name = P.basename(p);
  const ext = name.toLowerCase().split(".").pop() || "";
  if (!SEND_EXT.includes(ext)) return { ok: false, reason: `Jenis file .${ext} tidak dikirim lewat bot` };
  if (isWin(p) && process.platform !== "win32") return { ok: false, reason: "File asli ada di laptop (bot sedang berjalan di server, bukan di laptop)" };
  try {
    const real = await fs.realpath(p);
    if (!roots.some((r) => isInside(real, r))) return { ok: false, reason: "File asli bukan dari folder unggahan My Workspace (_Masuk), tidak dikirim" };
    const st = await fs.stat(real);
    if (!st.isFile()) return { ok: false, reason: "Bukan file" };
    if (st.size > MAX_SEND_BYTES) return { ok: false, reason: "File asli lebih dari 45 MB" };
    return { ok: true, data: await fs.readFile(real), name };
  } catch {
    return { ok: false, reason: "File asli tidak ditemukan lagi di laptop (sudah dipindah/dihapus?)" };
  }
}
