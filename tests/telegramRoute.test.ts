import { describe, it, expect, vi, beforeEach } from "vitest";

const handled: any[] = [];
vi.mock("@/lib/telegram/handler", () => ({ handleTelegram: async (m: any) => void handled.push(m) }));

import { GET, POST } from "@/app/api/telegram/route";

const SECRET = "s3cret_value_1234567890";
const req = (body: any, secret?: string) =>
  new Request("https://x/api/telegram", {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as any;
const update = { update_id: 1, message: { message_id: 1, date: 1, chat: { id: 7, type: "private" }, from: { id: 7 }, text: "hi" } };

beforeEach(() => {
  handled.length = 0;
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
});

describe("/api/telegram", () => {
  it("secret salah/kosong ditolak", async () => {
    expect((await POST(req(update))).status).toBe(401);
    expect((await POST(req(update, "salah"))).status).toBe(401);
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    expect((await POST(req(update, SECRET))).status).toBe(503);
    expect(handled).toHaveLength(0);
  });
  it("secret benar diproses; JSON rusak tetap 200", async () => {
    const r = await POST(req(update, SECRET));
    expect(r.status).toBe(200);
    await new Promise((r) => setTimeout(r, 0));
    expect(handled[0]).toMatchObject({ chatId: 7, text: "hi" });
    expect((await POST(req("{rusak", SECRET))).status).toBe(200);
  });
  it("GET hanya status, tanpa nilai rahasia", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123:ABC";
    const j = await (await GET()).json();
    expect(j.configured.botToken).toBe(true);
    expect(JSON.stringify(j)).not.toContain("ABC");
  });
});
