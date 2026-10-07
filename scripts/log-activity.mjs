#!/usr/bin/env node
/**
 * Kirim catatan pekerjaan ke My Workspace (POST /api/activity). Tanpa dependency, Node 18+.
 * Dipakai oleh AI coding (Antigravity, Claude Code, Cursor) atau manual di terminal.
 *
 * Contoh:
 *   node D:\Project\myworkspace\scripts\log-activity.mjs --project "RapiUang" ^
 *     --summary "Fix bug saldo 0 setelah refresh token" --type bugfix --files "server/src/config/supabase.js" --source antigravity
 *
 * Token (dibuat di My Workspace > Work > Settings > Token API), urutan pencarian:
 *   1. --token <nilai>   2. env MW_TOKEN   3. file %USERPROFILE%\.myworkspace-token (satu baris)
 * Alamat My Workspace: --url, env MW_URL, default http://localhost:3000
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      out[key] = next && !next.startsWith("--") ? (i++, next) : "true";
    }
  }
  return out;
}

const a = args(process.argv.slice(2));
if (!a.project || !a.summary || a.help) {
  console.log(
    'Pakai: node log-activity.mjs --project "Nama Project" --summary "Apa yang dikerjakan" ' +
      "[--type development|bugfix|deployment|review|documentation|testing|meeting|planning|configuration|other] " +
      "[--status completed|in_progress|blocked|cancelled] [--files a.js,b.sql] [--source antigravity] [--app NamaAplikasi] " +
      "[--handoff D:\\Folder\\Project\\HANDOFF.md]"
  );
  process.exit(a.help ? 0 : 1);
}

const tokenFile = path.join(os.homedir(), ".myworkspace-token");
const token =
  a.token || process.env.MW_TOKEN || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf8").trim() : "");
if (!token) {
  console.error(`Token belum ada. Simpan token di ${tokenFile} atau set env MW_TOKEN.`);
  process.exit(1);
}
const url = (a.url || process.env.MW_URL || "http://localhost:3000").replace(/\/+$/, "");

// --handoff [path]: kirim isi HANDOFF.md agar AI Asisten My Workspace tahu kondisi project.
// Tanpa path -> HANDOFF.md di folder kerja saat ini.
let handoff;
if (a.handoff) {
  const hp = path.resolve(a.handoff === "true" ? "HANDOFF.md" : a.handoff);
  if (!fs.existsSync(hp)) {
    console.warn(`Peringatan: file handoff tidak ditemukan (${hp}), aktivitas tetap dicatat tanpa handoff.`);
  } else if (fs.statSync(hp).size > 400 * 1024) {
    console.warn(`Peringatan: ${hp} lebih dari 400 KB, ringkas dulu. Aktivitas tetap dicatat tanpa handoff.`);
  } else {
    handoff = { file_name: path.basename(hp), content: fs.readFileSync(hp, "utf8") };
  }
}

const body = {
  project: a.project,
  summary: a.summary,
  activity_type: a.type || "development",
  status: a.status || "completed",
  files_changed: a.files ? a.files.split(",").map((f) => f.trim()).filter(Boolean) : [],
  source: (a.source || "claude-code").toLowerCase(),
  ...(a.app ? { application: a.app } : {}),
  ...(handoff ? { handoff } : {}),
};

try {
  const res = await fetch(`${url}/api/activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Gagal (${res.status}): ${json.error || res.statusText}`, json.details ? JSON.stringify(json.details) : "");
    process.exit(1);
  }
  console.log(`Tercatat di My Workspace: [${body.project}] ${body.summary}`);
  if (json.handoff?.saved) {
    const extra = json.handoff.redacted ? ` (${json.handoff.redacted} nilai rahasia disamarkan)` : "";
    console.log(`Handoff tersimpan: ${json.handoff.title}${extra}`);
  } else if (json.handoff?.warning) {
    console.warn(`Handoff: ${json.handoff.warning}`);
  }
} catch (e) {
  console.error(`My Workspace tidak dapat dihubungi di ${url}: ${e.message}`);
  process.exit(1);
}
