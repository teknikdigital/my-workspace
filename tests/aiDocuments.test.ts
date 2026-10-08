import { describe, it, expect, vi, beforeEach } from "vitest";

// Database di-mock; yang diuji: tool dokumen hanya ada di kanal Telegram, file dikumpulkan & dikembalikan,
// dokumen buatan AI disimpan sebagai catatan, dan batas token output lebih besar untuk kanal file.
const savedDocs: any[] = [];
vi.mock("@/lib/actions/generatedDocs", () => ({
  saveGeneratedDocument: vi.fn(async (d: any) => (savedDocs.push(d), { success: true, note: `📝 ${d.title}` })),
  findDocumentForFile: vi.fn(async (q: any) =>
    q.query === "handoff"
      ? { success: true, title: "HANDOFF.md", content: "# Status\nFitur PDF selesai", project: "RapiUang", others: ["📚 HANDOFF lama"] }
      : { success: false, error: "tidak ditemukan" }
  ),
}));
vi.mock("@/lib/actions/vault", () => ({ createCredential: vi.fn(async () => ({ data: {} })), getCredentialsMetadata: vi.fn(async () => []) }));
vi.mock("@/lib/ai/context", () => ({ buildUserWorkspaceSummary: async () => "KONTEKS" }));
vi.mock("@/lib/actions/search", () => ({ searchWorkspace: vi.fn() }));
vi.mock("@/lib/actions/tasks", () => ({ createTask: vi.fn(), getTasks: vi.fn(async () => []) }));
vi.mock("@/lib/actions/notes", () => ({ createNote: vi.fn() }));
vi.mock("@/lib/actions/projects", () => ({ getProjectById: vi.fn() }));
vi.mock("@/lib/actions/accountRegistry", () => ({ registerAccount: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/actions/projectAssist", () => ({ ensureProject: vi.fn(), checkProjectReadiness: vi.fn(), findProjectByName: vi.fn() }));

import { sendAiQuery } from "@/lib/ai/service";
import { toolsFor, executeAiTool } from "@/lib/ai/tools";
import { makeGeneratedFile } from "@/lib/ai/generatedFile";

const reply = (message: any) => ({ ok: true, json: async () => ({ choices: [{ message }] }) }) as any;
const call = (id: string, name: string, args: any) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const TOR = "## Latar Belakang\nRapat koordinasi isolator.\n\n## Peserta\n| No | Nama |\n|---|---|\n| 1 | Stratt |";

beforeEach(() => {
  savedDocs.length = 0;
  process.env.AI_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "test";
});

describe("tool dokumen", () => {
  it("hanya tersedia di Telegram", () => {
    const names = (c?: any) => toolsFor(c).map((t: any) => t.name);
    expect(names()).not.toContain("create_document_file");
    expect(names({ channel: "web" })).not.toContain("create_document_file");
    expect(names({ channel: "whatsapp" })).not.toContain("get_document_file");
    expect(names({ channel: "telegram" })).toEqual(expect.arrayContaining(["create_document_file", "get_document_file", "send_to_claude_code"]));
  });

  it("dipanggil dari web: ditolak", async () => {
    const r = await executeAiTool("create_document_file", { title: "X", content: TOR }, { secrets: [], used: new Set(), channel: "web" });
    expect(r).toMatchObject({ success: false });
  });

  it("validasi isi", () => {
    expect(makeGeneratedFile({ title: "", content: TOR }, 0).error).toMatch(/title/);
    expect(makeGeneratedFile({ title: "A", content: "pendek" }, 0).error).toMatch(/terlalu pendek/);
    expect(makeGeneratedFile({ title: "A", content: TOR + " [[RAHASIA_1]]" }, 0).error).toMatch(/rahasia/);
    expect(makeGeneratedFile({ title: "A", content: TOR }, 3).error).toMatch(/Maksimal 3/);
    expect(makeGeneratedFile({ title: "  A  ", content: TOR, format: "md" }, 0).file).toMatchObject({ title: "A", format: "md", source: "created" });
  });
});

describe("sendAiQuery kanal Telegram", () => {
  it("buat dokumen: file dikembalikan, disimpan sebagai catatan, 📎 di jawaban, max token 8000", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ role: "assistant", tool_calls: [call("1", "create_document_file", { title: "TOR Rapat Isolator", content: TOR, project: "Isolator" })] }))
      .mockResolvedValueOnce(reply({ role: "assistant", content: "TOR rapat isolator sudah dibuat." }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendAiQuery([{ role: "user", content: "buatkan TOR rapat isolator" }], null, { channel: "telegram" });
    expect(r.files).toEqual([{ title: "TOR Rapat Isolator", format: "docx", markdown: TOR, source: "created" }]);
    expect(savedDocs[0]).toMatchObject({ title: "TOR Rapat Isolator", project: "Isolator" });
    expect(r.response).toBe("TOR rapat isolator sudah dibuat.\n\n📎 TOR Rapat Isolator.docx");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_completion_tokens).toBe(8000);
    expect(body.tools.map((t: any) => t.function.name)).toContain("create_document_file");
    expect(body.messages[0].content).toMatch(/11\. DOKUMEN/);
  });

  it("minta dokumen tersimpan", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ role: "assistant", tool_calls: [call("1", "get_document_file", { query: "handoff", project: "RapiUang" })] }))
      .mockResolvedValueOnce(reply({ role: "assistant", content: "Ini HANDOFF RapiUang." }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendAiQuery([{ role: "user", content: "kirim handoff rapiuang" }], null, { channel: "telegram" });
    expect(r.files?.[0]).toMatchObject({ title: "HANDOFF", source: "stored", format: "docx" });
    const toolMsg = JSON.parse(fetchMock.mock.calls[1][1].body).messages.find((m: any) => m.role === "tool");
    expect(JSON.parse(toolMsg.content)).toMatchObject({ success: true, other_matches: ["📚 HANDOFF lama"] });
  });

  it("web: tanpa tool dokumen, max token tetap 1500, tanpa aturan 11", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(reply({ role: "assistant", content: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendAiQuery([{ role: "user", content: "halo" }]);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_completion_tokens).toBe(1500);
    expect(body.tools.map((t: any) => t.function.name)).not.toContain("create_document_file");
    expect(body.messages[0].content).not.toMatch(/11\. DOKUMEN/);
    expect(r.files).toBeUndefined();
  });
});
