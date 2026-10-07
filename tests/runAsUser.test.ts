import { describe, it, expect, vi } from "vitest";

const setSession = vi.fn(async () => ({ error: null }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ auth: { setSession }, tag: "session-client" })) }));
vi.mock("next/headers", () => ({ cookies: () => { throw new Error("cookies() di luar request"); } }));

import { createClient, runAsUser } from "@/lib/supabase/server";

describe("runAsUser", () => {
  it("di dalam runAsUser memakai sesi pemilik (satu client per pemrosesan), di luar memakai cookie", async () => {
    const tags = await runAsUser({ access_token: "a", refresh_token: "r" }, async () => {
      const c1: any = await createClient();
      const c2: any = await createClient();
      return [c1.tag, c1 === c2];
    });
    expect(tags).toEqual(["session-client", true]);
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "r" });
    await expect(createClient()).rejects.toThrow(/cookies/);
  });
});
