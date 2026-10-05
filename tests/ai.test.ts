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
