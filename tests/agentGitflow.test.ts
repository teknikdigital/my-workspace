import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createRequire } from "module";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const require = createRequire(import.meta.url);
const gf = require("../agent/gitflow.cjs");

const sh = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
let root: string, remote: string, repo: string;

beforeAll(() => {
  Object.assign(process.env, { GIT_AUTHOR_NAME: "Uji", GIT_AUTHOR_EMAIL: "uji@x.test", GIT_COMMITTER_NAME: "Uji", GIT_COMMITTER_EMAIL: "uji@x.test" });
});

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "gitflow-"));
  remote = path.join(root, "remote.git");
  repo = path.join(root, "app");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote]);
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  fs.writeFileSync(path.join(repo, "a.ts"), "export const a = 1;\n");
  fs.writeFileSync(path.join(repo, "user.ts"), "export const u = 1;\n");
  sh(repo, "add", ".");
  sh(repo, "commit", "-q", "-m", "awal");
  sh(repo, "remote", "add", "origin", remote);
  sh(repo, "push", "-q", "origin", "main");
});

const cfg = (over: any = {}) => ({ repo, push: true, verify: [], ...over });
const w = (f: string, s: string) => (fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true }), fs.writeFileSync(path.join(repo, f), s));
const fin = (c: any, snap: any, instruction = "Tambah fitur b") => gf.finalize(c, snap, { jobId: "job-1", instruction, summary: "Fitur b ditambah" });
const remoteLog = () => sh(remote, "log", "--format=%s", "main");

describe("commit & push otomatis", () => {
  it("hanya file milik Claude di-commit & di-push; perubahan Anda yang belum di-commit tetap tinggal", async () => {
    w("user.ts", "export const u = 2; // edit manual pemilik\n");
    const snap = await gf.snapshot(cfg());
    expect(snap.ok).toBe(true);
    // Claude bekerja
    w("a.ts", "export const a = 2;\n");
    w("lib/b.ts", "export const b = 1;\n");
    const r = await fin(cfg(), snap);
    expect(r.status).toBe("pushed");
    expect(r.text).toMatch(/📦 Commit `[0-9a-f]+` di main \(2 file/);
    expect(r.text).toContain("git revert");
    expect(remoteLog().split("\n")[0]).toBe("claude: Fitur b ditambah");
    expect(sh(repo, "show", "--name-only", "--format=", "HEAD").split("\n").sort()).toEqual(["a.ts", "lib/b.ts"]);
    expect(sh(repo, "log", "-1", "--format=%b")).toContain("Instruksi (Telegram): Tambah fitur b");
    expect(sh(repo, "status", "--porcelain")).toBe("M user.ts");
  });

  it("file yang Anda staging sebelumnya tidak ikut ter-commit", async () => {
    w("user.ts", "export const u = 3;\n");
    sh(repo, "add", "user.ts");
    const snap = await gf.snapshot(cfg());
    w("a.ts", "export const a = 9;\n");
    const r = await fin(cfg(), snap);
    expect(r.status).toBe("pushed");
    expect(sh(repo, "show", "--name-only", "--format=", "HEAD")).toBe("a.ts");
    expect(sh(repo, "status", "--porcelain")).toBe("M  user.ts");
  });

  it("Claude mengubah file yang sudah Anda ubah: tidak di-commit", async () => {
    w("user.ts", "export const u = 2;\n");
    const snap = await gf.snapshot(cfg());
    w("user.ts", "export const u = 2; export const v = 3;\n");
    w("a.ts", "export const a = 5;\n");
    const r = await fin(cfg(), snap);
    expect(r.status).toBe("blocked");
    expect(r.text).toContain("user.ts");
    expect(remoteLog()).toBe("awal");
  });

  it("tidak ada perubahan", async () => {
    const snap = await gf.snapshot(cfg());
    expect((await fin(cfg(), snap)).status).toBe("nochange");
  });

  it("file rahasia & pola rahasia: tidak di-commit", async () => {
    let snap = await gf.snapshot(cfg());
    w(".env.local", "X=1\n");
    expect((await fin(cfg(), snap)).text).toContain(".env.local");
    fs.rmSync(path.join(repo, ".env.local"));

    snap = await gf.snapshot(cfg());
    w("a.ts", `export const key = "sk-proj-${"a".repeat(40)}";\n`);
    const r = await fin(cfg(), snap);
    expect(r.status).toBe("blocked");
    expect(r.text).toContain("OpenAI key di a.ts");
    expect(remoteLog()).toBe("awal");
  });

  it(".env.example boleh di-commit", async () => {
    const snap = await gf.snapshot(cfg());
    w(".env.example", "OPENAI_API_KEY=\n");
    expect((await fin(cfg(), snap)).status).toBe("pushed");
  });

  it("verifikasi gagal: tidak di-commit, keluaran ditampilkan", async () => {
    const snap = await gf.snapshot(cfg());
    w("a.ts", "export const a = 3;\n");
    const r = await fin(cfg({ verify: ['node -e "console.log(\'tipe salah di a.ts\');process.exit(2)"'] }), snap);
    expect(r.status).toBe("blocked");
    expect(r.text).toContain("tipe salah di a.ts");
    expect(sh(repo, "log", "--format=%s")).toBe("awal");
  });

  it("verifikasi lulus: disebut di pesan", async () => {
    const snap = await gf.snapshot(cfg());
    w("a.ts", "export const a = 4;\n");
    const r = await fin(cfg({ verify: ['node -e "process.exit(0)"'] }), snap);
    expect(r.status).toBe("pushed");
    expect(r.text).toContain("lulus node -e");
  });

  it("remote lebih baru: push ditolak, commit tetap di laptop", async () => {
    const other = path.join(root, "other");
    execFileSync("git", ["clone", "-q", remote, other]);
    fs.writeFileSync(path.join(other, "c.ts"), "c\n");
    sh(other, "add", ".");
    sh(other, "commit", "-q", "-m", "dari perangkat lain");
    sh(other, "push", "-q", "origin", "main");
    const snap = await gf.snapshot(cfg());
    w("a.ts", "export const a = 7;\n");
    const r = await fin(cfg(), snap);
    expect(r.status).toBe("push-failed");
    expect(r.text).toContain("git pull --rebase");
    expect(sh(repo, "log", "-1", "--format=%s")).toBe("claude: Fitur b ditambah");
  });

  it("'jangan push' = commit saja; 'jangan commit' = dilewati; tanpa remote = commit saja", async () => {
    let snap = await gf.snapshot(cfg());
    w("a.ts", "export const a = 11;\n");
    let r = await fin(cfg(), snap, "Perbaiki a, jangan push dulu");
    expect(r.status).toBe("committed");
    expect(remoteLog()).toBe("awal");

    snap = await gf.snapshot(cfg());
    w("a.ts", "export const a = 12;\n");
    r = await fin(cfg(), snap, "perbaiki a tanpa commit");
    expect(r.status).toBe("skipped");

    sh(repo, "checkout", "-q", "--", "a.ts");
    sh(repo, "remote", "remove", "origin");
    snap = await gf.snapshot(cfg());
    w("a.ts", "export const a = 13;\n");
    r = await fin(cfg(), snap);
    expect(r.status).toBe("committed");
    expect(r.text).toContain("tanpa remote");
  });

  it("branch berubah selama proses: tidak di-commit", async () => {
    const snap = await gf.snapshot(cfg());
    sh(repo, "checkout", "-q", "-b", "lain");
    w("a.ts", "x\n");
    expect((await fin(cfg(), snap)).status).toBe("blocked");
  });

  it("bukan repo git: dilewati dengan catatan", async () => {
    const snap = await gf.snapshot(cfg({ repo: root }));
    expect(snap.skip).toMatch(/bukan repo git/);
    expect((await fin(cfg({ repo: root }), snap)).text).toMatch(/dilewati/);
  });
});

describe("aturan", () => {
  it("gitConfig hanya aktif untuk mode edit + autoCommit", () => {
    const app = (claude: any) => ({ id: "x", folder: "/p", processes: [], claude });
    expect(gf.gitConfig(app({ mode: "edit" }))).toBeNull();
    expect(gf.gitConfig(app({ mode: "read", git: { autoCommit: true } }))).toBeNull();
    expect(gf.gitConfig(app({ mode: "edit", git: { autoCommit: true, repo: "main-app/r" } }))).toEqual({ repo: path.resolve("/p", "main-app/r"), push: true, verify: null });
    expect(gf.gitConfig(app({ mode: "edit", git: { autoCommit: true, push: false, verify: ["npx tsc --noEmit", ""] } }))).toMatchObject({ push: false, verify: ["npx tsc --noEmit"] });
  });
  it("opsi dari instruksi", () => {
    expect(gf.jobGitOptions("perbaiki bug")).toEqual({ commit: true, push: true });
    expect(gf.jobGitOptions("perbaiki bug, jangan push")).toEqual({ commit: true, push: false });
    expect(gf.jobGitOptions("Perbaiki, gak usah dicommit")).toEqual({ commit: false, push: false });
  });
  it("path rahasia", () => {
    for (const p of [".env", ".env.local", "app/.env.production", "vercel.env", "certs/server.key", "id_rsa", "service-account-prod.json"]) expect(gf.isSensitivePath(p)).toBe(true);
    for (const p of [".env.example", "src/env.ts", "lib/keys.ts", "README.md"]) expect(gf.isSensitivePath(p)).toBe(false);
  });
  it("porcelain -z dengan rename", () => {
    expect(gf.parsePorcelainZ(" M a.ts\0R  baru.ts\0lama.ts\0?? lib/x y.ts\0")).toEqual(["a.ts", "baru.ts", "lama.ts", "lib/x y.ts"]);
  });
});
