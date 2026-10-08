import { describe, it, expect, vi, beforeEach } from "vitest";

const sent: string[] = [];
vi.mock("@/lib/telegram/api", () => ({ editHtml: async (_c: number, m: number) => void sent.push(`edit ${m}`) }));
vi.mock("@/lib/telegram/reply", () => ({ replyMarkdown: async (_c: number, md: string, o: any) => void sent.push(`reply ${o?.replyTo} ${md}`) }));

import { notifyStarted } from "@/lib/claudeQueue/notify";

const base = { id: "j", project: "Rally District", instruction: "x", mode: "edit", model: "sonnet", status: "running", chat_id: 1, message_id: 5, conversation_id: null, task_id: null } as any;
const now = Date.parse("2026-10-09T07:00:00Z");

beforeEach(() => {
  sent.length = 0;
  process.env.TELEGRAM_BOT_TOKEN = "t";
});

describe("notifyStarted", () => {
  it("job baru diantrikan (laptop aktif): hanya kartu diperbarui, tanpa pesan", async () => {
    await notifyStarted({ ...base, queued_at: "2026-10-09T06:59:50Z" }, now);
    expect(sent).toEqual(["edit 5"]);
  });
  it("job menunggu laptop mati: kartu + pesan balasan (HP berbunyi)", async () => {
    await notifyStarted({ ...base, queued_at: "2026-10-08T22:00:00Z" }, now);
    expect(sent[0]).toBe("edit 5");
    expect(sent[1]).toContain("reply 5 ▶️ Laptop online");
    expect(sent[1]).toContain("menunggu 9 jam");
  });
  it("tanpa token bot: diam", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    await notifyStarted({ ...base, queued_at: "2026-10-08T22:00:00Z" }, now);
    expect(sent).toEqual([]);
  });
});
