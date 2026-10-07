import { describe, it, expect, vi, beforeEach } from "vitest";

/** Supabase palsu: mencatat setiap insert/update per tabel, hasil select diatur per tabel. */
const calls: { table: string; op: string; row?: any }[] = [];
let selectResult: Record<string, any> = {};

function chain(table: string) {
  const q: any = {
    select: () => q,
    eq: () => q,
    ilike: () => q,
    contains: () => q,
    limit: () => Promise.resolve({ data: selectResult[table] ?? [], error: null }),
    single: () =>
      Promise.resolve(
        table === "integration_tokens"
          ? { data: { id: "t1", user_id: "u1", name: "x" }, error: null }
          : { data: { id: "a1", summary: "s", project_id: "p1", source: "antigravity" }, error: null }
      ),
    insert: (row: any) => {
      calls.push({ table, op: "insert", row });
      return q;
    },
    update: (row: any) => {
      calls.push({ table, op: "update", row });
      return q;
    },
    then: (res: any) => Promise.resolve({ data: null, error: null }).then(res),
  };
  return q;
}

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({ from: (t: string) => chain(t) }) }));

import { POST } from "@/app/api/activity/route";

const req = (body: any) =>
  new Request("http://x/api/activity", {
    method: "POST",
    headers: { authorization: "Bearer tok", "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;

beforeEach(() => {
  calls.length = 0;
  selectResult = { projects: [{ id: "p1", name: "RapiUang" }], notes: [] };
});

describe("POST /api/activity + handoff", () => {
  it("menyimpan handoff baru sebagai dokumen lengkap, rahasia disamarkan", async () => {
    const res = await POST(req({ project: "RapiUang", summary: "fitur x", source: "antigravity", handoff: { file_name: "HANDOFF.md", content: "# H\nJWT_SECRET=abc123def" } }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.handoff).toMatchObject({ saved: true, title: "📚 HANDOFF.md", redacted: 1 });
    const note = calls.find((c) => c.table === "notes" && c.op === "insert")!.row;
    expect(note).toMatchObject({ user_id: "u1", project_id: "p1", tags: ["dokumen-lengkap", "handoff"], scope: "work" });
    expect(note.content).not.toContain("abc123def");
  });

  it("memperbarui catatan lama bila sudah ada", async () => {
    selectResult.notes = [{ id: "n1" }];
    await POST(req({ project: "RapiUang", summary: "y", handoff: { content: "# H" } }));
    expect(calls.some((c) => c.table === "notes" && c.op === "update")).toBe(true);
    expect(calls.some((c) => c.table === "notes" && c.op === "insert")).toBe(false);
  });

  it("project tidak ditemukan: aktivitas tetap tercatat, handoff tidak", async () => {
    selectResult.projects = [];
    const json = await (await POST(req({ project: "Tidak Ada", summary: "z", handoff: { content: "# H" } }))).json();
    expect(json.success).toBe(true);
    expect(json.handoff.saved).toBe(false);
    expect(calls.some((c) => c.table === "notes")).toBe(false);
  });
});
