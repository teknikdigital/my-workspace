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
      started.find((s) => s.app === appId).opts.onFinish(run);
    },
  };
}

function poller(runner: any, token = "tok") {
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
    r.finish("rapiuang", { status: "done", summary: "Filter ditambah", files: ["src/a.tsx"], error: null, result: { costUsd: 0.05 } });
    await new Promise((x) => setTimeout(x, 0));
    expect(reports).toEqual([{ id: job().id, action: "result", status: "done", summary: "Filter ditambah", files: ["src/a.tsx"], error: null, costUsd: 0.05 }]);
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
