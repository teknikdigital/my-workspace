/**
 * Format blok isi file di pesan chat, dan peringkasnya.
 *
 * Browser menyisipkan isi file ke pesan sebagai:
 *   [ISI FILE: NIB.pdf | project: Rally District | lokasi: D:\...\_Masuk\NIB.pdf]
 *   ...teks...
 *   [/ISI FILE]
 *
 * Setelah dibaca sekali (dan faktanya disimpan), blok di riwayat diringkas agar
 * isi file tidak dikirim ulang ke AI pada setiap pesan berikutnya (hemat token).
 */

export const FILE_BLOCK_RE = /\[ISI FILE: ([^\]\n]*)\]\n[\s\S]*?\n\[\/ISI FILE\]/g;
export const COMPACT_NOTE = "(isi file sudah dibaca sebelumnya; fakta pentingnya tersimpan di catatan dokumen project)";

export function buildFileBlock(meta: { name: string; project: string; path: string }, text: string): string {
  const clean = text.replace(/\[\/?ISI FILE[^\]]*\]/g, ""); // cegah blok bersarang
  return `[ISI FILE: ${meta.name} | project: ${meta.project} | lokasi: ${meta.path}]\n${clean.trim()}\n[/ISI FILE]`;
}

export interface ParsedFileBlock {
  name: string;
  project: string;
  path: string;
  body: string;
}

/** Ambil semua blok [ISI FILE] dari pesan (untuk disimpan utuh oleh server). */
export function parseFileBlocks(text: string): ParsedFileBlock[] {
  const out: ParsedFileBlock[] = [];
  const re = /\[ISI FILE: ([^\]\n]*)\]\n([\s\S]*?)\n\[\/ISI FILE\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const parts = m[1].split(" | ");
    const get = (k: string) => (parts.find((x) => x.startsWith(`${k}: `)) || "").slice(k.length + 2).trim();
    out.push({ name: parts[0].trim(), project: get("project"), path: get("lokasi"), body: m[2] });
  }
  return out;
}

export function hasFileBlock(text: string): boolean {
  return new RegExp(FILE_BLOCK_RE.source).test(text);
}

/** Ganti isi blok dengan catatan singkat, header (nama/project/lokasi) tetap dipertahankan. */
export function compactFileBlocks(text: string): string {
  return text.replace(FILE_BLOCK_RE, (_m, header) => `[ISI FILE: ${header}]\n${COMPACT_NOTE}\n[/ISI FILE]`);
}

/** Ringkas blok di semua pesan pengguna KECUALI pesan terakhir (yang sedang dibaca AI). */
export function compactHistory<M extends { role: string; content: string }>(messages: M[]): M[] {
  const lastUser = messages.map((m) => m.role).lastIndexOf("user");
  return messages.map((m, i) =>
    m.role === "user" && i !== lastUser && hasFileBlock(m.content) ? { ...m, content: compactFileBlocks(m.content) } : m
  );
}

/** Ambil N pesan terakhir, tanpa memulai dari pesan "assistant" yang kehilangan konteks pertanyaannya. */
export function limitHistory<M extends { role: string }>(messages: M[], max: number): M[] {
  if (messages.length <= max) return messages;
  let cut = messages.slice(-max);
  while (cut.length > 1 && cut[0].role !== "user") cut = cut.slice(1);
  return cut;
}

/* ---- Memori dokumen (dipakai lib/actions/documentMemory.ts) ---- */

export interface DocumentFact {
  label: string; // mis. "NIB"
  value: string; // mis. "1234567890123"
}

export interface SaveDocumentFactsInput {
  project?: string;
  file_name: string;
  file_path?: string;
  summary?: string;
  facts: DocumentFact[];
}

export function formatFactsNote(input: SaveDocumentFactsInput): string {
  const lines = input.facts
    .filter((f) => f.label?.trim() && f.value?.trim())
    .map((f) => `- ${f.label.trim()}: ${f.value.trim()}`);
  return [
    lines.length ? `Fakta penting:\n${lines.join("\n")}` : "",
    input.summary ? `Ringkasan: ${input.summary.trim()}` : "",
    input.file_path ? `File: ${input.file_path}` : `File: ${input.file_name}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

