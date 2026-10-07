import { describe, it, expect } from "vitest";
import {
  createIntegrationSchema,
  createTokenSchema,
  activityWebhookSchema,
} from "@/lib/validators/integrations";

describe("Integration Validators", () => {
  describe("createIntegrationSchema", () => {
    it("accepts valid integration data", () => {
      const result = createIntegrationSchema.safeParse({
        provider: "github",
        is_enabled: true,
        config_value: "ghp_abc123token",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid provider", () => {
      const result = createIntegrationSchema.safeParse({
        provider: "dropbox",
        is_enabled: true,
      });
      expect(result.success).toBe(false);
    });

    it("accepts without config_value", () => {
      const result = createIntegrationSchema.safeParse({
        provider: "supabase",
        is_enabled: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createTokenSchema", () => {
    it("accepts valid token name", () => {
      const result = createTokenSchema.safeParse({ name: "Claude Coding" });
      expect(result.success).toBe(true);
    });

    it("rejects empty token name", () => {
      const result = createTokenSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("activityWebhookSchema", () => {
    it("accepts valid full payload", () => {
      const result = activityWebhookSchema.safeParse({
        project: "Warehouse Monitoring",
        activity_type: "development",
        summary: "Memperbaiki RLS inventory",
        files_changed: ["inventory.sql"],
        status: "completed",
        source: "claude",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.project).toBe("Warehouse Monitoring");
        expect(result.data.source).toBe("claude");
      }
    });

    it("accepts minimal payload with defaults", () => {
      const result = activityWebhookSchema.safeParse({
        project: "My Project",
        summary: "Fixed bugs",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.activity_type).toBe("development");
        expect(result.data.status).toBe("completed");
        expect(result.data.source).toBe("claude");
        expect(result.data.files_changed).toEqual([]);
      }
    });

    it("rejects payload without project", () => {
      const result = activityWebhookSchema.safeParse({
        summary: "Fixed bugs",
      });
      expect(result.success).toBe(false);
    });

    it("rejects payload without summary", () => {
      const result = activityWebhookSchema.safeParse({
        project: "My Project",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid activity_type", () => {
      const result = activityWebhookSchema.safeParse({
        project: "My Project",
        summary: "Fixed bugs",
        activity_type: "invalid_type",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid task_id uuid", () => {
      const result = activityWebhookSchema.safeParse({
        project: "My Project",
        summary: "Fixed bugs",
        task_id: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid task_id", () => {
      const result = activityWebhookSchema.safeParse({
        project: "My Project",
        summary: "Fixed bugs",
        task_id: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });
  });
});

describe("activityWebhookSchema source bebas", () => {
  it("menerima antigravity & claude-code, menolak karakter aneh", async () => {
    const { activityWebhookSchema } = await import("@/lib/validators/integrations");
    const ok = activityWebhookSchema.safeParse({ project: "RapiUang", summary: "fix", source: "Antigravity" });
    expect(ok.success && ok.data.source).toBe("antigravity");
    expect(activityWebhookSchema.safeParse({ project: "x", summary: "y", source: "claude-code" }).success).toBe(true);
    expect(activityWebhookSchema.safeParse({ project: "x", summary: "y", source: "<script>" }).success).toBe(false);
    expect(activityWebhookSchema.safeParse({ project: "x", summary: "y", activity_type: "meeting" }).success).toBe(true);
  });
});
