import { describe, it, expect, vi, beforeEach } from "vitest";

// Uji alur server: dokumen terlampir disimpan utuh tanpa bergantung pada AI.
const savedDocs: any[] = [];
vi.mock("@/lib/actions/documentMemory", () => ({
  saveDocumentText: vi.fn(async (input: any) => {
    savedDocs.push(input);
    return { success: true, title: `📚 ${input.file_name}`, project: "RapiUang", sections: 12 };
  }),
  saveDocumentFacts: vi.fn(),
  readProjectDocument: vi.fn(),
}));
vi.mock("@/lib/actions/vault", () => ({ createCredential: vi.fn(async () => ({ data: {} })), getCredentialsMetadata: vi.fn() }));
vi.mock("@/lib/ai/context", () => ({ buildUserWorkspaceSummary: async () => "KONTEKS" }));

import { sendAiQuery } from "@/lib/ai/service";
import { buildFileBlock, parseFileBlocks } from "@/lib/ai/fileBlocks";

const reply = (message: any) => ({ ok: true, json: async () => ({ choices: [{ message }] }) }) as any;

describe("dokumen terlampir", () => {
  beforeEach(() => {
    savedDocs.length = 0;
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test";
  });

  it("parseFileBlocks membaca header & isi", () => {
    const b = buildFileBlock({ name: "README.md", project: "Rapiuang", path: "D:\\Project\\Rapiuang\\_Masuk\\README.md" }, "## A\nisi");
    expect(parseFileBlocks(`halo\n\n${b}`)).toEqual([
      { name: "README.md", project: "Rapiuang", path: "D:\\Project\\Rapiuang\\_Masuk\\README.md", body: "## A\nisi" },
    ]);
  });

  it("server menyimpan isi utuh walau AI tidak memanggil tool apa pun", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply({ role: "assistant", content: "Oke." })));
    const body = "## BAGIAN G\n" + "deploy ".repeat(3000);
    const block = buildFileBlock({ name: "HANDOFF.md", project: "Rapiuang", path: "D:\\x\\HANDOFF.md" }, body);
    const r = await sendAiQuery([{ role: "user", content: `ini dokumen project\n\n${block}` }]);
    expect(savedDocs).toHaveLength(1);
    expect(savedDocs[0]).toMatchObject({ project: "Rapiuang", file_name: "HANDOFF.md", file_path: "D:\\x\\HANDOFF.md" });
    expect(savedDocs[0].text.length).toBeGreaterThan(20000);
    expect(r.response).toContain("📚 Dokumen disimpan utuh");
    // riwayat yang dikembalikan sudah diringkas (isi tidak dikirim ulang ke AI)
    expect(JSON.stringify(r.maskedMessages)).not.toContain("deploy deploy deploy");
  });

  it("password di dalam dokumen tidak ikut tersimpan di catatan", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply({ role: "assistant", content: "Oke." })));
    const block = buildFileBlock({ name: "env.md", project: "Rapiuang", path: "x" }, "password db: Rahasia123!");
    await sendAiQuery([{ role: "user", content: block }]);
    expect(savedDocs[0].text).toContain("[[RAHASIA_1]]");
    expect(savedDocs[0].text).not.toContain("Rahasia123");
  });
});
