/**
 * File yang disiapkan AI untuk dikirim ke pengguna (saat ini lewat bot Telegram).
 * Isi selalu Markdown; diubah ke .docx oleh kanal pengirim (lib/documents/markdownToDocx.ts).
 */
export type GeneratedFormat = "docx" | "md";

export interface GeneratedFile {
  title: string;
  format: GeneratedFormat;
  markdown: string;
  /** created = dibuat AI barusan; stored = dokumen yang sudah tersimpan di My Workspace */
  source: "created" | "stored";
  /** Lokasi file asli di laptop (dokumen unggahan). Bila bisa dibaca, file asli yang dikirim. */
  originalPath?: string | null;
}

export const MAX_DOCUMENT_CHARS = 60_000;
export const MAX_FILES_PER_MESSAGE = 3;

/** Validasi argumen tool create_document_file. */
export function makeGeneratedFile(args: any, existing: number): { file?: GeneratedFile; error?: string } {
  const title = String(args?.title || "").replace(/\s+/g, " ").trim().slice(0, 150);
  const markdown = String(args?.content || "").trim();
  const format: GeneratedFormat = args?.format === "md" ? "md" : "docx";
  if (!title) return { error: "title wajib diisi" };
  if (markdown.length < 20) return { error: "content terlalu pendek: tulis isi dokumen LENGKAP dalam Markdown" };
  if (markdown.length > MAX_DOCUMENT_CHARS) return { error: `content terlalu panjang (maks ${MAX_DOCUMENT_CHARS} karakter)` };
  if (/\[\[RAHASIA_\d+\]\]/.test(markdown)) return { error: "Dokumen tidak boleh berisi data rahasia/placeholder Vault" };
  if (existing >= MAX_FILES_PER_MESSAGE) return { error: `Maksimal ${MAX_FILES_PER_MESSAGE} file per pesan` };
  return { file: { title, format, markdown, source: "created" } };
}
