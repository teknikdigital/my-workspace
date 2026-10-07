/**
 * Handoff project dari AI coding (Antigravity, Claude Code, Cursor).
 * File HANDOFF.md di folder project dikirim lewat POST /api/activity (field "handoff"),
 * disamarkan rahasianya, lalu disimpan sebagai "dokumen lengkap" project agar AI Asisten
 * My Workspace bisa membacanya (tool read_project_document).
 * Murni (tanpa I/O), diuji di tests/handoff.test.ts.
 */

import { findSecrets, MASK_TEXT } from "@/lib/ai/secretGuard";

export const HANDOFF_MAX_CHARS = 200_000;

/** Nama variabel env yang nilainya pasti rahasia. */
const SECRET_ENV_KEY = /(SECRET|PASSWORD|PASSWD|PASS|PWD|TOKEN|API_?KEY|PRIVATE|SERVICE_ROLE|CREDENTIAL|DATABASE_URL|DSN)/i;

/**
 * Samarkan rahasia di teks handoff:
 *  1. baris gaya .env: SUPABASE_SERVICE_ROLE_KEY=xxxx  -> nilai disamarkan
 *  2. kredensial di URL: postgres://user:pass@host     -> pass disamarkan
 *  3. pola umum (API key, JWT, "password: ...")        -> lewat secretGuard
 */
export function redactHandoff(text: string): { text: string; redacted: number } {
  let redacted = 0;

  let out = text.replace(
    /^(\s*(?:export\s+|\$env:)?([A-Z][A-Z0-9_]{2,})\s*[=:]\s*)(["']?)([^\s"'#][^"'\n]*?)\3\s*$/gm,
    (whole, prefix: string, key: string, quote: string, value: string) => {
      if (!SECRET_ENV_KEY.test(key) || value.includes(MASK_TEXT)) return whole;
      redacted++;
      return `${prefix}${quote}${MASK_TEXT}${quote}`;
    }
  );

  out = out.replace(/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)([^\s@/]+)(@)/gi, (whole, a: string, pass: string, b: string) => {
    if (pass.includes(MASK_TEXT)) return whole;
    redacted++;
    return `${a}${MASK_TEXT}${b}`;
  });

  const spans = findSecrets(out);
  if (spans.length) {
    let res = "";
    let last = 0;
    for (const s of spans) {
      res += out.slice(last, s.start) + MASK_TEXT;
      last = s.end;
    }
    out = res + out.slice(last);
    redacted += spans.length;
  }
  return { text: out, redacted };
}

/** Rapikan nama file: hanya nama dasar, default HANDOFF.md. */
export function handoffFileName(name?: string): string {
  const base = (name || "").split(/[\\/]/).pop()?.trim() || "";
  return (base || "HANDOFF.md").slice(0, 150);
}

/** Siapkan isi handoff untuk disimpan: samarkan rahasia, potong bila terlalu panjang. */
export function prepareHandoff(input: { file_name?: string; content: string }) {
  const { text, redacted } = redactHandoff(input.content.replace(/\r/g, ""));
  const truncated = text.length > HANDOFF_MAX_CHARS;
  return {
    file_name: handoffFileName(input.file_name),
    content: truncated ? `${text.slice(0, HANDOFF_MAX_CHARS)}\n\n(dipotong, dokumen terlalu panjang)` : text,
    redacted,
    truncated,
  };
}
