/**
 * Ekstrak teks dari file DI SERVER (dipakai bot Telegram: file dikirim ke bot, lalu dibaca AI).
 * Jenis & batas sama dengan versi browser (extractText.ts): PDF berteks, .docx, Excel, teks.
 */

import { fileKind, finalize, type ExtractResult } from "./extractText";

export async function extractTextFromBuffer(buf: Buffer, name: string): Promise<ExtractResult> {
  const kind = fileKind(name);
  try {
    if (kind === "text") return finalize(buf.toString("utf8"), "text");

    if (kind === "pdf") {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await pdfText(pdf, { mergePages: false });
      const pages = (Array.isArray(text) ? text : [text]).map((t, i) => `--- Halaman ${i + 1} ---\n${t}`);
      return finalize(pages.join("\n"), "pdf");
    }

    if (kind === "docx") {
      const mammoth: any = await import("mammoth");
      const r = await (mammoth.default || mammoth).extractRawText({ buffer: buf });
      return finalize(r.value || "", "docx");
    }

    if (kind === "sheet") {
      const XLSX: any = await import("xlsx");
      const wb = (XLSX.default || XLSX).read(buf, { type: "buffer" });
      const utils = (XLSX.default || XLSX).utils;
      const parts = wb.SheetNames.map(
        (n: string) => `--- Sheet: ${n} ---\n${utils.sheet_to_csv(wb.Sheets[n], { blankrows: false })}`
      );
      return finalize(parts.join("\n"), "sheet");
    }

    if (kind === "image") return { ok: false, reason: "Foto/gambar belum bisa dibaca (perlu OCR). Kirim sebagai PDF berteks atau Word." };
    return { ok: false, reason: "Jenis file belum didukung. Yang bisa: PDF berteks, Word .docx, Excel, TXT/CSV/MD." };
  } catch (e) {
    return { ok: false, reason: `Gagal membaca file: ${(e as Error).message}` };
  }
}
