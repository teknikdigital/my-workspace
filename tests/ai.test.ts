import { describe, it, expect } from "vitest";
import { AI_TOOL_DEFINITIONS } from "@/lib/ai/tools";
import { checkAiConfig } from "@/lib/ai/service";

describe("AI Workspace Intelligence", () => {
  it("defines all essential tools with required properties", () => {
    const toolNames = AI_TOOL_DEFINITIONS.map((t) => t.name);
    expect(toolNames).toContain("search_workspace");
    expect(toolNames).toContain("get_today_tasks");
    expect(toolNames).toContain("create_task");
    expect(toolNames).toContain("create_note");
    expect(toolNames).toContain("get_project_details");
    expect(toolNames).toContain("register_account");
    for (const t of ["create_project", "check_project_readiness", "save_document_facts", "register_resource", "register_application", "update_project", "read_project_document", "log_activity", "get_activity_summary"]) {
      expect(toolNames).toContain(t);
    }
  });

  it("register_account hanya mewajibkan service dan tidak punya field rahasia", () => {
    const tool = AI_TOOL_DEFINITIONS.find((t) => t.name === "register_account")!;
    const params = tool.parameters as { required: string[]; properties: Record<string, unknown> };
    expect(params.required).toEqual(["service"]);
    for (const secret of ["password", "api_key", "token", "secret"]) {
      expect(params.properties).not.toHaveProperty(secret);
    }
  });

  it("handles unconfigured AI gracefully without crashing", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.AI_PROVIDER = "openai";

    const config = await checkAiConfig();
    expect(config.isConfigured).toBe(false);
    expect(config.missingKeyName).toBe("OPENAI_API_KEY");
  });
});
