import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifySignature, normalizePhone, extractMessages, toWhatsAppText, splitMessage, parseCommand } from "@/lib/whatsapp/core";

const sign = (body: string, secret: string) => `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;

describe("verifySignature", () => {
  it("hanya menerima tanda tangan yang benar", () => {
    const body = '{"a":1}';
    expect(verifySignature(body, sign(body, "rahasia"), "rahasia")).toBe(true);
    expect(verifySignature(body, sign(body, "lain"), "rahasia")).toBe(false);
    expect(verifySignature(body + " ", sign(body, "rahasia"), "rahasia")).toBe(false);
    expect(verifySignature(body, null, "rahasia")).toBe(false);
    expect(verifySignature(body, sign(body, "rahasia"), undefined)).toBe(false);
    expect(verifySignature(body, "sha256=zz", "rahasia")).toBe(false);
  });
});

describe("normalizePhone", () => {
  it("format Indonesia", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizePhone("81234567890")).toBe("6281234567890");
    expect(normalizePhone("6281234567890")).toBe("6281234567890");
  });
});

describe("extractMessages", () => {
  it("ambil teks & tombol, abaikan status", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "6281234567890", profile: { name: "Stratt" } }],
                messages: [
                  { id: "wamid.1", from: "6281234567890", timestamp: "1791360000", type: "text", text: { body: "Apa task saya hari ini?" } },
                  { id: "wamid.2", from: "6281234567890", type: "interactive", interactive: { button_reply: { title: "Ya" } } },
                  { id: "wamid.3", from: "6281234567890", type: "image", image: { id: "m1" } },
                ],
              },
            },
            { value: { statuses: [{ id: "wamid.x", status: "read" }] } },
          ],
        },
      ],
    };
    const m = extractMessages(payload);
    expect(m.map((x) => [x.id, x.type, x.text])).toEqual([
      ["wamid.1", "text", "Apa task saya hari ini?"],
      ["wamid.2", "interactive", "Ya"],
      ["wamid.3", "image", null],
    ]);
    expect(m[0].name).toBe("Stratt");
    expect(extractMessages({})).toEqual([]);
  });
});

describe("format WhatsApp", () => {
  it("Markdown -> WA", () => {
    const md = "## Task hari ini\n- **Audit RLS** (tinggi)\n* *opsional*: rapikan\nLihat [Supabase](https://supabase.com/dashboard)\n~~batal~~";
    expect(toWhatsAppText(md)).toBe(
      "*Task hari ini*\n• *Audit RLS* (tinggi)\n• _opsional_: rapikan\nLihat Supabase (https://supabase.com/dashboard)\n~batal~"
    );
  });
  it("potong pesan panjang di batas paragraf", () => {
    const text = Array.from({ length: 10 }, (_, i) => `Paragraf ${i} ` + "x".repeat(800)).join("\n\n");
    const parts = splitMessage(text, 3500);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 3500)).toBe(true);
    expect(parts.join("\n\n")).toBe(text);
  });
  it("perintah", () => {
    expect(parseCommand("baru")).toBe("new");
    expect(parseCommand("/Reset")).toBe("new");
    expect(parseCommand("menu")).toBe("help");
    expect(parseCommand("baru saja selesai deploy")).toBeNull();
  });
});
