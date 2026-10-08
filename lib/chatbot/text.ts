/**
 * Helper teks bersama untuk bot chat (WhatsApp, Telegram). Murni, tanpa I/O.
 */

/** Potong teks panjang di batas paragraf/baris/spasi. Gabungan bagian dengan "\n\n" = teks asli (setelah trim). */
export function splitMessage(text: string, max = 3500): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut <= 0) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

const FENCE = /^\s*```/;

/**
 * Seperti splitMessage, tetapi blok kode ``` yang terpotong ditutup di akhir bagian
 * dan dibuka lagi di awal bagian berikutnya, supaya format tiap bagian tetap utuh.
 */
export function splitMarkdown(md: string, max = 3500): string[] {
  const parts = splitMessage(md, max - 8); // sisakan ruang untuk ``` tambahan
  let open = false;
  return parts.map((p) => {
    let out = open ? "```\n" + p : p;
    const fences = out.split("\n").filter((l) => FENCE.test(l)).length;
    open = fences % 2 === 1;
    if (open) out += "\n```";
    return out;
  });
}
