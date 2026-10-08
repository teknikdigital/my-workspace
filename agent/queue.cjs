/**
 * Antrian Claude Code dari Telegram (dan nanti kanal lain).
 *
 * Agent memeriksa My Workspace setiap beberapa detik:
 *   GET  <url>/api/claude-queue/next?v=<versi>        -> { job } | { job: null }
 *   POST <url>/api/claude-queue/<id> {action:"result"} -> laporan hasil
 *   POST <url>/api/claude-queue/<id> {action:"release"}-> kembalikan ke antrian (project sedang sibuk)
 * Auth: Authorization: Bearer <token integrasi> (token yang sama dengan Activity / log-activity.mjs).
 *
 * Aturan keamanan TETAP dari apps.json & claude.cjs: project "read" tidak bisa diedit,
 * daftar perintah terlarang, instruksi berisi rahasia ditolak.
 */

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Cocokkan nama project ke app di apps.json (claude.project, nama app, id). Sama dengan lib/ai/claudeTask.ts. */
function matchApp(project, apps) {
  const p = norm(project);
  if (!p) return null;
  const names = (a) => [a.claude && a.claude.project, a.name, String(a.id).replace(/-/g, " ")].filter(Boolean).map(norm);
  const exact = apps.filter((a) => names(a).some((n) => n === p));
  if (exact.length === 1) return exact[0];
  const partial = apps.filter((a) => names(a).some((n) => n.includes(p) || p.includes(n)));
  return partial.length === 1 ? partial[0] : null;
}

/**
 * createQueuePoller({
 *   fetch, log, version,
 *   settings: () => ({ enabled, url, token, intervalMs }),
 *   apps: () => config.apps, globalCfg: () => config.claude,
 *   runner, normalizeRequest,
 * })
 */
function createQueuePoller(deps) {
  let timer = null;
  let busy = false;
  let lastError = "";
  let lastOkAt = 0;
  let lastJob = null;
  let backoffUntil = 0;

  function warn(msg) {
    if (msg !== lastError) deps.log(`[antrian] ${msg}`);
    lastError = msg;
  }

  async function api(s, method, path, body) {
    const res = await deps.fetch(`${s.url}${path}`, {
      method,
      headers: { Authorization: `Bearer ${s.token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const j = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, json: j };
  }

  async function report(s, jobId, payload) {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await api(s, "POST", `/api/claude-queue/${jobId}`, { action: "result", ...payload });
        if (r.ok || r.status === 404) {
          deps.log(`[antrian] job ${jobId.slice(0, 8)} dilaporkan: ${payload.status}`);
          return true;
        }
        warn(`gagal melapor hasil (${r.status}): ${r.json.error || ""}`);
      } catch (e) {
        warn(`gagal melapor hasil: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
    return false;
  }

  async function release(s, jobId) {
    try {
      await api(s, "POST", `/api/claude-queue/${jobId}`, { action: "release" });
    } catch (e) {
      warn(`gagal mengembalikan job ke antrian: ${e.message}`);
    }
  }

  async function handle(s, job) {
    lastJob = { id: job.id, project: job.project, at: Date.now() };
    const app = matchApp(job.project, deps.apps());
    if (!app) return report(s, job.id, { status: "error", error: `Project "${job.project}" tidak terdaftar di agent (apps.json).` });
    const runner = deps.runner;
    if (runner.isRunning(app.id)) {
      // project sedang dikerjakan instruksi lain: kembalikan, coba lagi nanti
      await release(s, job.id);
      backoffUntil = Date.now() + 30000;
      return;
    }
    const opts = deps.normalizeRequest({ prompt: job.instruction, mode: job.mode, model: job.model }, app.claude, deps.globalCfg());
    if (opts.error) return report(s, job.id, { status: "error", error: opts.error });
    opts.onFinish = (run) =>
      report(s, job.id, {
        status: run.status,
        summary: run.summary || null,
        files: run.files || [],
        error: run.error || null,
        costUsd: run.result && typeof run.result.costUsd === "number" ? run.result.costUsd : null,
      });
    const r = runner.start(app, opts, deps.globalCfg());
    if (r.error) {
      if (r.status === 409 || r.status === 429) {
        await release(s, job.id);
        backoffUntil = Date.now() + 30000;
        return;
      }
      return report(s, job.id, { status: "error", error: r.error });
    }
    deps.log(`[antrian] menjalankan job ${job.id.slice(0, 8)} di ${app.id} (${opts.mode}, ${opts.model})`);
  }

  /** Satu putaran pemeriksaan antrian. Diekspor untuk pengujian. */
  async function tick() {
    if (busy) return;
    const s = deps.settings();
    if (!s.enabled || !s.token || !s.url) return;
    if (Date.now() < backoffUntil) return;
    const max = (deps.globalCfg() && deps.globalCfg().maxConcurrent) || 2;
    if (deps.runner.runningCount() >= max) return;
    busy = true;
    try {
      const r = await api(s, "GET", `/api/claude-queue/next?v=${encodeURIComponent(deps.version)}`);
      if (r.status === 401) {
        warn("token integrasi ditolak My Workspace. Buat token di Pengaturan > Integrasi dan simpan di %USERPROFILE%\\.myworkspace-token");
        backoffUntil = Date.now() + 5 * 60 * 1000;
        return;
      }
      if (!r.ok) {
        warn(`My Workspace membalas ${r.status}: ${r.json.error || ""}`);
        backoffUntil = Date.now() + 60 * 1000;
        return;
      }
      if (lastError) deps.log("[antrian] tersambung lagi");
      lastError = "";
      lastOkAt = Date.now();
      if (r.json.job) await handle(s, r.json.job);
    } catch (e) {
      warn(`My Workspace tidak bisa dihubungi (${s.url}): ${e.message}`);
      backoffUntil = Date.now() + 30 * 1000;
    } finally {
      busy = false;
    }
  }

  function start() {
    if (timer) return;
    const s = deps.settings();
    if (!s.enabled) return deps.log("[antrian] nonaktif (apps.json queue.enabled = false)");
    if (!s.token) return deps.log("[antrian] nonaktif: token integrasi belum ada (%USERPROFILE%\\.myworkspace-token atau env MW_TOKEN)");
    deps.log(`[antrian] aktif, memeriksa ${s.url} setiap ${Math.round(s.intervalMs / 1000)} detik`);
    timer = setInterval(() => void tick(), s.intervalMs);
    void tick();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function status() {
    const s = deps.settings();
    return { enabled: !!(s.enabled && s.token), url: s.url, lastOkAt: lastOkAt || null, lastError: lastError || null, lastJob };
  }

  return { start, stop, tick, status };
}

module.exports = { createQueuePoller, matchApp };
