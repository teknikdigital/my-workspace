/**
 * Memecah dokumen Markdown/teks menjadi bagian per judul, lalu memilih bagian yang relevan
 * dengan pertanyaan. Dipakai tool read_project_document agar AI hanya membaca bagian yang perlu
 * (hemat token), bukan seluruh dokumen. Diuji di tests/documentSections.test.ts.
 */

export interface DocSection {
  heading: string; // "BAGIAN G. DEPLOYMENT & HOSTING > G2. Langkah update rilis"
  text: string;
}

/** Pecah per judul Markdown (#, ##, ###). Judul induk ikut disertakan agar konteks jelas. */
export function splitSections(doc: string): DocSection[] {
  const lines = doc.replace(/\r/g, "").split("\n");
  const sections: DocSection[] = [];
  const path: string[] = []; // judul per level
  let buf: string[] = [];
  let current = "Pembuka";
  let inCode = false;

  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) sections.push({ heading: current, text });
    buf = [];
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) inCode = !inCode;
    const m = !inCode && line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (m) {
      flush();
      const level = m[1].length;
      path.length = level - 1;
      path[level - 1] = m[2].trim();
      current = path.filter(Boolean).join(" > ");
      continue;
    }
    buf.push(line);
  }
  flush();
  return sections;
}

const STOP = new Set(
  "yang dan di ke dari untuk dengan ini itu apa bagaimana berapa adalah atau pada saya kamu project apakah dong ya".split(" ")
);

function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

/**
 * Pilih bagian paling relevan dengan pertanyaan (kata kunci di judul bernilai 3x).
 * Tanpa pertanyaan: kembalikan daftar isi (judul saja) agar AI bisa memilih.
 */
export function pickSections(sections: DocSection[], query: string, maxChars = 6000): DocSection[] {
  const q = words(query);
  if (!q.length) return [];
  const scored = sections
    .map((s, i) => {
      const h = s.heading.toLowerCase();
      const t = s.text.toLowerCase();
      let score = 0;
      for (const w of q) {
        if (h.includes(w)) score += 3;
        const count = t.split(w).length - 1;
        score += Math.min(count, 5);
      }
      return { s, i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);

  const out: { s: DocSection; i: number }[] = [];
  let used = 0;
  for (const x of scored) {
    const len = x.s.heading.length + x.s.text.length;
    if (used + len > maxChars && out.length) break;
    out.push(x);
    used += len;
  }
  // urutkan kembali sesuai urutan dokumen agar mudah dibaca
  return out.sort((a, b) => a.i - b.i).map((x) => x.s);
}

export function tableOfContents(sections: DocSection[]): string[] {
  return sections.map((s) => s.heading);
}
