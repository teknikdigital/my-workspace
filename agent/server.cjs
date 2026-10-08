#!/usr/bin/env node
/**
 * My Workspace Agent
 * ------------------------------------------------------------------
 * Launcher aplikasi lokal untuk halaman "Lokal" di My Workspace.
 *
 * - Membaca daftar aplikasi dari apps.json (folder yang sama).
 * - Start / Stop / Restart proses, cek status port, simpan log terakhir.
 * - Hanya listen di 127.0.0.1 (tidak bisa diakses dari jaringan lain).
 * - Semua endpoint (kecuali /health) wajib header  X-Agent-Token.
 * - Hanya menjalankan perintah yang terdaftar di apps.json
 *   (web TIDAK bisa mengirim perintah bebas).
 *
 * Tanpa dependency: cukup Node.js 18+.
 * Jalankan:  node server.cjs     (atau double-click Jalankan-Agent.bat)
 *
 * v1.4.0: Claude Code. POST /apps/:id/claude menjalankan `claude -p` di folder project
 * (lihat claude.cjs). Project bisa dikunci baca saja lewat "claude": { "mode": "read" }.
 * v1.5.0: Antrian dari Telegram (queue.cjs). Agent memeriksa My Workspace tiap 10 detik dan
 * menjalankan instruksi yang sudah ditekan "▶️ Jalankan" di Telegram. Token integrasi sama dengan
 * log-activity.mjs (%USERPROFILE%\.myworkspace-token atau env MW_TOKEN). Alamat: apps.json queue.url / env MW_URL.
 */
"use strict";

const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn, execFile } = require("child_process");
const claudeCode = require("./claude.cjs");
const { createQueuePoller } = require("./queue.cjs");
const os = require("os");

const VERSION = "1.5.0";
const ROOT = __dirname;
const IS_WIN = process.platform === "win32";
const CONFIG_PATH = process.env.AGENT_CONFIG || path.join(ROOT, "apps.json");
const TOKEN_PATH = path.join(ROOT, ".agent-token");
const PID_PATH = path.join(ROOT, ".agent.pid");
const LOG_DIR = path.join(ROOT, "logs");
const LOG_PATH = path.join(LOG_DIR, "agent.log");
const MAX_LOG_LINES = 500; // per proses, disimpan di memori
const MAX_LOG_FILE = 5 * 1024 * 1024; // 5 MB, lalu dirotasi
const STARTUP_TIMEOUT_MS = 90 * 1000; // lewat dari ini port belum terbuka = "tidak merespons"

/* ------------------------------------------------------------------ */
/* Logging ke file sendiri (agar bisa dirotasi)                        */
/* ------------------------------------------------------------------ */
fs.mkdirSync(LOG_DIR, { recursive: true });
try {
  if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > MAX_LOG_FILE) {
    fs.renameSync(LOG_PATH, LOG_PATH + ".1");
  }
} catch (_) {
  /* abaikan */
}
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_PATH, line + "\n");
  } catch (_) {
    /* abaikan */
  }
}

/* ------------------------------------------------------------------ */
/* Konfigurasi                                                         */
/* ------------------------------------------------------------------ */
function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  const cfg = JSON.parse(raw);
  if (!Array.isArray(cfg.apps)) throw new Error("apps.json: field 'apps' wajib array");
  const ids = new Set();
  for (const app of cfg.apps) {
    if (!/^[a-z0-9-]+$/.test(app.id || "")) throw new Error(`apps.json: id tidak valid: ${app.id}`);
    if (ids.has(app.id)) throw new Error(`apps.json: id ganda: ${app.id}`);
    ids.add(app.id);
    if (!Array.isArray(app.processes) || app.processes.length === 0)
      throw new Error(`apps.json: ${app.id} wajib punya minimal 1 proses`);
    for (const p of app.processes) {
      if (!p.name || !p.cwd || !p.command) throw new Error(`apps.json: proses di ${app.id} wajib punya name, cwd, command`);
      if (p.port && !Number.isInteger(p.port)) throw new Error(`apps.json: port ${app.id}/${p.name} harus angka`);
    }
    // actions = perintah sekali jalan (npm install, file .bat, build, dll). Opsional.
    for (const a of app.actions || []) {
      if (!/^[a-z0-9-]+$/.test(a.id || "")) throw new Error(`apps.json: id action tidak valid di ${app.id}: ${a.id}`);
      if (!a.label || !a.cwd || !a.command) throw new Error(`apps.json: action ${app.id}/${a.id} wajib punya label, cwd, command`);
    }
  }
  return {
    port: cfg.port || 4545,
    allowedOrigins: cfg.allowedOrigins || ["http://localhost:3000"],
    maxUploadMB: Number(cfg.maxUploadMB) > 0 ? Number(cfg.maxUploadMB) : 200,
    inboxName: cfg.inboxName || "_Masuk",
    // Claude Code: { path, defaultModel, timeoutMinutes, maxConcurrent }
    claude: cfg.claude || {},
    // Antrian Telegram: { enabled (default true), url (default env MW_URL / http://localhost:3000), intervalSeconds (default 10) }
    queue: cfg.queue || {},
    apps: cfg.apps,
  };
}

let config;
try {
  config = loadConfig();
} catch (e) {
  log("GAGAL membaca apps.json:", e.message);
  process.exit(1);
}

function getToken() {
  if (fs.existsSync(TOKEN_PATH)) {
    const t = fs.readFileSync(TOKEN_PATH, "utf8").trim();
    if (t.length >= 32) return t;
  }
  const t = crypto.randomBytes(24).toString("hex");
  fs.writeFileSync(TOKEN_PATH, t);
  log("Token baru dibuat di", TOKEN_PATH);
  return t;
}
const TOKEN = getToken();

/* ------------------------------------------------------------------ */
/* State proses                                                        */
/* ------------------------------------------------------------------ */
/** key = `${appId}:${procName}` */
const procs = new Map();

function procKey(appId, procName) {
  return `${appId}:${procName}`;
}
function getProcState(appId, procName) {
  const k = procKey(appId, procName);
  if (!procs.has(k))
    procs.set(k, {
      child: null,
      pid: null,
      startedAt: null,
      exitCode: null,
      exitedAt: null,
      exited: false,
      stopRequested: false,
      logs: [],
      logFile: path.join(LOG_DIR, `${appId}-${procName}.log`),
    });
  return procs.get(k);
}

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
function pushLog(state, stream, chunk) {
  const text = chunk.toString("utf8").replace(ANSI, "");
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    state.logs.push({ t: Date.now(), s: stream, m: line.slice(0, 2000) });
    // salinan ke file: logs/<app>-<proses>.log (bisa dibuka walau agent mati)
    if (state.logFile) {
      try {
        fs.appendFileSync(state.logFile, `[${new Date().toISOString()}] [${stream}] ${line}\n`);
      } catch (_) {
        /* abaikan */
      }
    }
  }
  if (state.logs.length > MAX_LOG_LINES) state.logs.splice(0, state.logs.length - MAX_LOG_LINES);
}

/** Cek port terbuka di IPv4 dan IPv6 (Vite di Windows sering listen di ::1). */
function checkHost(port, host) {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host });
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(400);
    sock.once("connect", () => done(true));
    sock.once("timeout", () => done(false));
    sock.once("error", () => done(false));
  });
}
async function isPortOpen(port) {
  if (!port) return false;
  const [v4, v6] = await Promise.all([checkHost(port, "127.0.0.1"), checkHost(port, "::1")]);
  return v4 || v6;
}

function isAlive(state) {
  // exitCode null + signalCode null = proses masih hidup (signalCode terisi bila mati karena sinyal)
  return !!(state.child && !state.exited && state.child.exitCode === null && state.child.signalCode === null);
}

async function processStatus(app, p) {
  const st = getProcState(app.id, p.name);
  const alive = isAlive(st);
  const open = p.port ? await isPortOpen(p.port) : alive;
  let status;
  if (open && alive) status = "running";
  else if (open && !alive) status = "external"; // jalan, tapi bukan dinyalakan agent
  else if (!open && alive) status = Date.now() - st.startedAt > STARTUP_TIMEOUT_MS ? "unresponsive" : "starting";
  else if (st.exitCode !== null && st.exitCode !== 0 && st.exitedAt && Date.now() - st.exitedAt < 10 * 60 * 1000)
    status = "crashed";
  else status = "stopped";
  return {
    name: p.name,
    port: p.port || null,
    cwd: p.cwd,
    command: p.command,
    status,
    pid: alive ? st.pid : null,
    startedAt: alive ? st.startedAt : null,
    exitCode: st.exitCode,
  };
}

function aggregate(statuses) {
  const s = statuses.map((x) => x.status);
  if (s.every((x) => x === "running" || x === "external")) return s.includes("external") ? "external" : "running";
  if (s.includes("crashed")) return "crashed";
  if (s.includes("unresponsive")) return "unresponsive";
  if (s.includes("starting")) return "starting";
  if (s.every((x) => x === "stopped")) return "stopped";
  return "partial";
}

async function appStatus(app) {
  const processes = await Promise.all(app.processes.map((p) => processStatus(app, p)));
  return {
    id: app.id,
    name: app.name,
    group: app.group || "Lainnya",
    description: app.description || "",
    url: app.url || null,
    embeddable: app.embeddable !== false,
    folder: appFolder(app),
    inbox: inboxDir(app),
    status: aggregate(processes),
    processes,
    claude: {
      mode: (app.claude && app.claude.mode) || "read", // "edit" = boleh mengubah file, "read" = terkunci baca saja
      project: (app.claude && app.claude.project) || app.name, // nama project di My Workspace
      running: claudeRunner.isRunning(app.id),
      lastSessionId: claudeRunner.lastSession(app.id),
    },
    actions: (app.actions || []).map((a) => {
      const st = getProcState(app.id, actionProcName(a));
      return {
        id: a.id,
        label: a.label,
        confirm: a.confirm || null,
        running: isAlive(st),
        exitCode: st.exitCode,
        lastRunAt: st.startedAt,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Start / Stop                                                        */
/* ------------------------------------------------------------------ */
function startProcess(app, p) {
  const st = getProcState(app.id, p.name);
  if (isAlive(st)) return { skipped: "sudah berjalan" };
  if (!fs.existsSync(p.cwd)) throw new Error(`Folder tidak ditemukan: ${p.cwd}`);
  try {
    if (fs.existsSync(st.logFile) && fs.statSync(st.logFile).size > 2 * 1024 * 1024) fs.renameSync(st.logFile, st.logFile + ".1");
  } catch (_) {
    /* abaikan */
  }

  const env = {
    ...process.env,
    BROWSER: "none", // cegah dev server membuka browser sendiri
    FORCE_COLOR: "0",
    ...(p.env || {}),
  };
  const child = spawn(p.command, {
    cwd: p.cwd,
    env,
    shell: true,
    windowsHide: true,
    detached: !IS_WIN, // posix: process group sendiri agar bisa di-kill satu pohon
    stdio: ["ignore", "pipe", "pipe"],
  });
  st.child = child;
  st.pid = child.pid;
  st.startedAt = Date.now();
  st.exitCode = null;
  st.exitedAt = null;
  st.exited = false;
  st.stopRequested = false;
  pushLog(st, "agent", `> ${p.command}   (cwd: ${p.cwd})`);
  child.stdout.on("data", (d) => pushLog(st, "out", d));
  child.stderr.on("data", (d) => pushLog(st, "err", d));
  child.on("error", (e) => pushLog(st, "agent", `ERROR: ${e.message}`));
  child.on("exit", (code, signal) => {
    if (st.child !== child) return; // event dari proses lama setelah restart
    st.exited = true;
    // berhenti karena diminta (Stop/Restart) = normal, bukan crash
    st.exitCode = st.stopRequested ? 0 : code === null ? -1 : code;
    st.exitedAt = Date.now();
    pushLog(st, "agent", `Proses berhenti (code=${code}, signal=${signal || "-"})`);
    log(`[${app.id}/${p.name}] berhenti code=${code}`);
  });
  log(`[${app.id}/${p.name}] start pid=${child.pid}`);
  return { pid: child.pid };
}

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, timeout: 8000 }, (err, stdout) => resolve(err ? "" : String(stdout)));
  });
}

function killTree(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve();
    if (IS_WIN) {
      execFile("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true }, () => resolve());
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch (_) {
        try {
          process.kill(pid, "SIGTERM");
        } catch (_) {
          /* sudah mati */
        }
      }
      setTimeout(() => {
        try {
          process.kill(-pid, "SIGKILL");
        } catch (_) {
          /* sudah mati */
        }
        resolve();
      }, 1500);
    }
  });
}

function waitExit(st, ms) {
  return new Promise((resolve) => {
    if (!isAlive(st)) return resolve();
    const t = setTimeout(resolve, ms);
    st.child.once("exit", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

/** PID yang LISTEN di port tertentu (untuk menghentikan proses "external"). */
async function pidsOnPort(port) {
  const pids = new Set();
  if (IS_WIN) {
    const out = await run("netstat", ["-ano", "-p", "TCP"]);
    const out6 = await run("netstat", ["-ano", "-p", "TCPv6"]);
    for (const line of (out + "\n" + out6).split(/\r?\n/)) {
      const cols = line.trim().split(/\s+/);
      // Proto  Local  Foreign  State  PID
      if (cols.length >= 5 && /LISTEN/i.test(cols[3]) && cols[1].endsWith(`:${port}`)) pids.add(Number(cols[4]));
    }
  } else {
    const out = await run("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"]);
    for (const l of out.split(/\s+/)) if (/^\d+$/.test(l)) pids.add(Number(l));
  }
  pids.delete(process.pid);
  pids.delete(0);
  return [...pids];
}

async function stopProcess(app, p) {
  const st = getProcState(app.id, p.name);
  if (isAlive(st)) {
    pushLog(st, "agent", "Menghentikan proses...");
    st.stopRequested = true;
    await killTree(st.pid);
    await waitExit(st, 3000);
  }
  // Bersihkan juga proses lain yang masih memegang port (mis. dev server yatim)
  if (p.port && (await isPortOpen(p.port))) {
    for (const pid of await pidsOnPort(p.port)) {
      pushLog(st, "agent", `Menghentikan PID ${pid} yang memakai port ${p.port}`);
      await killTree(pid);
    }
  }
  // tunggu port benar-benar lepas (maks 5 detik) agar Restart tidak bentrok
  for (let i = 0; p.port && i < 25 && (await isPortOpen(p.port)); i++) await new Promise((r) => setTimeout(r, 200));
  log(`[${app.id}/${p.name}] stop`);
}

function actionProcName(a) {
  return `action-${a.id}`;
}

/** Jalankan action sekali (output masuk Log dengan tab sendiri). */
function runAction(app, a) {
  return startProcess(app, { name: actionProcName(a), cwd: a.cwd, command: a.command, env: a.env });
}

async function startApp(app) {
  const results = [];
  for (const p of app.processes) {
    if (p.port && (await isPortOpen(p.port)) && !isAlive(getProcState(app.id, p.name))) {
      results.push({ name: p.name, skipped: `port ${p.port} sudah dipakai proses lain` });
      continue;
    }
    results.push({ name: p.name, ...startProcess(app, p) });
  }
  return results;
}
async function stopApp(app) {
  // hentikan urutan terbalik (web dulu, lalu API)
  for (const p of [...app.processes].reverse()) await stopProcess(app, p);
}

/* ------------------------------------------------------------------ */
/* Claude Code                                                         */
/* ------------------------------------------------------------------ */
const claudeRunner = claudeCode.createClaudeRunner({
  spawn,
  killTree,
  log,
  logDir: LOG_DIR,
  scriptsDir: path.join(ROOT, "..", "scripts"), // D:\Project\myworkspace\scripts\log-activity.mjs
  execPath: process.execPath,
});

/* Antrian Claude Code dari Telegram */
const MW_TOKEN_FILE = path.join(os.homedir(), ".myworkspace-token");
function queueSettings() {
  const q = config.queue || {};
  let token = process.env.MW_TOKEN || "";
  if (!token) {
    try {
      token = fs.readFileSync(MW_TOKEN_FILE, "utf8").trim();
    } catch (_) {
      token = "";
    }
  }
  return {
    enabled: q.enabled !== false,
    url: String(q.url || process.env.MW_URL || "http://localhost:3000").replace(/\/+$/, ""),
    token,
    intervalMs: Math.max(5, Number(q.intervalSeconds) || 10) * 1000,
  };
}
const queuePoller = createQueuePoller({
  fetch: (...a) => fetch(...a),
  log,
  version: VERSION,
  settings: queueSettings,
  apps: () => config.apps,
  globalCfg: () => config.claude,
  runner: claudeRunner,
  normalizeRequest: claudeCode.normalizeRequest,
});

let claudeVersionCache = null;
function claudeInfo() {
  const exe = claudeCode.resolveClaudePath(config.claude);
  if (claudeVersionCache && claudeVersionCache.exe === exe && Date.now() - claudeVersionCache.at < 5 * 60 * 1000)
    return Promise.resolve(claudeVersionCache.info);
  return new Promise((resolve) => {
    execFile(exe, ["--version"], { windowsHide: true, timeout: 15000 }, (err, stdout) => {
      const info = err
        ? { available: false, path: exe, error: err.code === "ENOENT" ? "claude tidak ditemukan" : err.message }
        : { available: true, path: exe, version: String(stdout).trim(), defaultModel: config.claude.defaultModel || "sonnet" };
      claudeVersionCache = { exe, at: Date.now(), info };
      resolve(info);
    });
  });
}

/** Baca body JSON kecil (maks 64 KB). */
function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error("Body terlalu besar"), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(Object.assign(new Error("Body harus JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */
function originAllowed(origin) {
  if (!origin) return true; // curl / tool lokal (tetap butuh token)
  return config.allowedOrigins.includes(origin);
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && originAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Agent-Token");
    res.setHeader("Access-Control-Max-Age", "600");
    // Chrome Private/Local Network Access: izinkan situs publik memanggil localhost
    if (req.headers["access-control-request-private-network"]) {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
  }
}

function send(res, code, body) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function tokenOk(req) {
  const t = String(req.headers["x-agent-token"] || "");
  const a = Buffer.from(t);
  const b = Buffer.from(TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function findApp(id) {
  return config.apps.find((a) => a.id === id);
}

/* ------------------------------------------------------------------ */
/* Kirim file ke folder project (subfolder _Masuk)                      */
/* ------------------------------------------------------------------ */
const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Folder project: field "folder" di apps.json, atau cwd proses pertama. */
function appFolder(app) {
  return app.folder || app.processes[0].cwd;
}

function inboxDir(app) {
  return path.join(appFolder(app), config.inboxName);
}

/** Nama file aman untuk Windows: tanpa path, karakter terlarang, atau nama khusus (CON, NUL, ...). */
function safeFileName(raw) {
  let name = String(raw || "")
    .split(/[\\/]/)
    .pop()
    .replace(/[<>:"|?*\u0000-\u001f]/g, "_")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 180);
  if (!name) name = "file";
  if (WIN_RESERVED.test(name)) name = `_${name}`;
  return name;
}

/** "laporan.pdf" -> "laporan (2).pdf" bila sudah ada. Tidak pernah menimpa. */
function uniquePath(dir, name) {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let candidate = path.join(dir, name);
  for (let i = 2; fs.existsSync(candidate); i++) candidate = path.join(dir, `${base} (${i})${ext}`);
  return candidate;
}

function ensureInbox(app) {
  const dir = inboxDir(app);
  if (!fs.existsSync(appFolder(app))) throw new Error(`Folder project tidak ditemukan: ${appFolder(app)}`);
  fs.mkdirSync(dir, { recursive: true });
  // Isi _Masuk tidak ikut ter-commit ke git tanpa perlu mengubah .gitignore project
  const gi = path.join(dir, ".gitignore");
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, "# Dibuat My Workspace Agent: isi folder ini tidak ikut git\n*\n");
  return dir;
}

/** Terima body request (stream) dan tulis ke _Masuk. Ditulis ke .part dulu lalu di-rename. */
function receiveFile(req, app, rawName) {
  return new Promise((resolve, reject) => {
    let dir;
    try {
      dir = ensureInbox(app);
    } catch (e) {
      return reject(Object.assign(e, { status: 400 }));
    }
    const name = safeFileName(rawName);
    const limit = config.maxUploadMB * 1024 * 1024;
    const declared = Number(req.headers["content-length"] || 0);
    if (declared > limit) {
      req.resume();
      return reject(Object.assign(new Error(`File melebihi batas ${config.maxUploadMB} MB`), { status: 413 }));
    }
    const tmp = path.join(dir, `.${crypto.randomBytes(6).toString("hex")}.part`);
    const out = fs.createWriteStream(tmp, { flags: "wx" });
    let bytes = 0;
    let failed = false;
    const fail = (err, status) => {
      if (failed) return;
      failed = true;
      req.unpipe(out);
      out.destroy();
      fs.rm(tmp, { force: true }, () => {});
      reject(Object.assign(err, { status }));
    };
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > limit) {
        fail(new Error(`File melebihi batas ${config.maxUploadMB} MB`), 413);
        req.resume();
      }
    });
    req.on("aborted", () => fail(new Error("Upload dibatalkan"), 499));
    out.on("error", (e) => fail(e, 500));
    out.on("finish", () => {
      if (failed) return;
      try {
        const finalPath = uniquePath(dir, name);
        fs.renameSync(tmp, finalPath);
        log(`[${app.id}] file masuk: ${path.basename(finalPath)} (${bytes} byte)`);
        resolve({ savedAs: path.basename(finalPath), path: finalPath, bytes });
      } catch (e) {
        fail(e, 500);
      }
    });
    req.pipe(out);
  });
}

function listInbox(app) {
  const dir = inboxDir(app);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith(".") )
    .map((d) => {
      const st = fs.statSync(path.join(dir, d.name));
      return { name: d.name, bytes: st.size, modifiedAt: st.mtimeMs };
    })
    .sort((a, b) => b.modifiedAt - a.modifiedAt);
}

function openFolder(dir) {
  if (IS_WIN) spawn("explorer.exe", [dir], { detached: true, stdio: "ignore" }).unref();
  else if (process.platform === "darwin") spawn("open", [dir], { detached: true, stdio: "ignore" }).unref();
  else spawn("xdg-open", [dir], { detached: true, stdio: "ignore" }).unref();
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);
  const origin = req.headers.origin;
  if (origin && !originAllowed(origin)) return send(res, 403, { error: `Origin tidak diizinkan: ${origin}` });
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, "http://127.0.0.1");
  const parts = url.pathname.split("/").filter(Boolean); // ["apps", ":id", "start"]

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, name: "my-workspace-agent", version: VERSION, platform: process.platform });
    }

    if (!tokenOk(req)) return send(res, 401, { error: "Token agent salah atau belum diisi" });

    if (req.method === "GET" && url.pathname === "/apps") {
      const apps = await Promise.all(config.apps.map(appStatus));
      return send(res, 200, { apps, agent: { version: VERSION, pid: process.pid, configPath: CONFIG_PATH } });
    }

    if (req.method === "POST" && url.pathname === "/agent/stop") {
      send(res, 200, { ok: true });
      setTimeout(() => shutdown("diminta dari My Workspace"), 300);
      return;
    }

    if (req.method === "GET" && url.pathname === "/claude") {
      if (url.searchParams.get("refresh")) claudeVersionCache = null;
      return send(res, 200, await claudeInfo());
    }

    if (req.method === "GET" && url.pathname === "/queue") {
      return send(res, 200, queuePoller.status());
    }

    if (req.method === "POST" && url.pathname === "/reload-config") {
      config = loadConfig();
      queuePoller.stop();
      queuePoller.start();
      log("apps.json dimuat ulang");
      return send(res, 200, { ok: true, count: config.apps.length });
    }

    if (parts[0] === "apps" && parts[1]) {
      const app = findApp(parts[1]);
      if (!app) return send(res, 404, { error: `Aplikasi tidak terdaftar: ${parts[1]}` });
      const action = parts[2];

      if (req.method === "GET" && action === "logs") {
        const out = app.processes.map((p) => ({ name: p.name, lines: getProcState(app.id, p.name).logs }));
        for (const a of app.actions || []) {
          const st = getProcState(app.id, actionProcName(a));
          if (st.logs.length) out.push({ name: a.label, lines: st.logs });
        }
        return send(res, 200, { id: app.id, processes: out });
      }
      if (req.method === "POST" && action === "start") {
        const r = await startApp(app);
        return send(res, 200, { ok: true, results: r });
      }
      if (req.method === "POST" && action === "stop") {
        await stopApp(app);
        return send(res, 200, { ok: true });
      }
      if (req.method === "POST" && action === "restart") {
        await stopApp(app);
        await new Promise((r) => setTimeout(r, 800));
        const r = await startApp(app);
        return send(res, 200, { ok: true, results: r });
      }
      if (req.method === "POST" && action === "actions" && parts[3]) {
        const a = (app.actions || []).find((x) => x.id === parts[3]);
        if (!a) return send(res, 404, { error: `Action tidak terdaftar: ${parts[3]}` });
        const r = runAction(app, a);
        log(`[${app.id}] action ${a.id}`, JSON.stringify(r));
        return send(res, 200, { ok: true, ...r });
      }
      if (req.method === "POST" && action === "files") {
        const name = url.searchParams.get("name");
        if (!name) return send(res, 400, { error: "Parameter name (nama file) wajib" });
        try {
          const r = await receiveFile(req, app, name);
          return send(res, 200, { ok: true, app: app.name, ...r });
        } catch (e) {
          return send(res, e.status || 500, { error: e.message });
        }
      }
      if (req.method === "GET" && action === "files") {
        return send(res, 200, { inbox: inboxDir(app), files: listInbox(app) });
      }
      if (req.method === "POST" && action === "open-inbox") {
        openFolder(ensureInbox(app));
        return send(res, 200, { ok: true });
      }
      if (action === "claude") {
        if (req.method === "GET" && !parts[3]) return send(res, 200, claudeRunner.status(app.id, url.searchParams.get("since")));
        if (req.method === "POST" && parts[3] === "stop") return send(res, 200, await claudeRunner.stop(app.id));
        if (req.method === "POST" && !parts[3]) {
          let body;
          try {
            body = await readJson(req);
          } catch (e) {
            return send(res, e.status || 400, { error: e.message });
          }
          const opts = claudeCode.normalizeRequest(body, app.claude, config.claude);
          if (opts.error) return send(res, 400, { error: opts.error });
          const r = claudeRunner.start(app, opts, config.claude);
          if (r.error) return send(res, r.status || 500, { error: r.error });
          return send(res, 200, r);
        }
      }
      if (req.method === "POST" && action === "open-folder") {
        openFolder(app.processes[0].cwd);
        return send(res, 200, { ok: true });
      }
    }

    return send(res, 404, { error: "Endpoint tidak dikenal" });
  } catch (e) {
    log("ERROR", e.stack || e.message);
    return send(res, 500, { error: e.message });
  }
});

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */
async function shutdown(sig) {
  log(`Agent berhenti (${sig}), menghentikan aplikasi yang dijalankan agent...`);
  queuePoller.stop();
  const tasks = [];
  for (const st of procs.values()) if (isAlive(st)) tasks.push(killTree(st.pid));
  for (const pid of claudeRunner.pids()) tasks.push(killTree(pid));
  await Promise.all(tasks);
  try {
    fs.unlinkSync(PID_PATH);
  } catch (_) {
    /* abaikan */
  }
  process.exit(0);
}
process.on("SIGINT", () => shutdown("SIGINT"));
// Jangan sampai agent mati karena satu error tak terduga: catat lalu lanjut
process.on("uncaughtException", (e) => log("UNCAUGHT", e && e.stack ? e.stack : String(e)));
process.on("unhandledRejection", (e) => log("UNHANDLED", e && e.stack ? e.stack : String(e)));
process.on("exit", (code) => log(`Proses agent keluar (code=${code})`));
process.on("SIGTERM", () => shutdown("SIGTERM"));

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") log(`Port ${config.port} sudah dipakai. Agent mungkin sudah berjalan.`);
  else log("Server error:", e.message);
  process.exit(1);
});

server.listen(config.port, "127.0.0.1", async () => {
  fs.writeFileSync(PID_PATH, String(process.pid));
  log(`My Workspace Agent v${VERSION} aktif di http://127.0.0.1:${config.port}`);
  log(`Origin diizinkan: ${config.allowedOrigins.join(", ")}`);
  log(`Aplikasi terdaftar: ${config.apps.map((a) => a.id).join(", ")}`);
  queuePoller.start();
  for (const app of config.apps) {
    if (app.autoStart) {
      try {
        const r = await startApp(app);
        log(`[autoStart] ${app.id}:`, JSON.stringify(r));
      } catch (e) {
        log(`[autoStart] ${app.id} gagal:`, e.message);
      }
    }
  }
});
