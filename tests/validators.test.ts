import { describe, it, expect } from "vitest";
import { signInSchema } from "@/lib/validators/auth";
import { projectSchema } from "@/lib/validators/projects";
import { resourceSchema } from "@/lib/validators/resources";
import { taskSchema } from "@/lib/validators/tasks";
import { sanitizeNextUrl } from "@/lib/supabase/middleware";

describe("Validation Schemas", () => {
  it("validates correct sign in credentials", () => {
    const valid = signInSchema.safeParse({
      email: "user@example.com",
      password: "secretpassword",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects invalid sign in credentials", () => {
    const emptyEmail = signInSchema.safeParse({
      email: "",
      password: "pass",
    });
    expect(emptyEmail.success).toBe(false);

    const emptyPassword = signInSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(emptyPassword.success).toBe(false);
  });

  it("validates project schema and default values", () => {
    const result = projectSchema.safeParse({
      name: "Warehouse Monitoring",
      category: "Logistics",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("planning");
      expect(result.data.progress).toBe(0);
      expect(result.data.tech_stack).toEqual([]);
    }
  });

  it("validates resource schema only accepting http/https URLs", () => {
    const validHttp = resourceSchema.safeParse({
      title: "Supabase DB",
      url: "https://supabase.com/dashboard",
      category: "supabase",
    });
    expect(validHttp.success).toBe(true);

    const invalidUrl = resourceSchema.safeParse({
      title: "Malicious Link",
      url: "javascript:alert(1)",
      category: "other",
    });
    expect(invalidUrl.success).toBe(false);
  });

  it("validates task schema defaults", () => {
    const result = taskSchema.safeParse({
      title: "Fix RLS policy",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("todo");
      expect(result.data.priority).toBe("medium");
      expect(result.data.source).toBe("manual");
    }
  });
});

describe("Open Redirect Protection", () => {
  it("allows safe internal relative paths", () => {
    expect(sanitizeNextUrl("/work/projects")).toBe("/work/projects");
    expect(sanitizeNextUrl("/personal/notes")).toBe("/personal/notes");
    expect(sanitizeNextUrl("/")).toBe("/");
  });

  it("blocks dangerous external URLs and schema injections", () => {
    expect(sanitizeNextUrl("https://evil.com")).toBe("/");
    expect(sanitizeNextUrl("http://evil.com")).toBe("/");
    expect(sanitizeNextUrl("//evil.com")).toBe("/");
    expect(sanitizeNextUrl("/\\evil.com")).toBe("/");
    expect(sanitizeNextUrl("javascript:alert(1)")).toBe("/");
    expect(sanitizeNextUrl("")).toBe("/");
    expect(sanitizeNextUrl(null)).toBe("/");
  });
});
