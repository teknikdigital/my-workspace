/**
 * Commit & push otomatis hasil Claude Code (job antrian Telegram).
 * ------------------------------------------------------------------
 * Claude sendiri TIDAK boleh menjalankan git commit/push (lihat DENY_SHELL di claude.cjs).
 * Agent yang melakukannya, dengan pengaman berlapis:
 *   1. snapshot()  sebelum Claude jalan: catat branch, HEAD, dan isi file yang sudah berubah (belum di-commit).
 *   2. finalize()  setelah Claude selesai:
 *      - hanya file yang diubah Claude yang di-commit; perubahan Anda yang belum di-commit tidak ikut;
 *      - bila Claude mengubah file yang sebelumnya sudah Anda ubah -> TIDAK di-commit (perlu dicek manual);
 *      - file rahasia (.env, kunci, token) dan pola rahasia di baris baru -> TIDAK di-commit;
 *      - perintah verifikasi (tsc / test) wajib lulus;
 *      - push tanpa --force; bila ditolak remote, commit tetap ada di laptop.
 *
 * Konfigurasi per app di apps.json:
 *   "claude": { "mode": "edit", "git": {
 *       "autoCommit": true,          // wajib true agar aktif
 *       "push": true,                // false = commit saja
 *       "repo": "main-app/app",      // folder repo relatif ke folder app (default: folder app)
 *       "verify": ["npx tsc --noEmit", "npm test"]  // default: otomatis (tsc bila ada tsconfig, npm test bila ada)
 *   } }
 * Per perintah: "jangan commit" / "tanpa commit" -> dilewati; "jangan push" / "tanpa push" -> commit saja.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const MAX_FILES = 200;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const VERIFY_TIMEOUT_MS = 10 * 60 * 1000;
const GIT_TIMEOUT_MS = 2 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Konfigurasi & opsi per perintah                                      */
/* ------------------------------------------------------------------ */
function gitConfig(app) {
  const c = app && app.claude;
  if (!c || c.mode !== "edit" || !c.git || c.git.autoCommit !== true) return null;
  const folder = app.folder || (app.processes && app.processes[0] && app.processes[0].cwd);
  if (!folder) return null;
  return {
    repo: c.git.repo ? path.resolve(folder, c.git.repo) : folder,
    push: c.git.push !== false,
    verify: Array.isArray(c.git.verify) ? c.git.verify.filter((v) => typeof v === "string" && v.trim()) : null,
  };
}

/** Opsi dari teks instruksi: { commit, push }. */
function jobGitOptions(instruction) {
  const t = String(instruction || "").toLowerCase();
  const noCommit = /\b(jangan|tanpa|tidak usah|gak usah|ga usah|no)\s+(di)?commit/.test(t);
  const noPush = noCommit || /\b(jangan|tanpa|tidak usah|gak usah|ga usah|no)\s+(di)?push/.test(t);
  return { commit: !noCommit, push: !noPush };
}

/* ------------------------------------------------------------------ */
/* Aturan file & rahasia                                                */
/* ------------------------------------------------------------------ */
const SAFE_ENV = /(^|\/)\.env\.(example|sample|template)$/i;
const SENSITIVE_PATH = [
  /(^|\/)\.env(\.[^/]*)?$/i, // .env, .env.local, .env.production
  /(^|\/)[^/]*\.env$/i, // vercel.env, prod.env
  /\.(pem|key|p12|pfx|keystore|jks)$/i,
  /(^|\/)id_(rsa|ed25519|ecdsa)(\.pub)?$/i,
  /(^|\/)\.agent-token$/i,
  /(^|\/)\.myworkspace-token$/i,
  /(^|\/)(credentials|service-account)[^/]*\.json$/i,
];
function isSensitivePath(p) {
  const s = String(p).replace(/\\/g, "/");
  if (SAFE_ENV.test(s)) return false;
  return SENSITIVE_PATH.some((r) => r.test(s));
}

const SECRET_PATTERNS = [
  { name: "OpenAI key", re: /\bsk-(proj-|svcacct-)?[A-Za-z0-9_-]{24,}/ },
  { name: "Anthropic key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "JWT (mis. Supabase service role)", re: /\beyJhbGciOi[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: "AWS key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "token bot Telegram", re: /\b\d{8,10}:AA[A-Za-z0-9_-]{30,}\b/ },
];
/** Cari pola rahasia di baris-baris baru. Mengembalikan daftar { file, name }. */
function findSecrets(addedByFile) {
  const hits = [];
  for (const [file, lines] of Object.entries(addedByFile)) {
    for (const p of SECRET_PATTERNS) if (lines.some((l) => p.re.test(l))) hits.push({ file, name: p.name });
  }
  return hits;
}

/* ------------------------------------------------------------------ */
/* Utilitas proses                                                      */
/* ------------------------------------------------------------------ */
function run(cmd, args, { cwd, timeoutMs = GIT_TIMEOUT_MS, shell = false, env } = {}) {
  return new Promise((resolve) => {
    let out = "";
    let done = false;
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        shell,
        windowsHide: true,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", CI: "true", ...(env || {}) },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      return resolve({ code: -1, out: e.message });
    }
    const add = (d) => {
      out += d.toString("utf8");
      if (out.length > 200000) out = out.slice(-100000);
    };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    const timer = setTimeout(() => {
      if (done) return;
      out += `\n[dihentikan: melewati ${Math.round(timeoutMs / 1000)} detik]`;
      try {
        if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
        else child.kill("SIGKILL");
      } catch (_) {
        /* abaikan */
      }
    }, timeoutMs);
    child.on("error", (e) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code: -1, out: `${out}\n${e.message}`.trim() });
    });
    child.on("close", (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code: code == null ? -1 : code, out });
    });
  });
}
const git = (repo, args, opts = {}) => run("git", args, { cwd: repo, ...opts });
const tail = (s, n = 1200) => {
  const t = String(s || "").trim();
  return t.length > n ? `…${t.slice(-n)}` : t;
};

/** Parse `git status --porcelain=v1 -z`: daftar path (rename: path baru & lama). */
function parsePorcelainZ(out) {
  const parts = String(out || "").split("\0");
  const paths = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (!e || e.length < 4) continue;
    const xy = e.slice(0, 2);
    paths.push(e.slice(3));
    if (xy[0] === "R" || xy[0] === "C") {
      if (parts[i + 1]) paths.push(parts[i + 1]);
      i++;
    }
  }
  return [...new Set(paths)];
}

function fileHash(repo, rel) {
  const abs = path.join(repo, rel);
  try {
    const st = fs.statSync(abs);
    if (st.isDirectory()) return "dir";
    if (st.size > 20 * 1024 * 1024) return `big:${st.size}:${st.mtimeMs}`;
    return crypto.createHash("sha1").update(fs.readFileSync(abs)).digest("hex");
  } catch (_) {
    return "missing";
  }
}

async function dirtyMap(repo) {
  const st = await git(repo, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (st.code !== 0) return { error: tail(st.out, 300) };
  const map = new Map();
  for (const p of parsePorcelainZ(st.out)) map.set(p, fileHash(repo, p));
  return { map };
}

/** Perintah verifikasi default: tsc bila ada tsconfig, npm test bila script test ada. */
function defaultVerify(repo) {
  const cmds = [];
  if (fs.existsSync(path.join(repo, "tsconfig.json"))) cmds.push("npx tsc --noEmit");
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8"));
    const t = pkg.scripts && pkg.scripts.test;
    if (t && !/no test specified/i.test(t)) cmds.push("npm test");
  } catch (_) {
    /* tanpa package.json */
  }
  return cmds;
}

function commitMessage({ summary, instruction, jobId }) {
  const title = `claude: ${String(summary || "perubahan dari Telegram").replace(/\s+/g, " ").trim()}`.slice(0, 100);
  const body = [
    `Instruksi (Telegram): ${String(instruction || "").replace(/\s+/g, " ").trim().slice(0, 500)}`,
    jobId ? `Job: ${jobId}` : "",
    "",
    "Co-Authored-By: Claude <noreply@anthropic.com>",
  ]
    .filter((l, i, a) => l || a[i - 1])
    .join("\n");
  return { title, body };
}

/* ------------------------------------------------------------------ */
/* Snapshot & finalize                                                  */
/* ------------------------------------------------------------------ */
/** Sebelum Claude jalan. Mengembalikan { ok, ... } atau { skip: alasan }. */
async function snapshot(cfg) {
  if (!cfg) return { skip: "nonaktif" };
  if (!fs.existsSync(path.join(cfg.repo, ".git"))) return { skip: `folder ${cfg.repo} bukan repo git` };
  const branch = await git(cfg.repo, ["symbolic-ref", "--short", "-q", "HEAD"]);
  if (branch.code !== 0 || !branch.out.trim()) return { skip: "repo dalam kondisi detached HEAD" };
  const head = await git(cfg.repo, ["rev-parse", "HEAD"]);
  const d = await dirtyMap(cfg.repo);
  if (d.error) return { skip: `git status gagal: ${d.error}` };
  // index yang sudah di-stage oleh Anda tidak akan ikut ter-commit (commit memakai --only <path>)
  return { ok: true, branch: branch.out.trim(), head: head.code === 0 ? head.out.trim() : null, dirty: d.map };
}

/**
 * Setelah Claude selesai (status done). Mengembalikan { status, text, commit?, pushed? }.
 * status: skipped | nochange | blocked | committed | pushed | push-failed | failed
 */
async function finalize(cfg, snap, { jobId, instruction, summary, opts }) {
  const o = opts || jobGitOptions(instruction);
  if (!cfg || !snap || !snap.ok) return { status: "skipped", text: snap && snap.skip && snap.skip !== "nonaktif" ? `ℹ️ Commit otomatis dilewati: ${snap.skip}.` : "" };
  if (!o.commit) return { status: "skipped", text: "ℹ️ Sesuai instruksi, perubahan tidak di-commit." };

  const branch = await git(cfg.repo, ["symbolic-ref", "--short", "-q", "HEAD"]);
  if (branch.out.trim() !== snap.branch)
    return { status: "blocked", text: `⚠️ Tidak di-commit: branch berubah selama proses (${snap.branch} → ${branch.out.trim() || "detached"}).` };

  const after = await dirtyMap(cfg.repo);
  if (after.error) return { status: "failed", text: `⚠️ Tidak di-commit: git status gagal (${after.error}).` };

  const mine = [];
  const overlap = [];
  for (const [p, h] of after.map) {
    if (!snap.dirty.has(p)) mine.push(p);
    else if (snap.dirty.get(p) !== h) overlap.push(p);
  }
  for (const [p, h] of snap.dirty) if (!after.map.has(p) && h !== "missing") overlap.push(p);

  if (overlap.length)
    return {
      status: "blocked",
      text: `⚠️ Tidak di-commit: Claude mengubah file yang sudah Anda ubah sebelumnya (belum di-commit): ${overlap.slice(0, 8).join(", ")}${overlap.length > 8 ? ", …" : ""}. Cek dengan git diff lalu commit manual.`,
    };
  const files = mine.filter((p) => !p.endsWith("/"));
  if (!files.length) return { status: "nochange", text: "ℹ️ Tidak ada perubahan file untuk di-commit." };
  if (files.length > MAX_FILES) return { status: "blocked", text: `⚠️ Tidak di-commit: ${files.length} file berubah (batas ${MAX_FILES}). Cek manual.` };

  const sensitive = files.filter(isSensitivePath);
  if (sensitive.length) return { status: "blocked", text: `⚠️ Tidak di-commit: ada file rahasia yang berubah (${sensitive.join(", ")}).` };
  const big = files.filter((p) => {
    try {
      return fs.statSync(path.join(cfg.repo, p)).size > MAX_FILE_BYTES;
    } catch (_) {
      return false;
    }
  });
  if (big.length) return { status: "blocked", text: `⚠️ Tidak di-commit: file lebih dari 5 MB (${big.join(", ")}).` };

  // baris baru (file lama: dari git diff; file baru: seluruh isi)
  const added = {};
  const tracked = await git(cfg.repo, ["ls-files", "-z", "--", ...files]);
  const trackedSet = new Set(String(tracked.out || "").split("\0").filter(Boolean));
  for (const f of files) {
    if (trackedSet.has(f)) continue;
    try {
      added[f] = fs.readFileSync(path.join(cfg.repo, f), "utf8").split(/\r?\n/);
    } catch (_) {
      /* terhapus / bukan teks */
    }
  }
  if (trackedSet.size) {
    const diff = await git(cfg.repo, ["diff", "--no-color", "--no-ext-diff", "-U0", "HEAD", "--", ...trackedSet]);
    let cur = null;
    for (const line of String(diff.out || "").split(/\r?\n/)) {
      const m = line.match(/^\+\+\+ b\/(.+)$/);
      if (m) {
        cur = m[1];
        added[cur] = added[cur] || [];
      } else if (cur && line.startsWith("+") && !line.startsWith("+++")) added[cur].push(line.slice(1));
    }
  }
  const secrets = findSecrets(added);
  if (secrets.length)
    return { status: "blocked", text: `⚠️ Tidak di-commit: terdeteksi pola rahasia (${secrets.map((s) => `${s.name} di ${s.file}`).join(", ")}).` };

  // verifikasi
  const verify = cfg.verify || defaultVerify(cfg.repo);
  for (const cmd of verify) {
    const r = await run(cmd, [], { cwd: cfg.repo, shell: true, timeoutMs: VERIFY_TIMEOUT_MS });
    if (r.code !== 0)
      return { status: "blocked", text: `⚠️ Tidak di-commit: verifikasi \`${cmd}\` gagal.\n\`\`\`\n${tail(r.out, 1500)}\n\`\`\`` };
  }

  // commit hanya file milik Claude
  const add = await git(cfg.repo, ["add", "-A", "--", ...files]);
  if (add.code !== 0) return { status: "failed", text: `⚠️ git add gagal: ${tail(add.out, 400)}` };
  const msg = commitMessage({ summary, instruction, jobId });
  const c = await git(cfg.repo, ["commit", "-m", msg.title, "-m", msg.body, "--only", "--", ...files]);
  if (c.code !== 0) {
    const who = /tell me who you are|user\.email|user\.name/i.test(c.out);
    return {
      status: "failed",
      text: who
        ? "⚠️ git commit gagal: identitas git belum diatur. Jalankan sekali di PowerShell: git config --global user.name \"Nama\" dan git config --global user.email \"email\"."
        : `⚠️ git commit gagal:\n\`\`\`\n${tail(c.out, 600)}\n\`\`\``,
    };
  }
  const sha = (await git(cfg.repo, ["rev-parse", "--short", "HEAD"])).out.trim();
  const verified = verify.length ? `, lulus ${verify.join(" + ")}` : ", tanpa perintah verifikasi";
  const base = `📦 Commit \`${sha}\` di ${snap.branch} (${files.length} file${verified}).`;
  const undo = `Batalkan: git revert ${sha}`;

  if (!cfg.push || !o.push) return { status: "committed", commit: sha, text: `${base}\nBelum di-push${!o.push ? " (sesuai instruksi)" : ""}. ${undo}` };
  const remote = await git(cfg.repo, ["remote"]);
  if (!/\borigin\b/.test(remote.out)) return { status: "committed", commit: sha, text: `${base}\nRepo tanpa remote origin, tidak di-push. ${undo}` };
  const p = await git(cfg.repo, ["push", "origin", `HEAD:refs/heads/${snap.branch}`]);
  if (p.code !== 0) {
    const behind = /rejected|non-fast-forward|fetch first/i.test(p.out);
    return {
      status: "push-failed",
      commit: sha,
      text: `${base}\n⚠️ Push gagal${behind ? ": remote punya commit yang belum ada di laptop (jalankan git pull --rebase lalu git push)" : `:\n\`\`\`\n${tail(p.out, 500)}\n\`\`\``}. Commit tetap ada di laptop.`,
    };
  }
  return { status: "pushed", commit: sha, pushed: true, text: `${base}\n🚀 Di-push ke origin/${snap.branch}. ${undo} lalu git push.` };
}

module.exports = {
  gitConfig,
  jobGitOptions,
  isSensitivePath,
  findSecrets,
  parsePorcelainZ,
  defaultVerify,
  commitMessage,
  snapshot,
  finalize,
  run,
};
