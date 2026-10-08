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
  const finalizing = new Set(); // app yang sedang verifikasi/commit/push
  const gitflow = deps.gitflow || require("./gitflow.cjs");

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
    if (runner.isRunning(app.id) || finalizing.has(app.id)) {
      // project sedang dikerjakan instruksi lain (atau masih commit/verifikasi): kembalikan, coba lagi nanti
      deps.log(`[antrian] ${app.id} sedang menjalankan instruksi lain, job dikembalikan ke antrian`);
      await release(s, job.id);
      backoffUntil = Date.now() + 30000;
      return;
    }
    const reportRun = (run, note, gitText) => {
      // batas 12.000 karakter: potong jawaban Claude, catatan & hasil commit selalu utuh
      const room = Math.max(0, 11000 - (note || "").length - (gitText || "").length);
      const full = run.result && run.result.text ? String(run.result.text) : "";
      const text = full.length > room ? `${full.slice(0, room)}\n…(dipotong, lengkapnya di log agent)` : full;
      const answer = [note, text, gitText].filter(Boolean).join("\n\n");
      return report(s, job.id, {
        status: run.status,
        summary: run.summary || null,
        files: run.files || [],
        error: run.error || null,
        costUsd: run.result && typeof run.result.costUsd === "number" ? run.result.costUsd : null,
        // jawaban lengkap Claude (tanpa baris RINGKASAN) + hasil commit/push, diteruskan ke Telegram
        answer: answer || null,
        // ID sesi Claude, agar perintah "lanjutkan" berikutnya bisa meneruskan sesi ini
        sessionId: (run.result && run.result.sessionId) || null,
      });
    };

    // commit & push otomatis (apps.json claude.git.autoCommit): potret kondisi repo sebelum Claude jalan
    const gitCfg = job.mode === "edit" ? gitflow.gitConfig(app) : null;
    const gitOpts = gitflow.jobGitOptions(job.instruction);
    let snap = null;
    if (gitCfg && gitOpts.commit) {
      try {
        snap = await gitflow.snapshot(gitCfg);
        if (snap.skip) deps.log(`[antrian] commit otomatis ${app.id} dilewati: ${snap.skip}`);
      } catch (e) {
        snap = { skip: `snapshot gagal: ${e.message}` };
      }
    }

    /** Selesai: (bila perlu) commit & push dulu, lalu lapor. Project dikunci selama commit/verifikasi. */
    const finish = async (run, note) => {
      let gitText = "";
      if (snap && run.status === "done") {
        finalizing.add(app.id);
        try {
          const g = await gitflow.finalize(gitCfg, snap, { jobId: job.id, instruction: job.instruction, summary: run.summary, opts: gitOpts });
          gitText = g.text;
          deps.log(`[antrian] git ${app.id}: ${g.status}${g.commit ? ` ${g.commit}` : ""}`);
        } catch (e) {
          gitText = `⚠️ Commit otomatis gagal: ${e.message}`;
        } finally {
          finalizing.delete(app.id);
        }
      }
      return reportRun(run, note, gitText);
    };

    /** Jalankan Claude; resume = ID sesi lama (perintah "lanjutkan"). */
    const startRun = (resume) => {
      const opts = deps.normalizeRequest({ prompt: job.instruction, mode: job.mode, model: job.model, resume }, app.claude, deps.globalCfg());
      if (opts.error) return { reported: report(s, job.id, { status: "error", error: opts.error }) };
      opts.onFinish = (run) => {
        // sesi lama sudah tidak ada di laptop (riwayat Claude dibersihkan / folder pindah): ulangi sekali sebagai sesi baru
        if (resume && run.status === "error" && /no conversation found|session/i.test(String(run.error || ""))) {
          deps.log(`[antrian] sesi lama tidak ditemukan, job ${job.id.slice(0, 8)} diulang sebagai sesi baru`);
          const again = startRun(null);
          if (again.error) reportRun({ ...run, error: again.error });
          return;
        }
        void finish(run, resume === null && job.resume ? "ℹ️ Sesi sebelumnya tidak ditemukan di laptop, dikerjakan sebagai sesi baru." : null);
      };
      const r = deps.runner.start(app, opts, deps.globalCfg());
      if (!r.error) deps.log(`[antrian] menjalankan job ${job.id.slice(0, 8)} di ${app.id} (${opts.mode}, ${opts.model}${resume ? ", lanjutan sesi" : ""}${snap && snap.ok ? ", commit otomatis" : ""})`);
      return r;
    };

    const r = startRun(job.resume || null);
    if (r.reported) return r.reported;
    if (r.error) {
      if (r.status === 409 || r.status === 429) {
        deps.log(`[antrian] belum bisa dijalankan (${r.error}), job dikembalikan ke antrian`);
        await release(s, job.id);
        backoffUntil = Date.now() + 30000;
        return;
      }
      return report(s, job.id, { status: "error", error: r.error });
    }
  }

  /** Satu putaran pemeriksaan antrian. Diekspor untuk pengujian. */
  async function tick() {
    if (busy) return;
    const s = deps.settings();
    if (!s.enabled || !s.token || !s.url) return;
    if (Date.now() < backoffUntil) return;
    const max = (deps.globalCfg() && deps.globalCfg().maxConcurrent) || 2;
    if (deps.runner.runningCount() + finalizing.size >= max) return;
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
      lastOkAt = Date.now();
      if (r.json.reason) {
        // ada job antri tapi server gagal mengambilnya: catat alasannya (sekali per alasan)
        warn(`ada ${r.json.pending || "?"} job antri tapi tidak terambil: ${r.json.reason}`);
        return;
      }
      if (lastError) deps.log("[antrian] tersambung lagi");
      lastError = "";
      if (r.json.job) {
        deps.log(`[antrian] job ${String(r.json.job.id).slice(0, 8)} diambil: ${r.json.job.project}`);
        await handle(s, r.json.job);
      }
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
