/**
 * Ekstrak teks dari file DI BROWSER (file tidak dikirim ke server mana pun untuk dibaca).
 * Hasil teks inilah yang (bila diizinkan pengguna) dikirim ke AI.
 *
 * Didukung: PDF berteks (unpdf), Word .docx (mammoth), Excel .xlsx/.xls (SheetJS), teks (txt/md/csv/json/log).
 * Belum didukung: gambar & PDF hasil scan (perlu OCR), .doc lama, .pptx.
 * Library dimuat dinamis (hanya saat dibutuhkan) agar halaman tetap ringan.
 */

// ~40.000 karakter ≈ 11.000 token ≈ Rp 30 (gpt-4o-mini). Cukup untuk dokumen serah terima/spesifikasi.
export const MAX_CHARS_PER_FILE = 40_000;
/** Perkiraan kasar token untuk teks campuran Indonesia/angka. */
export const estimateTokens = (chars: number) => Math.ceil(chars / 3.5);

export type ExtractResult =
  | { ok: true; text: string; chars: number; truncated: boolean; method: string }
  | { ok: false; reason: string };

const TEXT_EXT = ["txt", "md", "csv", "tsv", "json", "log", "xml", "html", "htm", "sql", "env.example", "yml", "yaml"];

export function fileKind(name: string): "pdf" | "docx" | "sheet" | "text" | "image" | "unsupported" {
  const ext = name.toLowerCase().split(".").pop() || "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (["xlsx", "xlsm", "xls", "ods"].includes(ext)) return "sheet";
  if (TEXT_EXT.includes(ext)) return "text";
  if (["png", "jpg", "jpeg", "webp", "gif", "heic", "bmp", "tif", "tiff"].includes(ext)) return "image";
  return "unsupported";
}

export function canExtract(name: string) {
  const k = fileKind(name);
  return k === "pdf" || k === "docx" || k === "sheet" || k === "text";
}

/** Rapikan spasi & potong ke batas karakter. */
export function finalize(raw: string, method: string): ExtractResult {
  const text = raw
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return { ok: false, reason: "Tidak ada teks (kemungkinan hasil scan/gambar, perlu OCR)" };
  const truncated = text.length > MAX_CHARS_PER_FILE;
  const out = truncated ? `${text.slice(0, MAX_CHARS_PER_FILE)}\n[... terpotong, ${text.length - MAX_CHARS_PER_FILE} karakter tidak dibaca]` : text;
  return { ok: true, text: out, chars: Math.min(text.length, MAX_CHARS_PER_FILE), truncated, method };
}

export async function extractText(file: File): Promise<ExtractResult> {
  const kind = fileKind(file.name);
  try {
    if (kind === "text") return finalize(await file.text(), "text");

    if (kind === "pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text } = await pdfText(pdf, { mergePages: false });
      const pages = (Array.isArray(text) ? text : [text]).map((t, i) => `--- Halaman ${i + 1} ---\n${t}`);
      return finalize(pages.join("\n"), "pdf");
    }

    if (kind === "docx") {
      const mammoth: any = await import("mammoth/mammoth.browser");
      const r = await (mammoth.default || mammoth).extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return finalize(r.value || "", "docx");
    }

    if (kind === "sheet") {
      const XLSX: any = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const parts = wb.SheetNames.map(
        (n: string) => `--- Sheet: ${n} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false })}`
      );
      return finalize(parts.join("\n"), "sheet");
    }

    if (kind === "image") return { ok: false, reason: "Gambar belum bisa dibaca (perlu OCR)" };
    return { ok: false, reason: "Jenis file belum didukung untuk dibaca" };
  } catch (e) {
    return { ok: false, reason: `Gagal membaca: ${(e as Error).message}` };
  }
}
