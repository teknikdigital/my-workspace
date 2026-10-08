import { describe, it, expect, vi, beforeEach } from "vitest";
import { markdownToDocx } from "@/lib/documents/markdownToDocx";

/* ---------- tiruan Telegram API ---------- */
const calls: { method: string; body: any }[] = [];
let failHtml = false;
let downloadData: Buffer | null = null;
let msgSeq = 500;
vi.mock("@/lib/telegram/api", () => {
  const tgCall = async (method: string, body: any) => {
    calls.push({ method, body });
    if (method === "sendMessage" && body.parse_mode === "HTML" && failHtml) return { ok: false, status: 400, error: "can't parse entities" };
    return { ok: true, status: 200, result: method === "sendMessage" ? { message_id: msgSeq++ } : true };
  };
  return {
    MAX_DOWNLOAD_BYTES: 20 * 1024 * 1024,
    tgCall,
    sendHtml: (chatId: number, html: string, o: any = {}) =>
      tgCall("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", reply_markup: o.replyMarkup, reply_to: o.replyTo }),
    sendPlain: (chatId: number, text: string) => tgCall("sendMessage", { chat_id: chatId, text }),
    editHtml: (chatId: number, messageId: number, html: string, markup?: any) =>
      tgCall("editMessageText", { chat_id: chatId, message_id: messageId, text: html, reply_markup: markup }),
    answerCallback: (id: string, text?: string) => tgCall("answerCallbackQuery", { callback_query_id: id, text }),
    sendDocument: async (chatId: number, data: Buffer, name: string, caption?: string) => tgCall("sendDocument", { chat_id: chatId, data, name, caption }),
    downloadFile: async () => (downloadData ? { ok: true, data: downloadData } : { ok: false, error: "tidak ada" }),
    keepTyping: (chatId: number, _ms?: number, action = "typing") => (void tgCall("sendChatAction", { chat_id: chatId, action }), () => {}),
  };
});

/* ---------- tiruan inti bot & antrian ---------- */
const turns: { text: string; forceNew: boolean }[] = [];
let turnResult: any = { text: "## Task\n- **Audit RLS**", conversationId: "conv-1" };
const dedupe = new Set<string>();
vi.mock("@/lib/chatbot/runner", () => ({
  firstTime: async (k: string) => (dedupe.has(k) ? false : (dedupe.add(k), true)),
  withOwner: async (fn: any) => fn(),
  runOwnerTurn: async (_spec: any, text: string, forceNew: boolean) => {
    turns.push({ text, forceNew });
    if (turnResult instanceof Error) throw turnResult;
    return turnResult;
  },
}));

const JOB = "3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const jobs: any[] = [];
let queueResult: any;
vi.mock("@/lib/claudeQueue/jobs", () => ({
  createDraftJob: async (t: any, meta: any) => {
    const job = { id: JOB, project: t.project, instruction: t.instruction, mode: t.mode, model: t.model, status: "draft", ...meta };
    jobs.push(job);
    return { ok: true, job };
  },
  setJobMessage: async (id: string, mid: number) => {
    const j = jobs.find((x) => x.id === id);
    if (j) j.message_id = mid;
  },
  queueJob: async () => queueResult,
  cancelJob: async () => ({ ok: true, job: { ...jobs[0], status: "cancelled" } }),
}));

import { handleTelegram, handleTelegramCallback, fileBuffer, TELEGRAM_CHANNEL } from "@/lib/telegram/handler";

let uid = 100;
const msg = (text: string | null, over: Partial<any> = {}) => ({
  updateId: uid++,
  messageId: 1,
  chatId: 42,
  chatType: "private",
  fromId: 42,
  fromName: "Ari",
  date: Math.floor(Date.now() / 1000),
  kind: text === null ? "photo" : "text",
  text,
  caption: null,
  document: null,
  ...over,
});
const sent = () => calls.filter((c) => c.method === "sendMessage").map((c) => c.body.text);

beforeEach(() => {
  calls.length = 0;
  turns.length = 0;
  jobs.length = 0;
  failHtml = false;
  downloadData = null;
  turnResult = { text: "## Task\n- **Audit RLS**", conversationId: "conv-1" };
  process.env.TELEGRAM_OWNER_ID = "42";
});

describe("handleTelegram: teks", () => {
  it("pemilik: AI dijalankan, balasan HTML, indikator mengetik", async () => {
    await handleTelegram(msg("Apa task saya hari ini?"));
    expect(turns).toEqual([{ text: "Apa task saya hari ini?", forceNew: false }]);
    expect(calls[0]).toMatchObject({ method: "sendChatAction", body: { action: "typing" } });
    expect(sent()).toEqual(["<b>Task</b>\n• <b>Audit RLS</b>"]);
    expect(TELEGRAM_CHANNEL.channel).toBe("telegram");
    expect(TELEGRAM_CHANNEL.claudeNote).toBeUndefined();
  });

  it("/baru & /start", async () => {
    turnResult = { text: "Percakapan baru dimulai.", conversationId: "c" };
    await handleTelegram(msg("/baru"));
    expect(turns[0].forceNew).toBe(true);
    await handleTelegram(msg("/start"));
    expect(turns).toHaveLength(1);
    expect(sent()[1]).toMatch(/<b>My Workspace via Telegram<\/b>/);
    expect(sent()[1]).toMatch(/TOR/);
  });

  it("HTML ditolak -> kirim ulang teks biasa", async () => {
    failHtml = true;
    await handleTelegram(msg("halo"));
    const s = calls.filter((c) => c.method === "sendMessage");
    expect(s).toHaveLength(2);
    expect(s[1].body.parse_mode).toBeUndefined();
  });

  it("orang lain, grup, duplikat, pesan lama: diabaikan", async () => {
    await handleTelegram(msg("halo", { fromId: 99, chatId: 99 }));
    await handleTelegram(msg("halo", { chatType: "group" }));
    const m = msg("halo");
    await handleTelegram(m);
    await handleTelegram(m);
    await handleTelegram(msg("halo", { date: Math.floor(Date.now() / 1000) - 3600 }));
    expect(turns).toHaveLength(1);
  });

  it("owner belum diisi: hanya membalas ID, tanpa AI", async () => {
    delete process.env.TELEGRAM_OWNER_ID;
    await handleTelegram(msg("halo", { fromId: 555, chatId: 555 }));
    expect(turns).toHaveLength(0);
    expect(sent()[0]).toMatch(/ID Telegram Anda: 555/);
  });

  it("foto & error", async () => {
    await handleTelegram(msg(null));
    expect(sent()[0]).toMatch(/Foto belum bisa dibaca/);
    turnResult = new Error("Gagal verifikasi sesi");
    await handleTelegram(msg("halo"));
    expect(sent()[1]).toMatch(/kesalahan di My Workspace: Gagal verifikasi sesi/);
  });
});

describe("handleTelegram: file masuk", () => {
  it("Word dikirim ke bot -> teks diekstrak, dikirim ke AI sebagai blok [ISI FILE] + keterangan", async () => {
    downloadData = await markdownToDocx("## Data\nNIB 1503220029113 atas nama ARI DARMAWAN TANJUNG", { title: "NIB Rally" });
    await handleTelegram(
      msg(null, { kind: "document", caption: "ini NIB Rally District", document: { fileId: "F1", fileName: "nib.docx", fileSize: 9000, mime: null } })
    );
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toMatch(/^\[ISI FILE: nib\.docx \| project: {2}\| lokasi: Telegram\]\n/);
    expect(turns[0].text).toMatch(/NIB 1503220029113/);
    expect(turns[0].text).toMatch(/\n\[\/ISI FILE\]\n\nini NIB Rally District$/);
  });

  it("jenis tidak didukung / terlalu besar / gagal unduh: ditolak tanpa AI", async () => {
    await handleTelegram(msg(null, { kind: "document", document: { fileId: "F", fileName: "slide.pptx", fileSize: 10, mime: null } }));
    await handleTelegram(msg(null, { kind: "document", document: { fileId: "F", fileName: "besar.pdf", fileSize: 30 * 1024 * 1024, mime: null } }));
    await handleTelegram(msg(null, { kind: "document", document: { fileId: "F", fileName: "a.pdf", fileSize: 10, mime: null } }));
    await handleTelegram(msg(null, { kind: "document", document: { fileId: "F", fileName: "foto.jpg", fileSize: 10, mime: null } }));
    expect(turns).toHaveLength(0);
    expect(sent()[0]).toMatch(/belum didukung/);
    expect(sent()[1]).toMatch(/20 MB/);
    expect(sent()[2]).toMatch(/Gagal mengambil file/);
    expect(sent()[3]).toMatch(/Gambar belum bisa dibaca/);
  });
});

describe("handleTelegram: dokumen keluar", () => {
  it("file dari AI dikirim sebagai .docx (zip valid) dan .md", async () => {
    turnResult = {
      text: "TOR siap.",
      conversationId: "c",
      files: [
        { title: "TOR Rapat Isolator", format: "docx", markdown: "## Latar Belakang\nIsi", source: "created" },
        { title: "Catatan / Rapat", format: "md", markdown: "isi md", source: "stored" },
      ],
    };
    await handleTelegram(msg("buatkan TOR"));
    const docs = calls.filter((c) => c.method === "sendDocument");
    expect(docs.map((d) => d.body.name)).toEqual(["TOR-Rapat-Isolator.docx", "Catatan-Rapat.md"]);
    expect(docs[0].body.data.subarray(0, 2).toString()).toBe("PK");
    expect(docs[1].body.data.toString()).toBe("# Catatan / Rapat\n\nisi md\n");
    expect(calls.some((c) => c.method === "sendChatAction" && c.body.action === "upload_document")).toBe(true);
  });

  it("dokumen unggahan: file ASLI dari folder _Masuk yang dikirim; bila tidak ada, versi teks + penjelasan", async () => {
    const fs = await import("fs");
    const os = await import("os");
    const path = await import("path");
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "mw-tg-"));
    fs.mkdirSync(path.join(base, "_Masuk"));
    fs.writeFileSync(path.join(base, "_Masuk", "nib_rally_district.pdf"), "%PDF-1.4 NIB");
    const apps = path.join(base, "apps.json");
    fs.writeFileSync(apps, JSON.stringify({ apps: [{ id: "rally", folder: base, processes: [{ cwd: base }] }] }));
    process.env.MW_AGENT_APPS = apps;
    turnResult = {
      text: "Ini NIB Rally District.",
      conversationId: "c",
      files: [
        { title: "nib_rally_district", format: "docx", markdown: "teks NIB", source: "stored", originalPath: path.join(base, "_Masuk", "nib_rally_district.pdf") },
        { title: "lama", format: "docx", markdown: "teks lama", source: "stored", originalPath: path.join(base, "_Masuk", "hilang.pdf") },
      ],
    };
    await handleTelegram(msg("kirim NIB rally district pdf"));
    delete process.env.MW_AGENT_APPS;
    const docs = calls.filter((c) => c.method === "sendDocument");
    expect(docs[0].body).toMatchObject({ name: "nib_rally_district.pdf", caption: "nib_rally_district (file asli)" });
    expect(docs[0].body.data.toString()).toBe("%PDF-1.4 NIB");
    expect(docs[1].body.name).toBe("lama.docx");
    expect(sent().some((t) => /tidak ditemukan lagi di laptop/.test(t))).toBe(true);
  });

  it("fileBuffer: subjudul membedakan dokumen baru & tersimpan", async () => {
    const mammoth: any = await import("mammoth");
    const a = await fileBuffer({ title: "A", format: "docx", markdown: "isi", source: "stored" });
    const text = (await (mammoth.default || mammoth).extractRawText({ buffer: a.data })).value;
    expect(text).toMatch(/Dokumen tersimpan di My Workspace/);
  });
});

describe("Claude Code dari Telegram", () => {
  const task = { id: "ct1", project: "RapiUang", instruction: "Tambah filter kategori di halaman transaksi", mode: "edit", model: "sonnet" };

  it("kartu dengan tombol Jalankan/Batal, message_id disimpan ke job", async () => {
    turnResult = { text: "Instruksi siap.", conversationId: "conv-9", claudeTasks: [task] };
    await handleTelegram(msg("suruh claude tambah filter"));
    const card = calls.filter((c) => c.method === "sendMessage")[1];
    expect(card.body.text).toMatch(/🛠 <b>Claude Code · RapiUang<\/b>/);
    expect(card.body.reply_markup.inline_keyboard[0].map((b: any) => b.callback_data)).toEqual([`cq:run:${JOB}`, `cq:cancel:${JOB}`]);
    expect(jobs[0]).toMatchObject({ conversationId: "conv-9", chatId: 42, source: "telegram" });
    expect(jobs[0].message_id).toBeGreaterThan(0);
  });

  const cb = (data: string, over: Partial<any> = {}) => ({ updateId: uid++, callbackId: `cb${uid}`, fromId: 42, chatId: 42, messageId: 777, data, ...over });

  it("▶️ Jalankan: masuk antrian, kartu diperbarui dengan tombol Batal; agent offline diberi peringatan", async () => {
    queueResult = { ok: true, job: { id: JOB, project: "RapiUang", instruction: "x", mode: "edit", model: "sonnet", status: "queued" }, agentOnline: false, agentLastSeen: "2026-10-08T02:00:00Z" };
    await handleTelegramCallback(cb(`cq:run:${JOB}`));
    expect(calls.find((c) => c.method === "answerCallbackQuery")!.body.text).toBe("Masuk antrian");
    const edit = calls.find((c) => c.method === "editMessageText")!;
    expect(edit.body.text).toMatch(/Antri/);
    expect(edit.body.text).toMatch(/terakhir 08\/10 09:00 WIB/);
    expect(edit.body.reply_markup.inline_keyboard[0][0].callback_data).toBe(`cq:cancel:${JOB}`);
  });

  it("▶️ Jalankan gagal (sudah dijalankan) & ✖️ Batal", async () => {
    queueResult = { ok: false, error: 'Instruksi ini sudah berstatus "running"' };
    await handleTelegramCallback(cb(`cq:run:${JOB}`));
    expect(calls.find((c) => c.method === "answerCallbackQuery")!.body.text).toMatch(/running/);
    expect(calls.some((c) => c.method === "editMessageText")).toBe(false);
    jobs.push({ id: JOB, project: "RapiUang", instruction: "x", mode: "edit", model: "sonnet" });
    await handleTelegramCallback(cb(`cq:cancel:${JOB}`));
    expect(calls.find((c) => c.method === "editMessageText")!.body.text).toMatch(/Dibatalkan/);
  });

  it("tombol dari orang lain / data aneh ditolak", async () => {
    await handleTelegramCallback(cb(`cq:run:${JOB}`, { fromId: 99 }));
    await handleTelegramCallback(cb("cq:run:bukan-uuid"));
    const answers = calls.filter((c) => c.method === "answerCallbackQuery").map((c) => c.body.text);
    expect(answers).toEqual(["Tidak diizinkan", "Tombol tidak dikenal"]);
  });
});
