import { describe, it, expect, vi, beforeEach } from "vitest";

const ID = "3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const log: string[] = [];
let claimable: any = null;
let swept: any[] = [];
vi.mock("@/lib/claudeQueue/agentApi", () => ({
  authAgent: async (h: string | null) => (h === "Bearer ok" ? { userId: "u1" } : null),
  heartbeat: async (_u: string, v: string | null) => void log.push(`hb ${v}`),
  sweep: async () => swept,
  claimNext: async () => (claimable ? { job: claimable, pending: 1 } : { job: null, pending: 0 }),
  releaseJob: async (_u: string, id: string) => (log.push(`release ${id}`), true),
  finishJob: async (_u: string, id: string, body: any) => (body.status === "done" ? { id, status: "done" } : null),
}));
vi.mock("@/lib/claudeQueue/notify", () => ({
  notifyStarted: async (j: any) => void log.push(`card ${j.id}`),
  notifyFinished: async (j: any) => void log.push(`finished ${j.id}`),
}));

import { GET } from "@/app/api/claude-queue/next/route";
import { POST } from "@/app/api/claude-queue/[id]/route";
import { NextRequest } from "next/server";

const get = (auth?: string) => new NextRequest("https://x/api/claude-queue/next?v=1.5.0", { headers: auth ? { authorization: auth } : {} });
const post = (id: string, body: any, auth = "Bearer ok") =>
  POST(new NextRequest(`https://x/api/claude-queue/${id}`, { method: "POST", headers: { authorization: auth, "content-type": "application/json" }, body: JSON.stringify(body) }), {
    params: { id },
  });

beforeEach(() => {
  log.length = 0;
  claimable = null;
  swept = [];
});

describe("/api/claude-queue", () => {
  it("token salah ditolak", async () => {
    expect((await GET(get())).status).toBe(401);
    expect((await GET(get("Bearer x"))).status).toBe(401);
    expect((await post(ID, { action: "release" }, "Bearer x")).status).toBe(401);
  });
  it("next: detak agent, kabar job kedaluwarsa, ambil job & perbarui kartu", async () => {
    swept = [{ id: "old" }];
    claimable = { id: ID, project: "RapiUang", instruction: "x", mode: "edit", model: "sonnet", chat_id: 1, message_id: 2 };
    const j = await (await GET(get("Bearer ok"))).json();
    expect(j.job).toEqual({ id: ID, project: "RapiUang", instruction: "x", mode: "edit", model: "sonnet", resume: null });
    expect(log).toEqual(["hb 1.5.0", "finished old", `card ${ID}`]);
    claimable = null;
    expect(await (await GET(get("Bearer ok"))).json()).toEqual({ job: null });
  });
  it("release & result", async () => {
    expect(await (await post(ID, { action: "release" })).json()).toEqual({ ok: true });
    expect((await post(ID, { action: "result", status: "done" })).status).toBe(200);
    expect((await post(ID, { action: "result", status: "error" })).status).toBe(404);
    expect((await post("bukan-id", { action: "result" })).status).toBe(400);
    expect((await post(ID, { action: "aneh" })).status).toBe(400);
    expect(log).toEqual([`release ${ID}`, `finished ${ID}`]);
  });
});

describe("database tidak terjangkau", () => {
  it("503 (bukan 401) agar agent tidak mengira token salah", async () => {
    const mod: any = await import("@/lib/claudeQueue/agentApi");
    const orig = mod.authAgent;
    mod.authAgent = async () => {
      throw new Error("fetch failed");
    };
    try {
      expect((await GET(get("Bearer ok"))).status).toBe(503);
      expect((await post(ID, { action: "release" })).status).toBe(503);
    } finally {
      mod.authAgent = orig;
    }
  });
});
