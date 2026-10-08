import { describe, it, expect, vi, beforeEach } from "vitest";

// Tool & konteks di-mock: yang diuji adalah perulangan tool berantai di service.ts
const executed: string[] = [];
vi.mock("@/lib/ai/tools", () => ({
  AI_TOOL_DEFINITIONS: [{ name: "create_project", description: "x", parameters: { type: "object", properties: {} } }],
  FILE_CHANNELS: ["telegram"],
  toolsFor: () => [{ name: "create_project", description: "x", parameters: { type: "object", properties: {} } }],
  executeAiTool: vi.fn(async (name: string) => {
    executed.push(name);
    return { success: true, name };
  }),
}));
vi.mock("@/lib/ai/context", () => ({ buildUserWorkspaceSummary: async () => "KONTEKS" }));

import { sendAiQuery } from "@/lib/ai/service";

function openAiReply(message: any) {
  return { ok: true, json: async () => ({ choices: [{ message }] }) } as any;
}
const toolCall = (id: string, name: string) => ({ id, type: "function", function: { name, arguments: "{}" } });

describe("AI tool berantai (OpenAI)", () => {
  beforeEach(() => {
    executed.length = 0;
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test";
  });

  it("menjalankan beberapa ronde tool lalu menjawab teks", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(openAiReply({ role: "assistant", tool_calls: [toolCall("1", "create_project")] }))
      .mockResolvedValueOnce(
        openAiReply({ role: "assistant", tool_calls: [toolCall("2", "register_account"), toolCall("3", "check_project_readiness")] })
      )
      .mockResolvedValueOnce(openAiReply({ role: "assistant", content: "Selesai" }));
    vi.stubGlobal("fetch", fetchMock);

    const r = await sendAiQuery([{ role: "user", content: "tambahkan project Rally District" }]);
    expect(r.response).toBe("Selesai");
    expect(executed).toEqual(["create_project", "register_account", "check_project_readiness"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // ronde ke-2 harus membawa hasil tool ronde ke-1
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body2.messages.some((m: any) => m.role === "tool" && m.tool_call_id === "1")).toBe(true);
  });

  it("berhenti setelah batas ronde dan memaksa jawaban teks", async () => {
    let n = 0;
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      n++;
      if (!body.tools) return openAiReply({ role: "assistant", content: "Ringkasan akhir" });
      return openAiReply({ role: "assistant", tool_calls: [toolCall(String(n), "create_project")] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await sendAiQuery([{ role: "user", content: "loop" }]);
    expect(r.response).toBe("Ringkasan akhir");
    expect(executed.length).toBe(4); // MAX_TOOL_ROUNDS di service.ts
  });
});
