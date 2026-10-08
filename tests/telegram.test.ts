import { describe, it, expect } from "vitest";
import { extractUpdate, parseTgCommand, toTelegramHtml, verifySecret } from "@/lib/telegram/core";
import { splitMarkdown } from "@/lib/chatbot/text";

describe("verifySecret", () => {
  it("hanya secret yang sama persis", () => {
    expect(verifySecret("abc123abc123abc1", "abc123abc123abc1")).toBe(true);
    expect(verifySecret("abc123abc123abc2", "abc123abc123abc1")).toBe(false);
    expect(verifySecret("abc", "abc123abc123abc1")).toBe(false);
    expect(verifySecret(null, "abc123abc123abc1")).toBe(false);
    expect(verifySecret("x", undefined)).toBe(false);
    expect(verifySecret("", "")).toBe(false);
  });
});

describe("extractUpdate", () => {
  const base = { update_id: 10, message: { message_id: 5, date: 1791360000, chat: { id: 77, type: "private" }, from: { id: 77, first_name: "Ari", last_name: "D" } } };
  it("teks", () => {
    const m = extractUpdate({ ...base, message: { ...base.message, text: "Apa task saya?" } });
    expect(m).toMatchObject({ updateId: 10, chatId: 77, fromId: 77, chatType: "private", kind: "text", text: "Apa task saya?", fromName: "Ari D" });
  });
  it("media & update lain", () => {
    expect(extractUpdate({ ...base, message: { ...base.message, photo: [{}], caption: "x" } })).toMatchObject({ kind: "photo", text: null });
    expect(extractUpdate({ update_id: 11, edited_message: base.message })).toBeNull();
    expect(extractUpdate({})).toBeNull();
    expect(extractUpdate(null)).toBeNull();
  });
});

describe("parseTgCommand", () => {
  it("perintah", () => {
    expect(parseTgCommand("/start")).toBe("help");
    expect(parseTgCommand("/bantuan@MwBot")).toBe("help");
    expect(parseTgCommand("/baru")).toBe("new");
    expect(parseTgCommand("baru")).toBe("new");
    expect(parseTgCommand("baru saja selesai deploy")).toBeNull();
  });
});

describe("toTelegramHtml", () => {
  it("format dasar + escape", () => {
    const md = "## Task <hari ini>\n- **Audit RLS** (tinggi) & *opsional*\n* rapikan `a<b>`\nLihat [Supabase](https://supabase.com/x?a=1&b=2)\n~~batal~~\n|a|b|\n|---|---|";
    expect(toTelegramHtml(md)).toBe(
      "<b>Task &lt;hari ini&gt;</b>\n• <b>Audit RLS</b> (tinggi) &amp; <i>opsional</i>\n• rapikan <code>a&lt;b&gt;</code>\n" +
        'Lihat <a href="https://supabase.com/x?a=1&amp;b=2">Supabase</a>\n<s>batal</s>\n|a|b|'
    );
  });
  it("blok kode tidak diformat, ditutup otomatis", () => {
    expect(toTelegramHtml("```ts\nconst a = **b** < c;\n```")).toBe('<pre><code class="language-ts">const a = **b** &lt; c;</code></pre>');
    expect(toTelegramHtml("x\n```\nnpm run build")).toBe("x\n<pre>npm run build</pre>");
  });
  it("perkalian bukan miring", () => {
    expect(toTelegramHtml("2 * 3 * 4")).toBe("2 * 3 * 4");
  });
});

describe("splitMarkdown", () => {
  it("blok kode yang terpotong ditutup & dibuka lagi", () => {
    const code = Array.from({ length: 200 }, (_, i) => `baris ${i} ${"x".repeat(20)}`).join("\n");
    const parts = splitMarkdown("Pengantar\n\n```\n" + code + "\n```\n\nPenutup", 2000);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(2000);
      expect(p.split("\n").filter((l) => l.startsWith("```")).length % 2).toBe(0);
    }
    expect(parts[parts.length - 1]).toMatch(/Penutup$/);
  });
});
