/**
 * Markdown (hasil tulisan AI) -> file Word .docx.
 * Mendukung: judul (#..####), paragraf, **tebal**, *miring*, `kode`, [link](url), daftar berbutir & bernomor
 * (bertingkat dengan indentasi 2 spasi), tabel pipa, blok kode ```, kutipan >, garis ---.
 * Format: A4, margin 2,5 cm, Calibri 11, nomor halaman di footer.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";

export interface DocxOptions {
  title: string;
  /** Baris kecil di bawah judul, mis. "Dibuat 8 Oktober 2026 · My Workspace" */
  subtitle?: string;
}

const FONT = "Calibri";
const MONO = "Consolas";
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

/* ---------------- inline: **tebal**, *miring*, `kode`, [link](url) ---------------- */

type Style = { bold?: boolean; italics?: boolean; code?: boolean; strike?: boolean };

const INLINE = /(\*\*([^*]+?)\*\*|__([^_]+?)__|`([^`]+?)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|~~([^~]+?)~~|(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])|(?<![\w_])_(?!\s)([^_\n]+?)_(?![\w_]))/;

function run(text: string, s: Style): TextRun {
  return new TextRun({
    text,
    bold: s.bold,
    italics: s.italics,
    strike: s.strike,
    font: s.code ? MONO : undefined,
    shading: s.code ? { type: ShadingType.CLEAR, color: "auto", fill: "F2F2F2" } : undefined,
  });
}

export function inlineRuns(text: string, base: Style = {}): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  let rest = text;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(run(rest, base));
      break;
    }
    if (m.index > 0) out.push(run(rest.slice(0, m.index), base));
    if (m[2] !== undefined || m[3] !== undefined) out.push(...inlineRuns(m[2] ?? m[3], { ...base, bold: true }));
    else if (m[4] !== undefined) out.push(run(m[4], { ...base, code: true }));
    else if (m[5] !== undefined)
      out.push(new ExternalHyperlink({ link: m[6], children: [new TextRun({ text: m[5], style: "Hyperlink" })] }));
    else if (m[7] !== undefined) out.push(...inlineRuns(m[7], { ...base, strike: true }));
    else out.push(...inlineRuns(m[8] ?? m[9], { ...base, italics: true }));
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

/* ---------------- blok ---------------- */

function isTableRow(l: string) {
  return /^\s*\|.*\|\s*$/.test(l);
}
function isTableSep(l: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);
}
function cells(l: string) {
  return l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

const TEXT_WIDTH = 9070; // lebar area teks A4 dengan margin 2,5 cm (twip)

/** Lebar kolom sebanding panjang isi terpanjang (akar kuadrat agar kolom panjang tidak mendominasi). */
export function columnWidths(rows: string[][], cols: number, total = TEXT_WIDTH): number[] {
  const weight = Array.from({ length: cols }, (_, c) => Math.sqrt(Math.max(3, ...rows.map((r) => (r[c] || "").length))));
  const sum = weight.reduce((a, b) => a + b, 0);
  const w = weight.map((x) => Math.max(600, Math.round((x / sum) * total)));
  const over = w.reduce((a, b) => a + b, 0) - total; // koreksi akibat batas minimum
  if (over > 0) {
    const i = w.indexOf(Math.max(...w));
    w[i] -= over;
  }
  return w;
}

function buildTable(rows: string[][]): Table {
  const cols = Math.max(...rows.map((r) => r.length));
  const widths = columnWidths(rows, cols);
  const border = { style: BorderStyle.SINGLE, size: 4, color: "A6A6A6" };
  return new Table({
    width: { size: TEXT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: rows.map(
      (r, i) =>
        new TableRow({
          tableHeader: i === 0,
          children: Array.from({ length: cols }, (_, c) =>
            new TableCell({
              width: { size: widths[c], type: WidthType.DXA },
              shading: i === 0 ? { type: ShadingType.CLEAR, color: "auto", fill: "DCE6F1" } : undefined,
              margins: { top: 40, bottom: 40, left: 80, right: 80 },
              children: [new Paragraph({ spacing: { after: 0 }, children: inlineRuns(r[c] || "", i === 0 ? { bold: true } : {}) })],
            })
        ),
        })
    ),
  });
}

/** Ubah Markdown menjadi daftar blok docx (Paragraph/Table). Diekspor untuk pengujian. */
export function markdownBlocks(md: string): (Paragraph | Table)[] {
  const lines = String(md || "").replace(/\r/g, "").split("\n");
  const out: (Paragraph | Table)[] = [];
  let i = 0;
  let numberedInstance = 0; // setiap daftar bernomor baru mulai dari 1
  let inNumbered = false;

  while (i < lines.length) {
    const line = lines[i];

    // blok kode
    const fence = line.match(/^\s*```/);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++; // lewati penutup
      for (const c of code.length ? code : [""])
        out.push(
          new Paragraph({
            spacing: { after: 0 },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: "F2F2F2" },
            children: [new TextRun({ text: c || " ", font: MONO, size: 19 })],
          })
        );
      out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      inNumbered = false;
      continue;
    }

    // tabel
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const rows = [cells(line)];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      out.push(buildTable(rows));
      out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
      inNumbered = false;
      continue;
    }

    const h = line.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      const level = Math.min(h[1].length, 4) - 1;
      out.push(new Paragraph({ heading: HEADINGS[level], children: inlineRuns(h[2].replace(/\*\*/g, "")) }));
      inNumbered = false;
      i++;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "A6A6A6", space: 1 } }, children: [] }));
      inNumbered = false;
      i++;
      continue;
    }

    const bullet = line.match(/^(\s*)[-*+]\s+(?:\[( |x|X)\]\s+)?(.*)$/);
    if (bullet) {
      const level = Math.min(Math.floor(bullet[1].replace(/\t/g, "  ").length / 2), 3);
      const box = bullet[2] === undefined ? "" : bullet[2] === " " ? "☐ " : "☑ ";
      out.push(new Paragraph({ numbering: { reference: "bullets", level }, children: inlineRuns(box + bullet[3]) }));
      i++;
      continue;
    }

    const num = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (num) {
      const level = Math.min(Math.floor(num[1].replace(/\t/g, "  ").length / 2), 3);
      if (!inNumbered && level === 0) numberedInstance++;
      inNumbered = true;
      out.push(
        new Paragraph({ numbering: { reference: "numbers", level, instance: numberedInstance }, children: inlineRuns(num[2]) })
      );
      i++;
      continue;
    }

    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      out.push(
        new Paragraph({
          indent: { left: 567 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: "A6A6A6", space: 8 } },
          children: inlineRuns(quote[1], { italics: true }),
        })
      );
      i++;
      continue;
    }

    if (!line.trim()) {
      // baris kosong memutus daftar bernomor hanya bila baris berikutnya bukan item bernomor
      const next = lines.slice(i + 1).find((l) => l.trim());
      if (!next || !/^\s*\d+[.)]\s+/.test(next)) inNumbered = false;
      i++;
      continue;
    }

    // paragraf: gabungkan baris berurutan
    const para: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*(```|#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\|)/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i])
    )
      para.push(lines[i++].trim());
    out.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: inlineRuns(para.join(" ")) }));
    inNumbered = false;
  }
  return out;
}

function levels(format: (typeof LevelFormat)[keyof typeof LevelFormat], texts: string[]) {
  return texts.map((text, level) => ({
    level,
    format,
    text,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 567 * (level + 1), hanging: 340 } } },
  }));
}

export async function markdownToDocx(md: string, opts: DocxOptions): Promise<Buffer> {
  // Judul tidak diulang bila Markdown sudah diawali "# <judul yang sama>"
  let body = String(md || "").trim();
  const first = body.match(/^#\s+(.+)\n?/);
  if (first && first[1].replace(/\*\*/g, "").trim().toLowerCase() === opts.title.trim().toLowerCase()) body = body.slice(first[0].length);

  const header: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun(opts.title)] }),
  ];
  if (opts.subtitle)
    header.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [new TextRun({ text: opts.subtitle, italics: true, color: "7F7F7F", size: 18 })],
      })
    );

  const doc = new Document({
    creator: "My Workspace",
    title: opts.title,
    styles: {
      default: { document: { run: { font: FONT, size: 22 }, paragraph: { spacing: { after: 120, line: 276 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", run: { size: 36, bold: true, color: "1F3864" }, paragraph: { spacing: { after: 120 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { size: 30, bold: true, color: "1F3864" }, paragraph: { spacing: { before: 240, after: 120 }, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { size: 26, bold: true, color: "2E74B5" }, paragraph: { spacing: { before: 200, after: 100 }, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", run: { size: 24, bold: true }, paragraph: { spacing: { before: 160, after: 80 }, keepNext: true } },
        { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", run: { size: 22, bold: true, italics: true }, paragraph: { spacing: { before: 120, after: 60 }, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: levels(LevelFormat.BULLET, ["•", "◦", "▪", "•"]) },
        { reference: "numbers", levels: levels(LevelFormat.DECIMAL, ["%1.", "%2.", "%3.", "%4."]) },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1418, bottom: 1418, left: 1418, right: 1418 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Halaman ", size: 16, color: "7F7F7F" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "7F7F7F" }),
                  new TextRun({ text: " dari ", size: 16, color: "7F7F7F" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "7F7F7F" }),
                ],
              }),
            ],
          }),
        },
        children: [...header, ...markdownBlocks(body)],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

/** Nama file aman: "TOR Rapat Isolator / 2026" -> "TOR-Rapat-Isolator-2026" */
export function safeFileBase(title: string): string {
  const base = String(title || "dokumen")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  return base || "dokumen";
}
