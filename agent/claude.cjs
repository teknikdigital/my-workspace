/**
 * Claude Code runner untuk My Workspace Agent.
 * ------------------------------------------------------------------
 * Menjalankan `claude -p` (mode non-interaktif) di folder project, memantau
 * progres lewat --output-format stream-json, dan menyimpan hasil per aplikasi.
 *
 * Keamanan:
 *  - Hanya folder project yang terdaftar di apps.json (web tidak bisa memilih folder bebas).
 *  - Mode "read" (dontAsk): Claude hanya membaca. Mode "edit" (acceptEdits): boleh mengubah
 *    file di folder project + menjalankan perintah di daftar ALLOWED saja.
 *  - Project dengan "claude": { "mode": "read" } di apps.json terkunci baca saja.
 *  - Variabel ANTHROPIC_* dibuang dari env agar selalu memakai login langganan Claude Code,
 *    kecuali app memakai "claude.settings" (mis. router) secara eksplisit.
 *  - .env tidak boleh dibaca Claude (rahasia tidak terkirim).
 *
 * Fungsi murni (buildArgs, parseStreamLine, extractSummary, ...) diuji di tests/agentClaude.test.ts.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const MAX_EVENTS = 400;
const MAX_PROMPT = 20000;
const MODELS = ["sonnet", "opus", "haiku"];

/* ------------------------------------------------------------------ */
/* Izin perintah                                                       */
/* ------------------------------------------------------------------ */
// Laptop tanpa Git Bash memakai tool PowerShell, dengan Git Bash memakai Bash: aturan dibuat untuk keduanya.
const shellRules = (cmds) => cmds.flatMap((c) => [`Bash(${c})`, `PowerShell(${c})`]);

const READ_SHELL = [
  "Get-ChildItem *",
  "Get-Content *",
  "Select-String *",
  "Select-Object *",
  "Where-Object *",
  "Sort-Object *",
  "Measure-Object *",
  "Test-Path *",
  "Get-Location",
  "git status *",
  "git diff *",
  "git log *",
  "git show *",
  "git branch *",
  "ls *",
  "cat *",
  "grep *",
  "head *",
  "tail *",
  "wc *",
  "find *",
  "sed -n *",
  "echo *",
  "pwd",
  "cd *",
  "Set-Location *",
];
const EDIT_SHELL = [
  "npm run lint *",
  "npm run test *",
  "npm test *",
  "npm run build *",
  "npm run typecheck *",
  "npx tsc *",
  "npx eslint *",
  "npx vitest *",
  "node --check *",
  "npx vite build *",
  // Menjalankan script uji buatan Claude sendiri (mis. generate PDF contoh). Setara risikonya dengan
  // npm run test: kode di folder project dieksekusi. Hanya di mode edit; project Bio Farma terkunci baca saja.
  "node *",
  "New-Item *",
  "mkdir *",
];
const DENY_SHELL = [
  "git push *",
  "git reset *",
  "git clean *",
  "git checkout *",
  "npm run dev *",
  "npm start *",
  "npm install *",
  "npm i *",
  "rm *",
  "Remove-Item *",
  "del *",
  "rmdir *",
];
// Rahasia project tidak boleh terbaca (dan tidak terkirim ke model)
const DENY_READ = [
  "Read(./**/.env)",
  "Read(./**/.env.local)",
  "Read(./**/.env.development)",
  "Read(./**/.env.production)",
  "Read(./**/.env.*.local)",
  "Read(./**/.agent-token)",
];

function allowedTools(mode) {
  const base = ["Read", "Glob", "Grep", ...shellRules(READ_SHELL)];
  return mode === "edit" ? [...base, "Edit", "Write", ...shellRules(EDIT_SHELL)] : base;
}
/**
 * Path absolut ke bentuk aturan izin Claude Code: Windows "D:\\Rally District" -> "//d/Rally District"
 * (Claude Code menormalkan path Windows ke bentuk POSIX /d/...; awalan // = absolut).
 */
function absRuleRoot(dir) {
  const s = String(dir || "").replace(/\\/g, "/").replace(/\/+$/, "");
  const m = s.match(/^([a-zA-Z]):\/(.*)$/);
  if (m) return `//${m[1].toLowerCase()}/${m[2]}`;
  return s.startsWith("/") ? `/${s}` : null;
}

/** Larangan baca .env & token di folder tambahan (--add-dir); aturan "./**" hanya berlaku di folder utama. */
function denyReadFor(dirs) {
  const out = [];
  for (const d of dirs || []) {
    const root = absRuleRoot(d);
    if (!root) continue;
    for (const f of [".env", ".env.local", ".env.development", ".env.production", ".env.*.local", ".agent-token"]) out.push(`Read(${root}/**/${f})`);
  }
  return out;
}

function disallowedTools(mode, addDirs) {
  const d = [...shellRules(DENY_SHELL), ...DENY_READ, ...denyReadFor(addDirs), "WebFetch", "WebSearch"];
  return mode === "edit" ? d : [...d, "Edit", "Write", "NotebookEdit"];
}

/* ------------------------------------------------------------------ */
/* Instruksi tambahan untuk setiap run                                 */
/* ------------------------------------------------------------------ */
function runRules(mode) {
  const common = [
    "Kamu dijalankan otomatis oleh My Workspace atas perintah pemilik project (Stratt). Tidak ada orang yang bisa menjawab pertanyaan selama proses ini.",
    "Kerjakan instruksi sampai tuntas tanpa bertanya. Bila ada keputusan yang ambigu dan sulit dibalik, JANGAN dieksekusi: jelaskan pilihannya di jawaban akhir.",
    "Bila ada HANDOFF.md di root project, baca dulu untuk memahami kondisi terkini.",
    "Jangan menjalankan dev server (npm run dev / npm start), npm install, git push/reset/checkout, atau perintah yang menghapus data. Jangan membaca file .env.",
  ];
  const edit = [
    "Setelah mengubah kode, verifikasi dengan perintah yang tersedia (npm run lint / npm run test / npm run build / npx tsc) bila relevan untuk project ini.",
    "Setelah selesai, perbarui HANDOFF.md di root project (buat bila belum ada) dengan bagian: Ringkasan, Lokasi & Stack, Cara Menjalankan, Status Fitur, Keputusan Teknis, Masalah Diketahui, Langkah Berikutnya, Riwayat Perubahan (tambah 1 baris paling atas: tanggal hari ini + ringkasan + file utama, maksimal 30 baris). Jangan pernah menulis nilai password/API key/token/isi .env, cukup nama variabelnya.",
  ];
  const read = ["MODE BACA SAJA: jangan mengubah, membuat, atau menghapus file apa pun. Cukup analisis dan beri rekomendasi."];
  const answer = [
    "Jawaban akhir dalam Bahasa Indonesia dan ringkas: apa yang dikerjakan (sebut file), hasil verifikasi, dan hal yang perlu dicek pemilik project.",
    "Baris TERAKHIR jawaban wajib berformat: RINGKASAN: <satu kalimat untuk catatan aktivitas>",
  ];
  return [...common, ...(mode === "edit" ? edit : read), ...answer].map((l) => `- ${l}`).join("\n");
}

/* ------------------------------------------------------------------ */
/* Argumen CLI                                                          */
/* ------------------------------------------------------------------ */
/**
 * Susun argumen `claude`. Prompt tepat setelah -p (sebelum opsi daftar seperti --allowedTools
 * yang menerima banyak nilai), sesuai contoh resmi `claude -p "..." --allowedTools "..."`.
 */
function buildArgs({ prompt, mode, model, resume, settings, addDirs }) {
  const args = [
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    model,
    "--permission-mode",
    mode === "edit" ? "acceptEdits" : "dontAsk",
    "--permission-prompts",
    "none",
    "--append-system-prompt",
    runRules(mode),
  ];
  if (resume) args.push("--resume", resume);
  if (settings) args.push("--settings", settings);
  for (const d of addDirs || []) args.push("--add-dir", d);
  args.push("--disallowedTools", disallowedTools(mode, addDirs).join(","));
  args.push("--allowedTools", allowedTools(mode).join(","));
  return args;
}

/** Validasi permintaan dari web. Mengembalikan { error } atau opsi yang sudah dirapikan. */
function normalizeRequest(body, appCfg, globalCfg) {
  const prompt = String((body && body.prompt) || "").trim();
  if (!prompt) return { error: "Instruksi (prompt) wajib diisi" };
  if (prompt.length > MAX_PROMPT) return { error: `Instruksi terlalu panjang (maks ${MAX_PROMPT} karakter)` };
  if (/\[\[RAHASIA_\d+\]\]|🔒\[disimpan aman\]/.test(prompt))
    return { error: "Instruksi berisi data rahasia yang disamarkan. Hapus bagian itu, Claude Code tidak boleh menerima rahasia." };
  const locked = ((appCfg && appCfg.mode) || "read") === "read";
  const mode = body.mode === "edit" ? "edit" : "read";
  if (mode === "edit" && locked)
    return { error: "Project ini dikunci BACA SAJA untuk Claude Code (apps.json: claude.mode = \"read\")." };
  const model = MODELS.includes(body.model) ? body.model : (globalCfg && globalCfg.defaultModel) || "sonnet";
  const resume = typeof body.resume === "string" && /^[0-9a-f-]{8,64}$/i.test(body.resume) ? body.resume : null;
  // Folder tambahan yang boleh dibaca Claude (koleksi project), mis. ["D:\\Rally District"]
  const addDirs = Array.isArray(appCfg && appCfg.addDirs)
    ? appCfg.addDirs.filter((d) => typeof d === "string" && /^([a-zA-Z]:[\\/]|\/)/.test(d)).slice(0, 10)
    : [];
  return { prompt, mode, model, resume, settings: (appCfg && appCfg.settings) || null, addDirs };
}

/** Lokasi claude.exe: apps.json claude.path, lalu instalasi native, lalu PATH. */
function resolveClaudePath(globalCfg) {
  if (globalCfg && globalCfg.path) return globalCfg.path;
  const native = path.join(os.homedir(), ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude");
  return fs.existsSync(native) ? native : "claude";
}

/** Env untuk proses claude: buang ANTHROPIC_* agar memakai login langganan (kecuali pakai settings khusus). */
function claudeEnv(baseEnv, keepAnthropic) {
  const env = { ...baseEnv, FORCE_COLOR: "0", NO_COLOR: "1" };
  if (!keepAnthropic) for (const k of Object.keys(env)) if (/^ANTHROPIC_/i.test(k)) delete env[k];
  return env;
}

/* ------------------------------------------------------------------ */
/* Parsing stream-json                                                  */
/* ------------------------------------------------------------------ */
function short(s, n) {
  const t = String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function describeTool(name, input) {
  const i = input || {};
  const target = i.command || i.file_path || i.path || i.pattern || i.url || i.description || "";
  return short(`${name}${target ? `: ${target}` : ""}`, 220);
}

/**
 * Satu baris stdout -> { events: [{kind, text, tool?, file?}], result?, init? }.
 * kind: info | text | tool | error
 */
function parseStreamLine(line) {
  const out = { events: [] };
  const raw = String(line || "").trim();
  if (!raw) return out;
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    out.events.push({ kind: "info", text: short(raw, 300) });
    return out;
  }
  if (msg.type === "system" && msg.subtype === "init") {
    out.init = { model: msg.model || null, sessionId: msg.session_id || null };
    out.events.push({ kind: "info", text: `Mulai (model ${msg.model || "-"})` });
  } else if (msg.type === "system" && msg.subtype === "api_retry") {
    out.events.push({ kind: "info", text: `Mengulang permintaan ke Claude (percobaan ${msg.attempt}, ${msg.error || "error"})` });
  } else if (msg.type === "system" && msg.subtype === "permission_denied") {
    out.events.push({ kind: "error", text: `Ditolak: ${describeTool(msg.tool_name || "tool", msg.tool_input)}` });
  } else if (msg.type === "assistant" && msg.message && Array.isArray(msg.message.content)) {
    if (msg.parent_tool_use_id) return out; // pesan sub-agent: tidak ditampilkan
    for (const b of msg.message.content) {
      if (b.type === "text" && b.text && b.text.trim()) out.events.push({ kind: "text", text: short(b.text, 400) });
      if (b.type === "tool_use") {
        const ev = { kind: "tool", tool: b.name, text: describeTool(b.name, b.input) };
        if (["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(b.name) && b.input && (b.input.file_path || b.input.notebook_path))
          ev.file = b.input.file_path || b.input.notebook_path;
        out.events.push(ev);
      }
    }
  } else if (msg.type === "result") {
    out.result = {
      isError: !!msg.is_error,
      text: typeof msg.result === "string" ? msg.result : "",
      sessionId: msg.session_id || null,
      costUsd: typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : null,
      numTurns: msg.num_turns || null,
      durationMs: msg.duration_ms || null,
      denials: (msg.permission_denials || []).map((d) => describeTool(d.tool_name, d.tool_input)),
      subtype: msg.subtype || null,
    };
  }
  return out;
}

/** Ambil "RINGKASAN: ..." dari jawaban akhir; fallback kalimat pertama instruksi. */
function extractSummary(resultText, prompt) {
  const m = String(resultText || "").match(/RINGKASAN\s*:\s*(.+)\s*$/im);
  const s = m ? m[1] : `Claude Code: ${String(prompt || "").split(/\r?\n/)[0]}`;
  return short(s.replace(/[*_`]/g, ""), 300);
}

/** Jawaban akhir tanpa baris RINGKASAN (untuk ditampilkan). */
function stripSummary(resultText) {
  return String(resultText || "").replace(/\n?\s*RINGKASAN\s*:.*$/im, "").trim();
}

/** File yang diubah, relatif ke folder project, unik. */
function changedFiles(events, folder) {
  const set = new Set();
  for (const e of events) {
    if (!e.file) continue;
    let f = e.file;
    if (folder && path.isAbsolute(f)) {
      const rel = path.relative(folder, f);
      if (rel && !rel.startsWith("..")) f = rel;
    }
    set.add(f.replace(/\\/g, "/"));
  }
  return [...set].slice(0, 100);
}

/* ------------------------------------------------------------------ */
/* Runner                                                               */
/* ------------------------------------------------------------------ */
/**
 * createClaudeRunner({ spawn, killTree, log, logDir, scriptsDir, execPath })
 * Mengembalikan { start, status, stop, isRunning, runningCount }.
 */
function createClaudeRunner(deps) {
  const runs = new Map(); // appId -> run

  function publicRun(run, since) {
    if (!run) return { status: "idle" };
    const from = Math.max(0, Math.min(Number(since) || 0, run.events.length + run.dropped));
    const offset = from - run.dropped;
    return {
      runId: run.runId,
      status: run.status,
      mode: run.mode,
      model: run.model,
      prompt: short(run.prompt, 500),
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      eventCount: run.events.length + run.dropped,
      events: run.events.slice(Math.max(0, offset)),
      result: run.result ? { ...run.result, text: stripSummary(run.result.text) } : null,
      summary: run.summary,
      files: run.files,
      activity: run.activity,
      error: run.error,
    };
  }

  function pushEvent(run, ev) {
    run.events.push({ t: Date.now(), ...ev });
    if (run.events.length > MAX_EVENTS) {
      const drop = run.events.length - MAX_EVENTS;
      run.events.splice(0, drop);
      run.dropped += drop;
    }
  }

  function writeLog(run, line) {
    try {
      fs.appendFileSync(run.logFile, `${line}\n`);
    } catch (_) {
      /* abaikan */
    }
  }

  function logActivity(app, run) {
    const script = path.join(deps.scriptsDir, "log-activity.mjs");
    if (!fs.existsSync(script)) return;
    const folder = app.folder || (app.processes[0] && app.processes[0].cwd);
    const args = [
      script,
      "--project",
      (app.claude && app.claude.project) || app.name,
      "--summary",
      run.summary,
      "--type",
      "development",
      "--source",
      "claude-code",
    ];
    if (run.files.length) args.push("--files", run.files.join(","));
    const handoff = path.join(folder, "HANDOFF.md");
    if (fs.existsSync(handoff)) args.push("--handoff", handoff);
    run.activity = { status: "sending" };
    let out = "";
    const child = deps.spawn(deps.execPath, args, { cwd: folder, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", (e) => (run.activity = { status: "failed", message: e.message }));
    child.on("exit", (code) => {
      run.activity = { status: code === 0 ? "logged" : "failed", message: short(out, 400) };
      writeLog(run, `[activity] ${run.activity.status}: ${out.trim()}`);
    });
  }

  function start(app, opts, globalCfg) {
    const prev = runs.get(app.id);
    if (prev && prev.status === "running") return { error: "Claude Code masih mengerjakan instruksi sebelumnya di project ini", status: 409 };
    const maxConcurrent = (globalCfg && globalCfg.maxConcurrent) || 2;
    if (runningCount() >= maxConcurrent) return { error: `Maksimal ${maxConcurrent} instruksi berjalan bersamaan`, status: 429 };
    const folder = app.folder || (app.processes[0] && app.processes[0].cwd);
    if (!folder || !fs.existsSync(folder)) return { error: `Folder project tidak ditemukan: ${folder}`, status: 400 };
    const missing = (opts.addDirs || []).filter((d) => !fs.existsSync(d));
    if (missing.length) return { error: `Folder tambahan tidak ditemukan: ${missing.join(", ")}`, status: 400 };

    const exe = resolveClaudePath(globalCfg);
    const args = buildArgs(opts);
    const run = {
      runId: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      appId: app.id,
      status: "running",
      mode: opts.mode,
      model: opts.model,
      prompt: opts.prompt,
      startedAt: Date.now(),
      finishedAt: null,
      events: [],
      dropped: 0,
      result: null,
      sessionId: null,
      summary: null,
      files: [],
      activity: null,
      error: null,
      stopRequested: false,
      logFile: path.join(deps.logDir, `${app.id}-claude.log`),
      child: null,
      timer: null,
    };
    // dipanggil sekali saat run berakhir (dipakai antrian Telegram, agent/queue.cjs)
    run.onFinish = typeof opts.onFinish === "function" ? opts.onFinish : null;
    runs.set(app.id, run);
    try {
      if (fs.existsSync(run.logFile) && fs.statSync(run.logFile).size > 5 * 1024 * 1024) fs.renameSync(run.logFile, `${run.logFile}.1`);
    } catch (_) {
      /* abaikan */
    }
    writeLog(run, `\n=== ${new Date().toISOString()} run ${run.runId} mode=${opts.mode} model=${opts.model} ===\n${opts.prompt}\n---`);
    pushEvent(run, { kind: "info", text: `Menjalankan Claude Code (${opts.mode === "edit" ? "boleh mengubah file" : "baca saja"}, ${opts.model}) di ${folder}` });

    let child;
    try {
      child = deps.spawn(exe, args, {
        cwd: folder,
        env: claudeEnv(process.env, !!opts.settings),
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      run.status = "error";
      run.error = `Gagal menjalankan Claude Code: ${e.message}`;
      run.finishedAt = Date.now();
      return { error: run.error, status: 500 };
    }
    run.child = child;

    let buf = "";
    let errTail = "";
    child.stdout.on("data", (d) => {
      buf += d.toString("utf8");
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        writeLog(run, line);
        const p = parseStreamLine(line);
        if (p.init && p.init.sessionId) run.sessionId = p.init.sessionId;
        for (const ev of p.events) pushEvent(run, ev);
        if (p.result) run.result = p.result;
      }
    });
    child.stderr.on("data", (d) => {
      const t = d.toString("utf8");
      errTail = (errTail + t).slice(-2000);
      writeLog(run, `[stderr] ${t.trim()}`);
    });
    child.on("error", (e) => {
      run.error =
        e.code === "ENOENT"
          ? `claude tidak ditemukan (${exe}). Install Claude Code atau isi "claude.path" di apps.json.`
          : `Gagal menjalankan Claude Code: ${e.message}`;
      pushEvent(run, { kind: "error", text: run.error });
    });
    child.on("close", (code) => {
      if (run.timer) clearTimeout(run.timer);
      if (buf.trim()) {
        const p = parseStreamLine(buf);
        for (const ev of p.events) pushEvent(run, ev);
        if (p.result) run.result = p.result;
      }
      run.finishedAt = Date.now();
      run.files = changedFiles(run.events, folder);
      if (run.status === "running") {
        if (run.stopRequested) run.status = "stopped";
        else if (run.result && !run.result.isError) run.status = "done";
        else {
          run.status = "error";
          run.error =
            run.error ||
            (run.result && run.result.text) ||
            short(errTail, 500) ||
            `Claude Code berhenti (code ${code}). Cek login: buka PowerShell, jalankan claude lalu /status.`;
        }
      }
      if (run.result && run.result.sessionId) run.sessionId = run.result.sessionId;
      run.summary = extractSummary(run.result && run.result.text, run.prompt);
      pushEvent(run, {
        kind: run.status === "done" ? "info" : "error",
        text:
          run.status === "done"
            ? `Selesai${run.result && run.result.costUsd != null ? ` (estimasi $${run.result.costUsd.toFixed(3)})` : ""}`
            : run.status === "stopped"
              ? "Dihentikan"
              : run.status === "timeout"
                ? "Dihentikan: melewati batas waktu"
                : `Gagal: ${short(run.error, 200)}`,
      });
      deps.log(`[${app.id}] claude ${run.runId} ${run.status} code=${code}`);
      if (run.onFinish) {
        const cb = run.onFinish;
        run.onFinish = null;
        try {
          cb(publicRun(run));
        } catch (e) {
          deps.log(`[${app.id}] onFinish error: ${e.message}`);
        }
      }
      // Catat ke My Workspace hanya bila benar-benar mengubah sesuatu
      if (run.status === "done" && run.mode === "edit") logActivity(app, run);
    });

    const minutes = (app.claude && app.claude.timeoutMinutes) || (globalCfg && globalCfg.timeoutMinutes) || 30;
    run.timer = setTimeout(() => {
      if (run.status !== "running") return;
      run.status = "timeout";
      run.error = `Melewati batas waktu ${minutes} menit`;
      deps.killTree(child.pid);
    }, minutes * 60 * 1000);

    deps.log(`[${app.id}] claude ${run.runId} start mode=${opts.mode} model=${opts.model}`);
    return { ok: true, runId: run.runId };
  }

  async function stop(appId) {
    const run = runs.get(appId);
    if (!run || run.status !== "running") return { ok: true, skipped: "tidak ada yang berjalan" };
    run.stopRequested = true;
    pushEvent(run, { kind: "info", text: "Menghentikan..." });
    await deps.killTree(run.child && run.child.pid);
    return { ok: true };
  }

  function isRunning(appId) {
    const r = runs.get(appId);
    return !!(r && r.status === "running");
  }
  function runningCount() {
    let n = 0;
    for (const r of runs.values()) if (r.status === "running") n++;
    return n;
  }
  function lastSession(appId) {
    const r = runs.get(appId);
    return r ? r.sessionId : null;
  }
  function pids() {
    return [...runs.values()].filter((r) => r.status === "running" && r.child).map((r) => r.child.pid);
  }

  return {
    start,
    stop,
    status: (appId, since) => publicRun(runs.get(appId), since),
    isRunning,
    runningCount,
    lastSession,
    pids,
  };
}

module.exports = {
  buildArgs,
  normalizeRequest,
  resolveClaudePath,
  claudeEnv,
  parseStreamLine,
  extractSummary,
  stripSummary,
  changedFiles,
  allowedTools,
  disallowedTools,
  runRules,
  createClaudeRunner,
  absRuleRoot,
  denyReadFor,
  MODELS,
};
