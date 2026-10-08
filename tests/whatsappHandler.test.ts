import { describe, it, expect, vi, beforeEach } from "vitest";

/* ---------- tiruan dependensi ---------- */
const sent: { to: string; body: string }[] = [];
vi.mock("@/lib/whatsapp/api", () => ({
  sendText: vi.fn(async (to: string, body: string) => (sent.push({ to, body }), { ok: true, status: 200 })),
  markReadTyping: vi.fn(async () => ({ ok: true, status: 200 })),
}));
vi.mock("@/lib/chatbot/ownerSession", () => ({
  getOwnerSession: vi.fn(async () => ({ access_token: "at", refresh_token: "rt" })),
}));
const aiCalls: { messages: any[]; conversationId: string | null; session: string | undefined }[] = [];
let aiResponse: any = { response: "## Task hari ini\n- **Audit RLS**" };

// Supabase tiruan: tabel percakapan & pesan di memori
const db = { convs: [] as any[], msgs: [] as any[], inbound: new Set<string>() };
function userClient() {
  const q = (table: string) => {
    const f: ((r: any) => boolean)[] = [];
    let ins: any = null;
    let lim = 99;
    let desc = false;
    const rows = () => (table === "ai_conversations" ? db.convs : db.msgs);
    const api: any = {
      select: () => api,
      ilike: (c: string, p: string) => (f.push((r) => String(r[c]).startsWith(p.replace("%", ""))), api),
      eq: (c: string, v: any) => (f.push((r) => r[c] === v), api),
      order: (_c: string, o: any) => ((desc = o?.ascending === false), api),
      limit: (n: number) => ((lim = n), api),
      insert: (r: any) => ((ins = { id: `conv-${db.convs.length + 1}`, last_message_at: new Date().toISOString(), ...r }), api),
      single: async () => (rows().push(ins), { data: ins, error: null }),
      then: (res: any) => {
        let out = rows().filter((r) => f.every((x) => x(r)));
        if (desc) out = [...out].reverse();
        return Promise.resolve({ data: out.slice(0, lim), error: null }).then(res);
      },
    };
    return api;
  };
  return { from: q, auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } };
}
let currentSession: string | undefined;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => userClient(),
  createAdminClient: () => ({
    from: () => ({
      insert: async (r: any) => (db.inbound.has(r.message_id) ? { error: { code: "23505" } } : (db.inbound.add(r.message_id), { error: null })),
    }),
  }),
  runAsUser: async (s: any, fn: any) => {
    currentSession = s.access_token;
    try {
      return await fn();
    } finally {
      currentSession = undefined;
    }
  },
}));
vi.mock("@/lib/ai/service", () => ({
  sendAiQuery: vi.fn(async (messages: any[], conversationId: string | null) => {
    aiCalls.push({ messages, conversationId, session: currentSession });
    return aiResponse;
  }),
}));

import { handleInbound } from "@/lib/whatsapp/handler";

const now = () => Math.floor(Date.now() / 1000);
const msg = (id: string, text: string | null, from = "6281234567890") => ({ id, from, timestamp: now(), type: text ? "text" : "image", text, name: null });

beforeEach(() => {
  sent.length = 0;
  aiCalls.length = 0;
  process.env.WHATSAPP_OWNER_PHONE = "0812-3456-7890";
  aiResponse = { response: "## Task hari ini\n- **Audit RLS**" };
});

describe("handleInbound", () => {
  it("pemilik: AI dijalankan dengan sesi pemilik, percakapan WA dibuat, balasan berformat WA", async () => {
    await handleInbound(msg("w1", "Apa task saya hari ini?"));
    expect(aiCalls).toHaveLength(1);
    expect(aiCalls[0].session).toBe("at");
    expect(aiCalls[0].conversationId).toBe("conv-1");
    expect(db.convs[0].title.startsWith("📱 WhatsApp · ")).toBe(true);
    expect(aiCalls[0].messages).toEqual([{ role: "user", content: "Apa task saya hari ini?" }]);
    expect(sent[0]).toEqual({ to: "6281234567890", body: "*Task hari ini*\n• *Audit RLS*" });
  });

  it("pesan berikutnya memakai percakapan & riwayat yang sama", async () => {
    db.msgs.push({ conversation_id: "conv-1", role: "user", content: "Apa task saya hari ini?" }, { conversation_id: "conv-1", role: "assistant", content: "Audit RLS" });
    await handleInbound(msg("w2", "Tandai selesai"));
    expect(aiCalls[0].conversationId).toBe("conv-1");
    expect(aiCalls[0].messages.map((m: any) => m.content)).toEqual(["Apa task saya hari ini?", "Audit RLS", "Tandai selesai"]);
  });

  it("perintah 'baru' membuat percakapan baru tanpa memanggil AI", async () => {
    await handleInbound(msg("w3", "baru"));
    expect(aiCalls).toHaveLength(0);
    expect(db.convs).toHaveLength(2);
    expect(sent[0].body).toMatch(/Percakapan baru/);
  });

  it("kartu Claude Code & peringatan rahasia ditambahkan ke balasan", async () => {
    aiResponse = {
      response: "Instruksi siap.\n\n🔒 1 data rahasia ... disimpan di Vault.",
      claudeTasks: [{ id: "c1", project: "RapiUang", instruction: "x", mode: "edit", model: "sonnet" }],
      secretsSaved: ["Password X"],
    };
    await handleInbound(msg("w4", "suruh claude tambah filter di RapiUang"));
    expect(sent[0].body).toMatch(/Claude Code untuk \*RapiUang\*/);
    expect(sent[0].body).toMatch(/Vault di web/);
  });

  it("duplikat, nomor lain, dan pesan non-teks", async () => {
    await handleInbound(msg("w1", "Apa task saya hari ini?")); // id sudah diproses
    await handleInbound(msg("w5", "halo", "6289999999999"));
    expect(aiCalls).toHaveLength(0);
    expect(sent).toHaveLength(0);
    await handleInbound(msg("w6", null));
    expect(sent[0].body).toMatch(/baru bisa pesan teks/);
  });
});
