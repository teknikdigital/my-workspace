/**
 * Secret Guard: mencegat password / API key / token di pesan chat SEBELUM dikirim ke penyedia AI.
 *
 * Alur:
 *  1. guardMessages() mengganti setiap rahasia dengan placeholder [[RAHASIA_n]].
 *     Hanya teks ber-placeholder yang dikirim ke OpenAI/Claude.
 *  2. Nilai asli disimpan di Map per-request (memori server, tidak ditulis ke log/database).
 *  3. Tool create_vault_credential menukar placeholder -> nilai asli lalu mengenkripsi (AES-256-GCM).
 *  4. Rahasia yang tidak disimpan AI akan disimpan otomatis ke Vault oleh service.ts (fallback).
 *  5. Browser menerima versi pesan yang sudah disamarkan untuk menggantikan pesan asli di riwayat chat.
 *
 * Cara paling pasti: apit rahasia dengan ||...||, contoh: "password gmail saya ||Abc123!||".
 * Deteksi otomatis bersifat jaring pengaman (heuristik), bukan jaminan 100%.
 */

export interface DetectedSecret {
  placeholder: string; // [[RAHASIA_1]]
  value: string;
  kind: "password" | "api_key" | "token" | "secret";
  context: string; // potongan teks sekitar (sudah disamarkan) untuk menebak label
  email: string | null; // email terdekat di pesan yang sama, untuk identifier
}

export interface GuardResult<M> {
  safeMessages: M[]; // dikirim ke AI
  maskedMessages: M[]; // dikembalikan ke browser (tampilan)
  secrets: DetectedSecret[];
}

export const PLACEHOLDER_RE = /^\[\[RAHASIA_(\d+)\]\]$/;
export const MASK_TEXT = "🔒[disimpan aman]";

// Pola kunci yang formatnya khas
const KEY_PATTERNS: { re: RegExp; kind: DetectedSecret["kind"] }[] = [
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/g, kind: "secret" },
  { re: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/g, kind: "api_key" }, // OpenAI / Anthropic
  { re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/g, kind: "token" }, // GitHub
  { re: /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g, kind: "token" },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, kind: "api_key" }, // AWS
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/g, kind: "api_key" }, // Google
  { re: /\b(?:sb_secret_|sb_publishable_|sbp_)[A-Za-z0-9_-]{20,}\b/g, kind: "api_key" }, // Supabase
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, kind: "token" }, // Slack
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, kind: "token" }, // JWT (mis. service_role)
];

// Kata kunci yang diikuti nilai rahasia
const KEYWORD =
  "password|passwd|pass|pwd|kata\\s*sandi|katasandi|sandi|pin|passcode|otp|token|api\\s*key|apikey|secret|kunci\\s*rahasia|recovery\\s*code|kode\\s*pemulihan";
// Kata pengisi yang boleh ada di antara kata kunci dan nilainya
const FILLER = new Set(
  "nya emailnya email akun akunnya gmail google github supabase vercel saya ku aku untuk dari login masuk baru lama yang adalah yaitu ialah is = : dengan nya: ini itu".split(
    " "
  )
);
const EXPLICIT_SEP = new Set(["adalah", "yaitu", "ialah", "is", "=", ":"]);

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function looksStrong(tok: string): boolean {
  // campuran huruf + angka, atau mengandung simbol, atau huruf besar-kecil campur (dan cukup panjang)
  if (tok.length < 4) return false;
  const hasDigit = /\d/.test(tok);
  const hasAlpha = /[A-Za-z]/.test(tok);
  const hasSymbol = /[^A-Za-z0-9]/.test(tok);
  const mixedCase = /[a-z]/.test(tok) && /[A-Z]/.test(tok);
  return (hasDigit && hasAlpha) || (hasSymbol && tok.length >= 6) || (mixedCase && tok.length >= 8) || /^\d{4,8}$/.test(tok);
}

function kindFromKeyword(k: string): DetectedSecret["kind"] {
  const s = k.toLowerCase();
  if (/token|otp/.test(s)) return "token";
  if (/api/.test(s)) return "api_key";
  if (/secret|kunci|recovery|pemulihan/.test(s)) return "secret";
  return "password";
}

interface Span {
  start: number;
  end: number;
  value: string;
  kind: DetectedSecret["kind"];
}

/** Cari rahasia dalam satu teks. Mengembalikan rentang karakter yang harus diganti. */
export function findSecrets(text: string): Span[] {
  const spans: Span[] = [];
  const overlaps = (s: number, e: number) => spans.some((x) => s < x.end && e > x.start);

  // 0. Teks samaran & placeholder tidak pernah dianggap rahasia baru
  if (text.includes(MASK_TEXT) || text.includes("[[RAHASIA_")) {
    text = text.replace(/🔒\[disimpan aman\]|\[\[RAHASIA_\d+\]\]/g, (m) => " ".repeat(m.length));
  }

  // 1. Penanda eksplisit ||...||
  for (const m of Array.from(text.matchAll(/\|\|([^|\n]+?)\|\|/g))) {
    spans.push({ start: m.index!, end: m.index! + m[0].length, value: m[1].trim(), kind: "secret" });
  }

  // 2. Format kunci yang khas
  for (const { re, kind } of KEY_PATTERNS) {
    for (const m of Array.from(text.matchAll(re))) {
      const s = m.index!;
      const e = s + m[0].length;
      if (!overlaps(s, e)) spans.push({ start: s, end: e, value: m[0], kind });
    }
  }

  // 3. Kata kunci + nilai: "password emailnya @Abc123", "pin: 123456", "api key = xyz..."
  const kwRe = new RegExp(`\\b(${KEYWORD})\\b`, "gi");
  for (const m of Array.from(text.matchAll(kwRe))) {
    let pos = m.index! + m[0].length;
    let explicit = false;
    for (let step = 0; step < 5; step++) {
      const rest = text.slice(pos);
      const tm = rest.match(/^\s*(["'`]([^"'`\n]+)["'`]|[^\s]+)/);
      if (!tm) break;
      const raw = tm[1];
      const tokStart = pos + tm[0].length - raw.length;
      pos = pos + tm[0].length;
      const quoted = tm[2];
      // Sudah disamarkan / placeholder dari ronde sebelumnya: bukan rahasia baru
      if (raw.startsWith("🔒") || raw.startsWith("[[RAHASIA_")) break;
      // pisahkan "nya:" / ":" yang menempel
      const bare = raw.replace(/^[:=]+/, "").replace(/[,;)]+$/, "");
      const lower = bare.toLowerCase();
      if (!quoted && (FILLER.has(lower) || FILLER.has(raw.toLowerCase()) || bare === "")) {
        if (EXPLICIT_SEP.has(lower) || /[:=]$/.test(raw)) explicit = true;
        if (/[:=]$/.test(raw) && raw.length > 1) explicit = true;
        continue;
      }
      if (EMAIL_RE.test(bare) && !quoted) continue; // email bukan rahasia, lanjut cari
      const value = quoted ?? bare;
      const accept = quoted !== undefined || looksStrong(value) || (explicit && value.length >= 4);
      if (accept) {
        const valStart = quoted ? tokStart : tokStart + raw.indexOf(bare);
        const valEnd = quoted ? tokStart + raw.length : valStart + bare.length;
        if (!overlaps(valStart, valEnd)) spans.push({ start: valStart, end: valEnd, value, kind: kindFromKeyword(m[1]) });
        break;
      }
      // Kata biasa (mis. "PIN ATM 123456"): lanjut cari, tapi setelah ini hanya nilai "kuat" yang diterima
      explicit = false;
    }
  }

  return spans.sort((a, b) => a.start - b.start);
}

/**
 * Samarkan rahasia di pesan-pesan pengguna. Pesan assistant/system tidak diubah.
 * Penomoran placeholder berurutan di seluruh percakapan agar konsisten antar-ronde.
 */
export function guardMessages<M extends { role: string; content: string }>(messages: M[]): GuardResult<M> {
  const secrets: DetectedSecret[] = [];
  const safeMessages: M[] = [];
  const maskedMessages: M[] = [];

  for (const msg of messages) {
    if (msg.role !== "user" || !msg.content) {
      safeMessages.push(msg);
      maskedMessages.push(msg);
      continue;
    }
    const spans = findSecrets(msg.content);
    if (!spans.length) {
      safeMessages.push(msg);
      maskedMessages.push(msg);
      continue;
    }
    let safe = "";
    let masked = "";
    let cursor = 0;
    const local: DetectedSecret[] = [];
    for (const sp of spans) {
      const ph = `[[RAHASIA_${secrets.length + local.length + 1}]]`;
      safe += msg.content.slice(cursor, sp.start) + ph;
      masked += msg.content.slice(cursor, sp.start) + MASK_TEXT;
      cursor = sp.end;
      local.push({ placeholder: ph, value: sp.value, kind: sp.kind, context: "", email: null });
    }
    safe += msg.content.slice(cursor);
    masked += msg.content.slice(cursor);
    const email = safe.match(EMAIL_RE)?.[0] || null;
    for (const s of local) {
      s.email = email;
      const i = safe.indexOf(s.placeholder);
      s.context = safe.slice(Math.max(0, i - 80), i).trim();
    }
    secrets.push(...local);
    safeMessages.push({ ...msg, content: safe });
    maskedMessages.push({ ...msg, content: masked });
  }
  return { safeMessages, maskedMessages, secrets };
}

/** Tebak label Vault dari konteks, mis. "Password Gmail julianpandanu@gmail.com". */
export function guessVaultLabel(s: DetectedSecret): string {
  const ctx = s.context.toLowerCase();
  const services: [RegExp, string][] = [
    [/gmail|google/, "Google"],
    [/supabase/, "Supabase"],
    [/github/, "GitHub"],
    [/vercel/, "Vercel"],
    [/openai|chatgpt/, "OpenAI"],
    [/whatsapp|meta/, "Meta"],
    [/bank|bca|bri|mandiri|bni/, "Bank"],
  ];
  const svc = services.find(([re]) => re.test(ctx))?.[1];
  const kindLabel = { password: "Password", api_key: "API Key", token: "Token", secret: "Rahasia" }[s.kind];
  return [kindLabel, svc, s.email].filter(Boolean).join(" ").slice(0, 100) || "Rahasia dari chat AI";
}
