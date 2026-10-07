/**
 * Penampil Markdown ringan untuk jawaban AI (tanpa dependency, tanpa dangerouslySetInnerHTML).
 * Didukung: # judul, **tebal**, *miring*, `kode`, ```blok kode```, daftar - / 1. (bertingkat),
 * [tautan](https://...), garis ---, paragraf & baris baru.
 */

import React from "react";

/* ------------------------------ Inline ------------------------------ */

const INLINE_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\s][^*\n]*\*)|(\[[^\]\n]+\]\((https?:\/\/[^)\s]+)\))/g;

export function renderInline(text: string, keyPrefix = "i"): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  // Regex baru per panggilan: renderInline rekursif, lastIndex tidak boleh dipakai bersama
  const re = new RegExp(INLINE_RE.source, "g");
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${n++}`;
    if (m[1]) {
      out.push(
        <code key={key} className="rounded bg-line/30 px-1 py-0.5 font-mono text-[0.85em]">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (m[2] || m[3]) {
      out.push(
        <strong key={key} className="font-bold text-ink">
          {renderInline(tok.slice(2, -2), key)}
        </strong>
      );
    } else if (m[4]) {
      out.push(<em key={key}>{renderInline(tok.slice(1, -1), key)}</em>);
    } else if (m[5]) {
      const label = tok.slice(1, tok.indexOf("]("));
      out.push(
        <a key={key} href={m[6]} target="_blank" rel="noopener noreferrer" className="text-teal underline underline-offset-2">
          {label}
        </a>
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ------------------------------ Block ------------------------------- */

type ListItem = { text: string; children: Block[] };
export type Block =
  | { type: "h"; level: number; text: string }
  | { type: "p"; lines: string[] }
  | { type: "ul" | "ol"; start: number; items: ListItem[] }
  | { type: "code"; text: string }
  | { type: "hr" };

const LIST_RE = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/;

/** Ubah teks Markdown menjadi daftar blok (bisa diuji tanpa React). */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  const parseList = (baseIndent: number): { list: Block; next: number } => {
    const first = lines[i].match(LIST_RE)!;
    const ordered = /\d/.test(first[2]);
    const list: Block = { type: ordered ? "ol" : "ul", start: ordered ? parseInt(first[2], 10) : 1, items: [] };
    while (i < lines.length) {
      const m = lines[i].match(LIST_RE);
      if (!m) {
        // baris lanjutan yang menjorok -> bagian dari item terakhir
        if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && list.items.length) {
          list.items[list.items.length - 1].text += ` ${lines[i].trim()}`;
          i++;
          continue;
        }
        break;
      }
      const indent = m[1].replace(/\t/g, "  ").length;
      if (indent < baseIndent) break;
      if (indent > baseIndent && list.items.length) {
        const sub = parseList(indent);
        list.items[list.items.length - 1].children.push(sub.list);
        continue;
      }
      if (/\d/.test(m[2]) !== ordered) break; // ganti jenis daftar = daftar baru
      list.items.push({ text: m[3], children: [] });
      i++;
    }
    return { list, next: i };
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^\s*```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      blocks.push({ type: "code", text: buf.join("\n") });
      continue;
    }
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (h) {
      blocks.push({ type: "h", level: h[1].length, text: h[2].replace(/\s*#+\s*$/, "") });
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    const lm = line.match(LIST_RE);
    if (lm) {
      const { list } = parseList(lm[1].replace(/\t/g, "  ").length);
      blocks.push(list);
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !LIST_RE.test(lines[i]) &&
      !/^\s*#{1,6}\s/.test(lines[i]) &&
      !/^\s*```/.test(lines[i])
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "p", lines: para });
  }
  return blocks;
}

function renderBlocks(blocks: Block[], prefix: string): React.ReactNode[] {
  return blocks.map((b, bi) => {
    const key = `${prefix}-${bi}`;
    switch (b.type) {
      case "h": {
        const size = b.level <= 2 ? "text-[15px]" : "text-sm";
        return (
          <p key={key} className={`${size} font-bold text-ink mt-3 first:mt-0`}>
            {renderInline(b.text, key)}
          </p>
        );
      }
      case "p":
        return (
          <p key={key} className="leading-relaxed">
            {b.lines.map((l, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l, `${key}-${li}`)}
              </React.Fragment>
            ))}
          </p>
        );
      case "ul":
      case "ol": {
        const Tag = b.type === "ol" ? "ol" : "ul";
        return (
          <Tag
            key={key}
            start={b.type === "ol" ? b.start : undefined}
            className={`${b.type === "ol" ? "list-decimal" : "list-disc"} space-y-1 pl-5 marker:text-mute`}
          >
            {b.items.map((it, ii) => (
              <li key={ii} className="leading-relaxed">
                {renderInline(it.text, `${key}-${ii}`)}
                {it.children.length > 0 && <div className="mt-1">{renderBlocks(it.children, `${key}-${ii}`)}</div>}
              </li>
            ))}
          </Tag>
        );
      }
      case "code":
        return (
          <pre key={key} className="overflow-x-auto rounded-btn bg-black/80 p-3 text-[11px] text-gray-100">
            <code>{b.text}</code>
          </pre>
        );
      case "hr":
        return <hr key={key} className="border-line" />;
    }
  });
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={`space-y-2 ${className || ""}`}>{renderBlocks(parseMarkdown(text), "md")}</div>;
}
