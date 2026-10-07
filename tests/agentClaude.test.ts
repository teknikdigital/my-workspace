import { describe, it, expect } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const cc = require("../agent/claude.cjs");

describe("buildArgs", () => {
  it("mode edit: acceptEdits, prompt tepat setelah -p, daftar izin di akhir", () => {
    const a: string[] = cc.buildArgs({ prompt: "Tambah fitur X", mode: "edit", model: "sonnet" });
    expect(a.slice(0, 2)).toEqual(["-p", "Tambah fitur X"]);
    expect(a[a.indexOf("--permission-mode") + 1]).toBe("acceptEdits");
    expect(a[a.indexOf("--output-format") + 1]).toBe("stream-json");
    expect(a).toContain("--verbose");
    expect(a[a.length - 2]).toBe("--allowedTools");
    const allowed = a[a.length - 1];
    expect(allowed).toContain("PowerShell(npm run lint *)");
    expect(allowed).toContain("Bash(npm run lint *)");
    expect(allowed).toContain("Edit");
    expect(allowed).toContain("PowerShell(node *)");
    expect(allowed).toContain("Bash(tail *)");
    const denied = a[a.indexOf("--disallowedTools") + 1];
    expect(denied).toContain("PowerShell(git push *)");
    expect(denied).toContain("Read(./**/.env)");
    expect(denied).not.toContain(",Edit,");
  });
  it("mode read: dontAsk, Edit/Write ditolak, tidak ada perintah build", () => {
    const a: string[] = cc.buildArgs({ prompt: "Analisis", mode: "read", model: "haiku", resume: "abc-123-def" });
    expect(a[a.indexOf("--permission-mode") + 1]).toBe("dontAsk");
    expect(a[a.indexOf("--resume") + 1]).toBe("abc-123-def");
    expect(a[a.length - 1]).not.toContain("npm run build");
    expect(a[a.length - 1]).not.toContain("(node *)");
    expect(a[a.length - 1]).not.toMatch(/(^|,)Edit(,|$)/);
    expect(a[a.indexOf("--disallowedTools") + 1]).toMatch(/(^|,)Edit(,|$)/);
    expect(a[a.indexOf("--append-system-prompt") + 1]).toContain("MODE BACA SAJA");
  });
});

describe("normalizeRequest", () => {
  const g = { defaultModel: "sonnet" };
  it("menolak project terkunci baca saja untuk mode edit", () => {
    expect(cc.normalizeRequest({ prompt: "x", mode: "edit" }, { mode: "read" }, g).error).toMatch(/BACA SAJA/);
    expect(cc.normalizeRequest({ prompt: "x", mode: "edit" }, undefined, g).error).toMatch(/BACA SAJA/); // default terkunci
    expect(cc.normalizeRequest({ prompt: "x", mode: "read" }, { mode: "read" }, g).mode).toBe("read");
  });
  it("validasi prompt, model, resume, dan rahasia", () => {
    expect(cc.normalizeRequest({ prompt: "  " }, { mode: "edit" }, g).error).toBeTruthy();
    expect(cc.normalizeRequest({ prompt: "pakai [[RAHASIA_1]]" }, { mode: "edit" }, g).error).toMatch(/rahasia/);
    const ok = cc.normalizeRequest({ prompt: "x", mode: "edit", model: "gpt", resume: "bad id!" }, { mode: "edit" }, g);
    expect(ok).toMatchObject({ mode: "edit", model: "sonnet", resume: null });
  });
});

describe("parseStreamLine", () => {
  it("init, teks, tool, hasil", () => {
    expect(cc.parseStreamLine('{"type":"system","subtype":"init","model":"claude-sonnet-5","session_id":"s1"}').init).toEqual({
      model: "claude-sonnet-5",
      sessionId: "s1",
    });
    const a = cc.parseStreamLine(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "text", text: "Saya cek dulu." },
            { type: "tool_use", name: "Edit", input: { file_path: "D:\\Project\\Rapiuang\\src\\a.js" } },
            { type: "tool_use", name: "PowerShell", input: { command: "npm run lint" } },
          ],
        },
      })
    );
    expect(a.events.map((e: any) => e.kind)).toEqual(["text", "tool", "tool"]);
    expect(a.events[1].file).toBe("D:\\Project\\Rapiuang\\src\\a.js");
    expect(a.events[2].text).toBe("PowerShell: npm run lint");
    const r = cc.parseStreamLine(
      JSON.stringify({
        type: "result",
        is_error: false,
        result: "Selesai.\nRINGKASAN: Tambah export PDF",
        session_id: "s1",
        total_cost_usd: 0.12,
        num_turns: 5,
        permission_denials: [{ tool_name: "PowerShell", tool_input: { command: "git push" } }],
      })
    ).result;
    expect(r).toMatchObject({ isError: false, sessionId: "s1", costUsd: 0.12, denials: ["PowerShell: git push"] });
  });
  it("pesan sub-agent diabaikan, baris bukan JSON jadi info", () => {
    expect(cc.parseStreamLine('{"type":"assistant","parent_tool_use_id":"t1","message":{"content":[{"type":"text","text":"x"}]}}').events).toEqual([]);
    expect(cc.parseStreamLine("Warning: something").events[0]).toMatchObject({ kind: "info" });
  });
});

describe("ringkasan & file", () => {
  it("ambil RINGKASAN, fallback ke instruksi", () => {
    expect(cc.extractSummary("bla\n**RINGKASAN:** Fix bug saldo", "x")).toBe("Fix bug saldo");
    expect(cc.extractSummary("tanpa ringkasan", "Tambah export PDF\ndetail")).toBe("Claude Code: Tambah export PDF");
    expect(cc.stripSummary("Hasil kerja\nRINGKASAN: a")).toBe("Hasil kerja");
  });
  it("file relatif terhadap folder project", () => {
    const files = cc.changedFiles(
      [{ file: "/p/app/src/a.js" }, { file: "/p/app/src/a.js" }, { file: "rel/b.ts" }, { kind: "tool" }],
      "/p/app"
    );
    expect(files).toEqual(["src/a.js", "rel/b.ts"]);
  });
  it("env tanpa ANTHROPIC_*", () => {
    const env = cc.claudeEnv({ PATH: "x", ANTHROPIC_BASE_URL: "http://router", ANTHROPIC_AUTH_TOKEN: "t" }, false);
    expect(env.PATH).toBe("x");
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(cc.claudeEnv({ ANTHROPIC_BASE_URL: "r" }, true).ANTHROPIC_BASE_URL).toBe("r");
  });
});
