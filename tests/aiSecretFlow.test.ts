import { describe, it, expect, vi, beforeEach } from "vitest";

// Semua akses database di-mock; yang diuji: nilai rahasia TIDAK pernah ada di request ke penyedia AI,
// dan yang masuk ke Vault adalah nilai aslinya.
const vaultSaved: { label: string; secret_value: string; identifier?: string | null }[] = [];
vi.mock("@/lib/actions/vault", () => ({
  createCredential: vi.fn(async (input: any) => {
    vaultSaved.push(input);
    return { data: { id: "c1", label: input.label, credential_type: input.credential_type } };
  }),
  getCredentialsMetadata: vi.fn(async () => []),
}));
vi.mock("@/lib/ai/context", () => ({ buildUserWorkspaceSummary: async () => "KONTEKS" }));
vi.mock("@/lib/actions/search", () => ({ searchWorkspace: vi.fn() }));
vi.mock("@/lib/actions/tasks", () => ({ createTask: vi.fn(), getTasks: vi.fn(async () => []) }));
vi.mock("@/lib/actions/notes", () => ({ createNote: vi.fn() }));
vi.mock("@/lib/actions/projects", () => ({ getProjectById: vi.fn() }));
vi.mock("@/lib/actions/accountRegistry", () => ({ registerAccount: vi.fn(async () => ({ success: true })) }));
vi.mock("@/lib/actions/projectAssist", () => ({
  ensureProject: vi.fn(),
  checkProjectReadiness: vi.fn(),
  findProjectByName: vi.fn(),
}));

import { sendAiQuery } from "@/lib/ai/service";

const SECRET = "@Arijulian121eDoy039";
const reply = (message: any) => ({ ok: true, json: async () => ({ choices: [{ message }] }) }) as any;

describe("Alur rahasia di AI Assistant", () => {
  beforeEach(() => {
    vaultSaved.length = 0;
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test";
  });

  it("AI menyimpan lewat placeholder; nilai asli tidak pernah dikirim ke OpenAI", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        reply({
          role: "assistant",
          tool_calls: [
            {
              id: "t1",
              type: "function",
              function: {
                name: "create_vault_credential",
                arguments: JSON.stringify({
                  label: "Password Gmail julianpandanu@gmail.com",
                  identifier: "julianpandanu@gmail.com",
                  secret_value: "[[RAHASIA_1]]",
                  credential_type: "password",
                }),
              },
            },
          ],
        })
      )
      .mockResolvedValueOnce(reply({ role: "assistant", content: "Sudah disimpan di Vault." }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await sendAiQuery([
      { role: "user", content: `akun julianpandanu@gmail.com password emailnya ${SECRET}` },
    ]);

    for (const call of fetchMock.mock.calls) expect(call[1].body).not.toContain("Arijulian");
    expect(vaultSaved).toHaveLength(1); // tidak disimpan ganda oleh fallback
    expect(vaultSaved[0].secret_value).toBe(SECRET);
    expect(JSON.stringify(r.maskedMessages)).not.toContain("Arijulian");
    expect(r.response).not.toContain("Arijulian");
    expect(r.response).toContain("🔒 1 data rahasia");
  });

  it("fallback: bila AI tidak menyimpan, server menyimpan otomatis", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply({ role: "assistant", content: "Oke." })));
    const r = await sendAiQuery([{ role: "user", content: `password gmail julianpandanu@gmail.com ${SECRET}` }]);
    expect(vaultSaved).toHaveLength(1);
    expect(vaultSaved[0]).toMatchObject({ secret_value: SECRET, identifier: "julianpandanu@gmail.com" });
    expect(r.secretsSaved).toEqual(["Password Google julianpandanu@gmail.com"]);
  });

  it("fallback tetap jalan walau API AI error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 500, statusText: "x", text: async () => "err" }));
    await sendAiQuery([{ role: "user", content: `pin bank 482913` }]);
    expect(vaultSaved.map((v) => v.secret_value)).toEqual(["482913"]);
  });

  it("pesan tanpa rahasia tidak menyentuh Vault", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply({ role: "assistant", content: "Halo" })));
    const r = await sendAiQuery([{ role: "user", content: "apa task saya hari ini?" }]);
    expect(vaultSaved).toHaveLength(0);
    expect(r.response).toBe("Halo");
  });
});
