import { describe, it, expect, beforeEach } from "vitest";
import { createRequire } from "module";
import { EventEmitter } from "events";
import os from "os";

const require = createRequire(import.meta.url);
const cc = require("../agent/claude.cjs");
const { createQueuePoller, matchApp } = require("../agent/queue.cjs");

/* ---------- proses claude tiruan ---------- */
function fakeChild() {
  const c: any = new EventEmitter();
  c.stdout = new EventEmitter();
  c.stderr = new EventEmitter();
  c.pid = 4242;
  return c;
}

const APPS = [
  { id: "rapiuang", name: "Rapiuang", folder: os.tmpdir(), processes: [{ name: "web", cwd: os.tmpdir(), command: "x" }], claude: { mode: "edit", project: "RapiUang" } },
  { id: "siap-tpm", name: "SIAP TPM", folder: os.tmpdir(), processes: [{ name: "web", cwd: os.tmpdir(), command: "x" }], claude: { mode: "read" } },
];
const GLOBAL = { maxConcurrent: 2, timeoutMinutes: 30, path: "claude" };

describe("runner Claude: onFinish", () => {
  it("dipanggil sekali saat selesai, membawa ringkasan & biaya", async () => {
    let child: any;
    const runner = cc.createClaudeRunner({ spawn: () => (child = fakeChild()), killTree: async () => {}, log: () => {}, logDir: os.tmpdir(), scriptsDir: "/tidak-ada", execPath: "node" });
    const finished: any[] = [];
    const opts = cc.normalizeRequest({ prompt: "Analisis struktur folder", mode: "read", model: "haiku" }, APPS[0].claude, GLOBAL);
    opts.onFinish = (run: any) => finished.push(run);
    expect(runner.start(APPS[0], opts, GLOBAL)).toMatchObject({ ok: true });
    child.stdout.emit(
      "data",
      Buffer.from(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "Selesai.\nRINGKASAN: Struktur aman", total_cost_usd: 0.02, session_id: "s1" }) + "\n")
    );
    child.emit("close", 0);
    child.emit("close", 0); // tidak boleh memanggil dua kali
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ status: "done", summary: "Struktur aman" });
    expect(finished[0].result.costUsd).toBe(0.02);
  });
});

/* ---------- server My Workspace tiruan ---------- */
type Job = { id: string; project: string; instruction: string; mode: string; model: string };
let queue: Job[];
let reports: any[];
let releases: string[];
let nextStatus: number;
function fakeFetch(url: string, init: any) {
  const u = new URL(url);
  const auth = init.headers.Authorization;
  const reply = (status: number, body: any) => Promise.resolve({ ok: status < 300, status, json: async () => body });
  if (auth !== "Bearer tok") return reply(401, { error: "Token tidak valid" });
  if (u.pathname === "/api/claude-queue/next") {
    if (nextStatus !== 200) return reply(nextStatus, { error: "x" });
    return reply(200, { job: queue.shift() || null });
  }
  const id = u.pathname.split("/").pop()!;
  const body = JSON.parse(init.body);
  if (body.action === "release") releases.push(id);
  else reports.push({ id, ...body });
  return reply(200, { ok: true });
}

function fakeRunner() {
  const running = new Set<string>();
  const started: any[] = [];
  return {
    started,
    running,
    isRunning: (id: string) => running.has(id),
    runningCount: () => running.size,
    start(app: any, opts: any) {
      if (running.has(app.id)) return { error: "sibuk", status: 409 };
      running.add(app.id);
      started.push({ app: app.id, opts });
      return { ok: true, runId: "r1" };
    },
    finish(appId: string, run: any) {
      running.delete(appId);
      [...started].reverse().find((s) => s.app === appId).opts.onFinish(run);
    },
  };
}

function poller(runner: any, token = "tok", gitflow?: any) {
  const logs: string[] = [];
  const p = createQueuePoller({
    fetch: fakeFetch,
    log: (m: string) => logs.push(m),
    version: "1.5.0",
    settings: () => ({ enabled: true, url: "http://mw.test", token, intervalMs: 10000 }),
    apps: () => APPS,
    globalCfg: () => GLOBAL,
    runner,
    normalizeRequest: cc.normalizeRequest,
    ...(gitflow ? { gitflow } : {}),
  });
  return { p, logs };
}

const job = (over: Partial<Job> = {}): Job => ({ id: "3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f", project: "RapiUang", instruction: "Tambah filter kategori transaksi", mode: "edit", model: "sonnet", ...over });

beforeEach(() => {
  queue = [];
  reports = [];
  releases = [];
  nextStatus = 200;
});

describe("poller antrian agent", () => {
  it("ambil job -> jalankan di app yang cocok -> laporkan hasil saat selesai", async () => {
    const r = fakeRunner();
    const { p } = poller(r);
    queue.push(job());
    await p.tick();
    expect(r.started[0]).toMatchObject({ app: "rapiuang", opts: { mode: "edit", model: "sonnet", prompt: "Tambah filter kategori transaksi" } });
    r.finish("rapiuang", { status: "done", summary: "Filter ditambah", files: ["src/a.tsx"], error: null, result: { costUsd: 0.05, text: "## Hasil\nFilter kategori ditambahkan di halaman transaksi." } });
    await new Promise((x) => setTimeout(x, 0));
    expect(reports).toEqual([
      {
        id: job().id,
        action: "result",
        status: "done",
        summary: "Filter ditambah",
        files: ["src/a.tsx"],
        error: null,
        costUsd: 0.05,
        answer: "## Hasil\nFilter kategori ditambahkan di halaman transaksi.",
        sessionId: null,
      },
    ]);
    expect(p.status()).toMatchObject({ enabled: true, lastJob: { project: "RapiUang" } });
  });

  it("project tidak terdaftar / dikunci baca saja: dilaporkan gagal tanpa menjalankan", async () => {
    const r = fakeRunner();
    const { p } = poller(r);
    queue.push(job({ project: "Portal Teknik" }));
    await p.tick();
    queue.push(job({ project: "SIAP TPM", mode: "edit" }));
    await p.tick();
    expect(r.started).toHaveLength(0);
    expect(reports.map((x) => x.error)).toEqual(['Project "Portal Teknik" tidak terdaftar di agent (apps.json).', expect.stringMatching(/BACA SAJA/)]);
  });

  it("project sedang sibuk: job dikembalikan ke antrian, tidak dilaporkan gagal", async () => {
    const r = fakeRunner();
    r.running.add("rapiuang");
    const { p } = poller(r);
    queue.push(job());
    await p.tick();
    expect(releases).toEqual([job().id]);
    expect(reports).toHaveLength(0);
  });

  it("kapasitas penuh: tidak mengambil job", async () => {
    const r = fakeRunner();
    r.running.add("a");
    r.running.add("b");
    const { p } = poller(r);
    queue.push(job());
    await p.tick();
    expect(queue).toHaveLength(1);
  });

  it("token ditolak / server error: dicatat sekali, lalu jeda", async () => {
    const { p, logs } = poller(fakeRunner(), "salah");
    await p.tick();
    await p.tick();
    expect(logs.filter((l) => l.includes("token integrasi ditolak"))).toHaveLength(1);
    nextStatus = 503;
    const b = poller(fakeRunner());
    await b.p.tick();
    expect(b.logs[0]).toMatch(/membalas 503/);
  });

  it("matchApp", () => {
    expect(matchApp("rapiuang", APPS).id).toBe("rapiuang");
    expect(matchApp("SIAP-TPM", APPS).id).toBe("siap-tpm");
    expect(matchApp("", APPS)).toBeNull();
  });
});

describe("lanjutkan sesi (resume)", () => {
  const SID = "0f5a9c7e-1111-4222-8333-444455556666";
  it("job lanjutan meneruskan sesi lama & ID sesi baru dilaporkan", async () => {
    const r = fakeRunner();
    const { p } = poller(r);
    queue.push({ ...job(), resume: SID } as any);
    await p.tick();
    expect(r.started[0].opts.resume).toBe(SID);
    r.finish("rapiuang", { status: "done", summary: "ok", files: [], result: { text: "Lanjutan beres", sessionId: SID } });
    await new Promise((x) => setTimeout(x, 0));
    expect(reports[0]).toMatchObject({ status: "done", sessionId: SID, answer: "Lanjutan beres" });
  });
  it("sesi lama tidak ada di laptop: diulang sekali sebagai sesi baru, dengan catatan", async () => {
    const r = fakeRunner();
    const { p, logs } = poller(r);
    queue.push({ ...job(), resume: SID } as any);
    await p.tick();
    r.finish("rapiuang", { status: "error", error: "No conversation found with session ID: " + SID, files: [] });
    expect(r.started).toHaveLength(2);
    expect(r.started[1].opts.resume).toBeNull();
    expect(logs.some((l) => /diulang sebagai sesi baru/.test(l))).toBe(true);
    r.finish("rapiuang", { status: "done", summary: "ok", files: [], result: { text: "Beres", sessionId: "aaaaaaaa-bbbb" } });
    await new Promise((x) => setTimeout(x, 0));
    expect(reports).toHaveLength(1);
    expect(reports[0].answer).toMatch(/^ℹ️ Sesi sebelumnya tidak ditemukan[\s\S]*Beres$/);
  });
  it("job biasa tanpa resume", async () => {
    const r = fakeRunner();
    const { p } = poller(r);
    queue.push(job());
    await p.tick();
    expect(r.started[0].opts.resume).toBeNull();
  });
});

describe("koleksi project (folder tambahan)", () => {
  it("--add-dir & larangan .env absolut untuk folder tambahan", () => {
    const opts = cc.normalizeRequest(
      { prompt: "Bandingkan login di semua project", mode: "read" },
      { mode: "read", addDirs: ["D:\\Rally District", "relatif/tidak-boleh", 5] },
      GLOBAL
    );
    expect(opts.addDirs).toEqual(["D:\\Rally District"]);
    const a: string[] = cc.buildArgs(opts);
    expect(a[a.indexOf("--add-dir") + 1]).toBe("D:\\Rally District");
    const denied = a[a.indexOf("--disallowedTools") + 1];
    expect(denied).toContain("Read(//d/Rally District/**/.env)");
    expect(denied).toContain("Read(//d/Rally District/**/.env.local)");
    expect(denied).toContain("Read(./**/.env)");
    expect(denied).toContain("Edit"); // tetap baca saja
    expect(a[a.length - 2]).toBe("--allowedTools");
  });
  it("absRuleRoot", () => {
    expect(cc.absRuleRoot("D:\\Biofarma\\Digitalisasi\\")).toBe("//d/Biofarma/Digitalisasi");
    expect(cc.absRuleRoot("/home/x/proj")).toBe("//home/x/proj");
    expect(cc.absRuleRoot("relatif")).toBeNull();
    expect(cc.buildArgs(cc.normalizeRequest({ prompt: "x analisis", mode: "read" }, { mode: "read" }, GLOBAL))).not.toContain("--add-dir");
  });
  it("koleksi tanpa proses bisa dijalankan (folder dari app.folder); folder tambahan hilang ditolak", () => {
    let spawned: any = null;
    const runner = cc.createClaudeRunner({ spawn: (_e: string, args: string[], o: any) => ((spawned = { args, cwd: o.cwd }), fakeChild()), killTree: async () => {}, log: () => {}, logDir: os.tmpdir(), scriptsDir: "/x", execPath: "node" });
    const app = { id: "koleksi", name: "Semua Project", folder: os.tmpdir(), processes: [], claude: { mode: "read", addDirs: [os.tmpdir()] } };
    const opts = cc.normalizeRequest({ prompt: "analisis semua", mode: "read" }, app.claude, GLOBAL);
    expect(runner.start(app, opts, GLOBAL)).toMatchObject({ ok: true });
    expect(spawned.cwd).toBe(os.tmpdir());
    expect(spawned.args).toContain("--add-dir");
    const bad = { ...app, id: "k2", claude: { mode: "read", addDirs: ["/tidak/ada/folder"] } };
    expect(runner.start(bad, cc.normalizeRequest({ prompt: "analisis semua", mode: "read" }, bad.claude, GLOBAL), GLOBAL)).toMatchObject({ status: 400, error: expect.stringMatching(/tidak ditemukan/) });
  });
});

describe("commit & push otomatis dari antrian", () => {
  const realGf = require("../agent/gitflow.cjs");
  function fakeGit() {
    let open: () => void = () => {};
    const gate = new Promise<void>((r) => (open = r));
    const calls: any[] = [];
    return {
      calls,
      open: () => open(),
      gitConfig: () => ({ repo: "/repo", push: true, verify: null }),
      jobGitOptions: realGf.jobGitOptions,
      snapshot: async () => (calls.push("snapshot"), { ok: true, branch: "main" }),
      finalize: async (_c: any, _s: any, info: any) => {
        calls.push(["finalize", info.summary, info.opts]);
        await gate;
        return { status: "pushed", commit: "abc1234", text: "📦 Commit `abc1234` di main (2 file).\n🚀 Di-push ke origin/main." };
      },
    };
  }
  it("hasil commit ditempel di jawaban; project terkunci selama verifikasi/commit", async () => {
    const r = fakeRunner();
    const g = fakeGit();
    const { p } = poller(r, "tok", g);
    queue.push(job());
    await p.tick();
    expect(g.calls[0]).toBe("snapshot");
    r.finish("rapiuang", { status: "done", summary: "Filter ditambah", files: ["a.ts"], result: { text: "Filter ditambahkan." } });
    await new Promise((x) => setTimeout(x, 0));
    expect(reports).toHaveLength(0); // laporan menunggu commit selesai
    g.open();
    await new Promise((x) => setTimeout(x, 10));
    expect(reports[0].answer).toBe("Filter ditambahkan.\n\n📦 Commit `abc1234` di main (2 file).\n🚀 Di-push ke origin/main.");
    expect(g.calls[1]).toEqual(["finalize", "Filter ditambah", { commit: true, push: true }]);
  });
  it("job gagal / mode baca / 'tanpa commit': tidak ada commit", async () => {
    const r = fakeRunner();
    const g = fakeGit();
    g.open();
    const { p } = poller(r, "tok", g);
    queue.push(job());
    await p.tick();
    r.finish("rapiuang", { status: "error", error: "x", files: [], result: null });
    await new Promise((x) => setTimeout(x, 0));
    queue.push(job({ instruction: "cek saja, tanpa commit" }));
    await p.tick();
    r.finish("rapiuang", { status: "done", summary: "ok", files: [], result: { text: "ok" } });
    await new Promise((x) => setTimeout(x, 0));
    expect(g.calls).toEqual(["snapshot"]);
    expect(reports.map((x) => x.status)).toEqual(["error", "done"]);
  });
  it("selama commit berjalan, job lain untuk project yang sama dikembalikan ke antrian", async () => {
    const r = fakeRunner();
    const g = fakeGit();
    const { p } = poller(r, "tok", g);
    queue.push(job());
    await p.tick();
    r.finish("rapiuang", { status: "done", summary: "ok", files: [], result: { text: "ok" } });
    await new Promise((x) => setTimeout(x, 0));
    queue.push(job({ id: "5f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f" }));
    await p.tick();
    expect(releases).toEqual(["5f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"]);
    expect(r.started).toHaveLength(1);
    g.open();
    await new Promise((x) => setTimeout(x, 10));
    expect(reports).toHaveLength(1);
  });
});
