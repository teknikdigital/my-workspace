#!/usr/bin/env node
/**
 * Mode lokal bot Telegram (tanpa Vercel / tanpa alamat publik).
 * Mengambil pesan dari Telegram (getUpdates, long polling) lalu meneruskannya ke
 * http://localhost:3000/api/telegram dengan secret token, persis seperti webhook.
 *
 *   1. Jalankan aplikasi:   npm run dev
 *   2. Terminal lain:        node scripts/telegram-poll.mjs
 *   3. Chat ke bot. Ctrl+C untuk berhenti.
 *
 * Catatan:
 *  - Webhook dan polling tidak bisa aktif bersamaan. Skrip ini MENONAKTIFKAN webhook.
 *    Untuk kembali ke Vercel: node scripts/telegram-webhook.mjs
 *  - Bot hanya menjawab selama laptop menyala dan kedua terminal berjalan.
 *  - Alamat lain: --target http://localhost:3001/api/telegram
 * Membaca TELEGRAM_BOT_TOKEN & TELEGRAM_WEBHOOK_SECRET dari .env.local. Token tidak pernah dicetak.
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^".*"$|^'.*'$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    out[m[1]] = v.trim();
  }
  return out;
}

const fileEnv = loadEnvFile(path.join(process.cwd(), ".env.local"));
const env = (k) => process.env[k] || fileEnv[k] || "";
const args = process.argv.slice(2);
const tIdx = args.indexOf("--target");
const target = tIdx >= 0 ? args[tIdx + 1] : "http://localhost:3000/api/telegram";
const token = env("TELEGRAM_BOT_TOKEN");
const secret = env("TELEGRAM_WEBHOOK_SECRET");
const root = (env("TELEGRAM_API_URL") || "https://api.telegram.org").replace(/\/+$/, "");
const once = args.includes("--once"); // untuk pengujian: satu putaran lalu berhenti

if (!token || !secret) {
  console.error("TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET belum ada di .env.local. Jalankan dari folder project.");
  process.exit(1);
}
const mask = (s) => String(s).replaceAll(token, "***");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, body = {}, timeoutMs = 15000) {
  const res = await fetch(`${root}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) {
    const err = new Error(`${method}: ${j.description || res.status}`);
    err.code = j.error_code || res.status;
    throw err;
  }
  return j.result;
}

async function forward(update) {
  const res = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
    body: JSON.stringify(update),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`localhost membalas ${res.status}`);
}

async function main() {
  const me = await call("getMe");
  const info = await call("getWebhookInfo");
  if (info.url) {
    await call("deleteWebhook", { drop_pending_updates: false });
    console.log(`Webhook ${info.url} dinonaktifkan (kembali ke Vercel: node scripts/telegram-webhook.mjs).`);
  }
  console.log(`Mode lokal aktif: @${me.username} -> ${target}`);
  console.log("Pastikan 'npm run dev' berjalan. Ctrl+C untuk berhenti.\n");

  let offset = 0;
  let localDownWarned = false;
  for (;;) {
    let updates = [];
    try {
      updates = await call("getUpdates", { offset, timeout: once ? 0 : 30, allowed_updates: ["message", "callback_query"] }, 40000);
    } catch (e) {
      if (e.code === 409) {
        console.error("Konflik 409: webhook Vercel aktif lagi ATAU skrip polling lain sedang berjalan (cek jendela lain). Polling dihentikan.");
        process.exit(1);
      }
      console.error("Gagal mengambil pesan:", mask(e.message), "- coba lagi 5 detik");
      await sleep(5000);
      continue;
    }
    for (const u of updates) {
      const who = u.message?.from?.username || u.message?.from?.id || "?";
      const text = (u.message?.text || `[${Object.keys(u.message || {}).find((k) => !["message_id", "from", "chat", "date"].includes(k)) || "?"}]`).slice(0, 60);
      try {
        await forward(u);
        localDownWarned = false;
        offset = u.update_id + 1;
        console.log(`${new Date().toLocaleTimeString("id-ID")}  ${who}: ${text}`);
      } catch (e) {
        if (!localDownWarned) console.error(`Tidak bisa meneruskan ke ${target} (${e.message}). Apakah 'npm run dev' sudah jalan? Mencoba lagi...`);
        localDownWarned = true;
        await sleep(3000);
        break; // ulangi dari update yang sama
      }
    }
    if (once) return;
  }
}

main().catch((e) => {
  console.error(mask(e.message || e));
  process.exit(1);
});
