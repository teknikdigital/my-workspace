import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { tgCall, sendHtml, keepTyping } from "@/lib/telegram/api";

const hits: { url: string; body: any }[] = [];
let server: http.Server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      hits.push({ url: req.url!, body });
      res.setHeader("content-type", "application/json");
      if (body.text === "<b>rusak") {
        res.statusCode = 400;
        return res.end(JSON.stringify({ ok: false, description: "Bad Request: can't parse entities" }));
      }
      res.end(JSON.stringify({ ok: true, result: true }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.TELEGRAM_API_URL = `http://127.0.0.1:${(server.address() as any).port}`;
  process.env.TELEGRAM_BOT_TOKEN = "123:TOKEN";
});
afterAll(() => server.close());

describe("telegram api", () => {
  it("memanggil /bot<token>/<method> dan meneruskan error Telegram", async () => {
    expect(await sendHtml(9, "<b>ok</b>")).toMatchObject({ ok: true, status: 200 });
    expect(hits[0].url).toBe("/bot123:TOKEN/sendMessage");
    expect(hits[0].body).toMatchObject({ chat_id: 9, parse_mode: "HTML", text: "<b>ok</b>" });
    const bad = await sendHtml(9, "<b>rusak");
    expect(bad).toMatchObject({ ok: false, status: 400 });
    expect(bad.error).toMatch(/parse entities/);
  });
  it("token kosong tidak memanggil jaringan", async () => {
    const t = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    expect((await tgCall("getMe", {})).error).toMatch(/belum diisi/);
    process.env.TELEGRAM_BOT_TOKEN = t;
  });
  it("keepTyping mengirim ulang sampai dihentikan", async () => {
    const before = hits.length;
    const stop = keepTyping(9, 10);
    await new Promise((r) => setTimeout(r, 150));
    stop();
    const n = hits.slice(before).filter((h) => h.url.endsWith("/sendChatAction")).length;
    await new Promise((r) => setTimeout(r, 50));
    expect(n).toBeGreaterThanOrEqual(2); // kirim awal + minimal satu ulangan
    expect(hits.slice(before).filter((h) => h.url.endsWith("/sendChatAction")).length).toBe(n);
  });
});
