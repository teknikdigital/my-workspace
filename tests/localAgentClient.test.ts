import { describe, it, expect } from "vitest";
import { guessTargetApp, formatBytes, isOlderVersion } from "@/lib/local-agent/client";

const apps = [
  { id: "myworkspace", name: "My Workspace" },
  { id: "rapiuang", name: "Rapiuang" },
  { id: "siap-tpm", name: "SIAP TPM (OEE Tahap 3)" },
  { id: "sparepart", name: "Sparepart / Warehouse Monitoring" },
  { id: "rally-district", name: "Rally District" },
];

describe("guessTargetApp", () => {
  it("menebak project dari kalimat", () => {
    expect(guessTargetApp("simpan ke Rally District ya", apps)).toBe("rally-district");
    expect(guessTargetApp("ini dokumen untuk siap tpm", apps)).toBe("siap-tpm");
    expect(guessTargetApp("taruh di folder sparepart", apps)).toBe("sparepart");
    expect(guessTargetApp("file desain rapiuang", apps)).toBe("rapiuang");
  });
  it("tidak menebak bila tidak jelas atau lebih dari satu", () => {
    expect(guessTargetApp("tolong simpan file ini", apps)).toBeNull();
    expect(guessTargetApp("untuk rapiuang dan rally district", apps)).toBeNull();
  });
});

describe("helper", () => {
  it("formatBytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
  it("isOlderVersion", () => {
    expect(isOlderVersion("1.2.0", "1.3.0")).toBe(true);
    expect(isOlderVersion("1.3.0", "1.3.0")).toBe(false);
    expect(isOlderVersion("1.10.0", "1.3.0")).toBe(false);
  });
});
