import { describe, it, expect } from "vitest";
import { redactHandoff, prepareHandoff, handoffFileName, HANDOFF_MAX_CHARS } from "@/lib/activity/handoff";
import { activityWebhookSchema } from "@/lib/validators/integrations";
import { MASK_TEXT } from "@/lib/ai/secretGuard";

describe("redactHandoff", () => {
  it("menyamarkan nilai env rahasia, nama variabel tetap", () => {
    const src = [
      "NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co",
      "SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZSJ9.c2lnbmF0dXJlMTIz",
      "OPENAI_API_KEY=\"sk-proj-abcdefghijklmnopqrstuvwxyz123456\"",
      "DB_PASSWORD: rahasia123",
      "PORT=3000",
    ].join("\n");
    const { text, redacted } = redactHandoff(src);
    expect(text).toContain("NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co");
    expect(text).toContain("PORT=3000");
    expect(text).toContain(`SUPABASE_SERVICE_ROLE_KEY=${MASK_TEXT}`);
    expect(text).toContain(`OPENAI_API_KEY="${MASK_TEXT}"`);
    expect(text).toContain(`DB_PASSWORD: ${MASK_TEXT}`);
    expect(text).not.toMatch(/eyJhbGci|sk-proj|rahasia123/);
    expect(redacted).toBe(3);
  });

  it("menyamarkan password di URL koneksi dan kunci di tengah kalimat", () => {
    const { text } = redactHandoff(
      "Koneksi: postgres://postgres:Sup3rPass@db.abc.supabase.co:5432/postgres\nToken GitHub ghp_abcdefghijklmnopqrstuvwxyz0123456789 dipakai CI."
    );
    expect(text).toContain(`postgres://postgres:${MASK_TEXT}@db.abc.supabase.co`);
    expect(text).not.toMatch(/Sup3rPass|ghp_/);
  });

  it("dokumen biasa tidak diubah", () => {
    const doc = "# HANDOFF\n## Status Fitur\n- Login: selesai\n- Port API 3000, web 5173\n## Langkah Berikutnya\n- Deploy ke cPanel";
    expect(redactHandoff(doc)).toEqual({ text: doc, redacted: 0 });
  });

  it("idempoten: teks yang sudah disamarkan tidak dihitung ulang", () => {
    const once = redactHandoff("API_KEY=abcdef123456").text;
    expect(redactHandoff(once).redacted).toBe(0);
  });
});

describe("prepareHandoff", () => {
  it("nama file dasar, default HANDOFF.md, CRLF dirapikan", () => {
    expect(handoffFileName("D:\\Project\\Rapiuang\\HANDOFF.md")).toBe("HANDOFF.md");
    expect(handoffFileName(undefined)).toBe("HANDOFF.md");
    expect(prepareHandoff({ content: "a\r\nb" }).content).toBe("a\nb");
  });
  it("dipotong bila melebihi batas", () => {
    const h = prepareHandoff({ content: "x".repeat(HANDOFF_MAX_CHARS + 10) });
    expect(h.truncated).toBe(true);
    expect(h.content.endsWith("(dipotong, dokumen terlalu panjang)")).toBe(true);
  });
});

describe("activityWebhookSchema.handoff", () => {
  it("opsional dan divalidasi", () => {
    expect(activityWebhookSchema.safeParse({ project: "A", summary: "b" }).success).toBe(true);
    expect(activityWebhookSchema.safeParse({ project: "A", summary: "b", handoff: { content: "# H" } }).success).toBe(true);
    expect(activityWebhookSchema.safeParse({ project: "A", summary: "b", handoff: { content: "" } }).success).toBe(false);
  });
});
