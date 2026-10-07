import { describe, it, expect } from "vitest";
import {
  makeTitle,
  isMissingTable,
  sanitizeTasks,
  persistExchange,
  listConversations,
  loadConversation,
  retentionCutoff,
} from "@/lib/ai/conversationStore";

/** Supabase palsu di memori: cukup untuk alur select/insert/update/delete yang dipakai store. */
function fakeDb(opts: { missing?: boolean } = {}) {
  const tables: Record<string, any[]> = { ai_conversations: [], ai_messages: [] };
  let seq = 0;
  const missingErr = { code: "42P01", message: 'relation "ai_conversations" does not exist' };
  function q(table: string) {
    let op = "select";
    let payload: any = null;
    const filters: ((r: any) => boolean)[] = [];
    const orders: [string, boolean][] = [];
    let lim = Infinity;
    const run = () => {
      if (opts.missing) return { data: null, error: missingErr };
      const rows = tables[table];
      if (op === "insert") {
        const list = (Array.isArray(payload) ? payload : [payload]).map((r: any) => ({
          id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`,
          pinned: false,
          ...r,
        }));
        rows.push(...list);
        return { data: list, error: null };
      }
      let hit = rows.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        hit.forEach((r) => Object.assign(r, payload));
        return { data: hit, error: null };
      }
      if (op === "delete") {
        tables[table] = rows.filter((r) => !hit.includes(r));
        if (table === "ai_conversations")
          tables.ai_messages = tables.ai_messages.filter((m) => !hit.some((c) => c.id === m.conversation_id));
        return { data: hit, error: null };
      }
      for (const [col, asc] of [...orders].reverse())
        hit = [...hit].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      return { data: hit.slice(0, lim), error: null };
    };
    const api: any = {
      select: () => api,
      insert: (p: any) => ((op = "insert"), (payload = p), api),
      update: (p: any) => ((op = "update"), (payload = p), api),
      delete: () => ((op = "delete"), api),
      eq: (c: string, v: any) => (filters.push((r) => r[c] === v), api),
      lt: (c: string, v: any) => (filters.push((r) => r[c] < v), api),
      order: (c: string, o: any) => (orders.push([c, o?.ascending !== false]), api),
      limit: (n: number) => ((lim = n), api),
      single: () => {
        const r = run();
        return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
      },
      maybeSingle: () => {
        const r = run();
        return Promise.resolve({ data: r.data?.[0] ?? null, error: r.error });
      },
      then: (res: any, rej: any) => Promise.resolve(run()).then(res, rej),
    };
    return api;
  }
  return { from: q, tables };
}

describe("helper", () => {
  it("judul dari pesan pertama", () => {
    expect(makeTitle("Buatkan report PDF pengeluaran detail untuk RapiUang")).toBe("Buatkan report PDF pengeluaran detail untuk RapiUang");
    const long = makeTitle("Tolong siapkan instruksi untuk Claude agar menambahkan fitur export PDF mingguan dan bulanan di halaman laporan");
    expect(long.length).toBeLessThanOrEqual(61);
    expect(long.endsWith("…")).toBe(true);
    expect(makeTitle("[ISI FILE: nib.pdf | project: Rally]\nisi rahasia\n[/ISI FILE]")).toBe("Percakapan baru");
    expect(makeTitle("**NIB** Rally District?")).toBe("NIB Rally District?");
  });
  it("deteksi tabel belum ada", () => {
    expect(isMissingTable({ code: "42P01" })).toBe(true);
    expect(isMissingTable({ code: "PGRST205", message: "Could not find the table" })).toBe(true);
    expect(isMissingTable({ code: "23505", message: "duplicate" })).toBe(false);
  });
  it("sanitasi kartu Claude", () => {
    const t = sanitizeTasks([{ id: "ct1", project: "RapiUang", instruction: "x", mode: "hack", model: "gpt", extra: 1 }, { bad: true }]);
    expect(t).toEqual([{ id: "ct1", project: "RapiUang", instruction: "x", mode: "edit", model: "sonnet" }]);
    expect(sanitizeTasks([])).toBeNull();
  });
  it("batas retensi 180 hari", () => {
    expect(retentionCutoff(new Date("2026-10-07T00:00:00Z"))).toBe("2026-04-10T00:00:00.000Z");
  });
});

describe("store", () => {
  it("simpan tanya-jawab: percakapan baru lalu lanjutan, urutan benar", async () => {
    const db = fakeDb();
    const a = await persistExchange(db, "u1", {
      userContent: "Buatkan report PDF RapiUang",
      assistantContent: "Kartu siap",
      claudeTasks: [{ id: "ct1", project: "RapiUang", instruction: "Tambah export PDF", mode: "edit", model: "sonnet" }],
    });
    expect(a.available && a.created).toBe(true);
    if (!a.available) throw new Error();
    expect(a.title).toBe("Buatkan report PDF RapiUang");
    await new Promise((r) => setTimeout(r, 10));
    const b = await persistExchange(db, "u1", { conversationId: a.conversationId, userContent: "Lanjut", assistantContent: "Oke" });
    expect(b.available && !b.created && b.conversationId === a.conversationId).toBe(true);
    const loaded = await loadConversation(db, a.conversationId);
    expect(loaded!.messages.map((m) => `${m.role}:${m.content}`)).toEqual([
      "user:Buatkan report PDF RapiUang",
      "assistant:Kartu siap",
      "user:Lanjut",
      "assistant:Oke",
    ]);
    expect(loaded!.messages[1].claudeTasks?.[0].id).toBe("ct1");
  });

  it("id percakapan tidak dikenal -> buat baru", async () => {
    const db = fakeDb();
    const r = await persistExchange(db, "u1", { conversationId: "tidak-ada", userContent: "Halo", assistantContent: "Hai" });
    expect(r.available && r.created).toBe(true);
  });

  it("daftar: disematkan di atas, yang kedaluwarsa dihapus", async () => {
    const db = fakeDb();
    db.tables.ai_conversations.push(
      { id: "old", title: "Lama", pinned: false, last_message_at: "2025-01-01T00:00:00.000Z" },
      { id: "oldpin", title: "Lama disematkan", pinned: true, last_message_at: "2025-01-01T00:00:00.000Z" },
      { id: "new", title: "Baru", pinned: false, last_message_at: new Date().toISOString() }
    );
    db.tables.ai_messages.push({ id: "m1", conversation_id: "old", role: "user", content: "x" });
    const r = await listConversations(db);
    expect(r.available).toBe(true);
    expect(r.items.map((c) => c.id)).toEqual(["oldpin", "new"]);
    expect(db.tables.ai_messages).toEqual([]);
  });

  it("migration belum dijalankan -> available false, tidak melempar error", async () => {
    const db = fakeDb({ missing: true });
    expect((await listConversations(db)).available).toBe(false);
    expect((await persistExchange(db, "u1", { userContent: "a", assistantContent: "b" })).available).toBe(false);
  });
});
