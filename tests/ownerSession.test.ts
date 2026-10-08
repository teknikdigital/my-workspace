import { describe, it, expect, vi, beforeEach } from "vitest";

let users: { id: string; email: string }[] = [];
const created: any[] = [];
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      admin: {
        listUsers: async () => ({ data: { users }, error: null }),
        createUser: async (u: any) => (created.push(u), { data: { user: u }, error: null }),
        generateLink: async () => ({ data: { properties: { hashed_token: "h" } }, error: null }),
      },
      verifyOtp: async () => ({ data: { session: { access_token: "at", refresh_token: "rt", expires_at: 9e9 } }, error: null }),
      refreshSession: async () => ({ data: {}, error: { message: "x" } }),
    },
  }),
}));

import { getOwnerSession, maskEmail } from "@/lib/chatbot/ownerSession";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "srv";
  delete process.env.MW_OWNER_EMAIL;
  process.env.WHATSAPP_OWNER_EMAIL = "julianpandanu@gmail.com";
});

describe("getOwnerSession", () => {
  it("email salah: error jelas berisi email yang ada (disamarkan), TIDAK membuat user / menebak user lain", async () => {
    users = [{ id: "u1", email: "adarmawantanjung@gmail.com" }];
    await expect(getOwnerSession()).rejects.toThrow(/ju\*\*\*@gmail\.com\) tidak ditemukan.*User yang ada: ad\*\*\*@gmail\.com/);
    expect(created).toHaveLength(0);
  });
  it("project tanpa user: arahkan cek NEXT_PUBLIC_SUPABASE_URL", async () => {
    users = [];
    await expect(getOwnerSession()).rejects.toThrow(/belum punya user.*NEXT_PUBLIC_SUPABASE_URL/);
  });
  it("MW_OWNER_EMAIL diutamakan, case-insensitive", async () => {
    users = [{ id: "u1", email: "AdarmawanTanjung@gmail.com" }];
    process.env.MW_OWNER_EMAIL = "adarmawantanjung@gmail.com";
    const s = await getOwnerSession();
    expect(s).toMatchObject({ access_token: "at", userId: "u1" });
  });
  it("maskEmail", () => {
    expect(maskEmail("julianpandanu@gmail.com")).toBe("ju***@gmail.com");
    expect(maskEmail("bukan-email")).toBe("***");
  });
});
