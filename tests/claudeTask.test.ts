import { describe, it, expect } from "vitest";
import { makeClaudeTask, matchAgentApp } from "@/lib/ai/claudeTask";

describe("makeClaudeTask", () => {
  it("draf valid dengan default edit + sonnet", () => {
    const { draft } = makeClaudeTask({ project: "RapiUang", instruction: "Tambah tombol export PDF di halaman laporan." }, 0);
    expect(draft).toMatchObject({ project: "RapiUang", mode: "edit", model: "sonnet" });
    expect(makeClaudeTask({ project: "A", instruction: "Review keamanan RLS semua tabel.", mode: "read", model: "opus" }, 1).draft).toMatchObject({
      mode: "read",
      model: "opus",
    });
  });
  it("menolak instruksi kosong/pendek/berisi rahasia", () => {
    expect(makeClaudeTask({ project: "", instruction: "x".repeat(20) }, 0).error).toBeTruthy();
    expect(makeClaudeTask({ project: "A", instruction: "fix" }, 0).error).toMatch(/singkat/);
    expect(makeClaudeTask({ project: "A", instruction: "Login pakai password [[RAHASIA_1]] ya" }, 0).error).toMatch(/rahasia/);
  });
});

describe("matchAgentApp", () => {
  const apps = [
    { id: "rapiuang", name: "Rapiuang", claude: { project: "RapiUang" } },
    { id: "sparepart", name: "Sparepart / Warehouse Monitoring", claude: { project: "Warehouse Monitoring" } },
    { id: "siap-tpm", name: "SIAP TPM (OEE Tahap 3)", claude: { project: "SIAP TPM" } },
    { id: "rally-district", name: "Rally District" },
  ];
  it("cocok persis atau sebagian, tidak menebak bila ambigu", () => {
    expect(matchAgentApp("RapiUang", apps)).toBe("rapiuang");
    expect(matchAgentApp("Warehouse Monitoring", apps)).toBe("sparepart");
    expect(matchAgentApp("siap tpm", apps)).toBe("siap-tpm");
    expect(matchAgentApp("Rally District", apps)).toBe("rally-district");
    expect(matchAgentApp("Project Lain", apps)).toBeNull();
    expect(matchAgentApp("", apps)).toBeNull();
  });
});

describe("lanjutkan (continue_previous)", () => {
  it("flag hanya ada bila diminta", async () => {
    const { makeClaudeTask } = await import("@/lib/ai/claudeTask");
    expect(makeClaudeTask({ project: "Rally District", instruction: "perbaiki logging payload webhook DOKU", continue_previous: true }, 0).draft!.continueSession).toBe(true);
    expect(makeClaudeTask({ project: "Rally District", instruction: "perbaiki logging payload webhook DOKU" }, 0).draft!.continueSession).toBeUndefined();
  });
});
