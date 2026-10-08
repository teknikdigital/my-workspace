#!/usr/bin/env node
/**
 * Daftarkan / cek / hapus webhook bot Telegram My Workspace.
 * Membaca TELEGRAM_BOT_TOKEN & TELEGRAM_WEBHOOK_SECRET dari .env.local (atau environment).
 *
 *   node scripts/telegram-webhook.mjs            daftarkan webhook + menu perintah, lalu tampilkan status
 *   node scripts/telegram-webhook.mjs info       tampilkan status webhook saja
 *   node scripts/telegram-webhook.mjs delete     hapus webhook
 *   --url https://domain/api/telegram            alamat lain (default https://digitalworkspace.vercel.app/api/telegram)
 *
 * Token tidak pernah dicetak.
 */
import fs from "node:fs";
import path from "node:path";

const DEFAULT_URL = "https://digitalworkspace.vercel.app/api/telegram";

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
const cmd = args.find((a) => !a.startsWith("--")) || "set";
const urlIdx = args.indexOf("--url");
const hookUrl = urlIdx >= 0 ? args[urlIdx + 1] : env("TELEGRAM_WEBHOOK_URL") || DEFAULT_URL;

const token = env("TELEGRAM_BOT_TOKEN");
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN belum ada di .env.local. Jalankan dari folder project (D:\\Project\\myworkspace).");
  process.exit(1);
}

async function call(method, body = {}) {
  const root = (env("TELEGRAM_API_URL") || "https://api.telegram.org").replace(/\/+$/, "");
  const res = await fetch(`${root}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(`${method} gagal: ${j.description || res.status}`);
  return j.result;
}

async function info() {
  const me = await call("getMe");
  const w = await call("getWebhookInfo");
  console.log(`Bot           : @${me.username} (${me.first_name})`);
  console.log(`Webhook       : ${w.url || "(belum ada)"}`);
  console.log(`Antrian       : ${w.pending_update_count ?? 0} update`);
  if (w.last_error_message) {
    const when = w.last_error_date ? new Date(w.last_error_date * 1000).toLocaleString("id-ID") : "";
    console.log(`Error terakhir: ${w.last_error_message} ${when}`);
  } else console.log("Error terakhir: tidak ada");
}

try {
  if (cmd === "info") await info();
  else if (cmd === "delete") {
    await call("deleteWebhook", { drop_pending_updates: true });
    console.log("Webhook dihapus.");
  } else {
    const secret = env("TELEGRAM_WEBHOOK_SECRET");
    if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
      console.error("TELEGRAM_WEBHOOK_SECRET belum diisi / tidak valid (16-256 karakter: huruf, angka, _ atau -).");
      console.error('Buat dengan: node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'hex\'))"');
      process.exit(1);
    }
    await call("setWebhook", {
      url: hookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
      max_connections: 5,
    });
    await call("setMyCommands", {
      commands: [
        { command: "baru", description: "Mulai percakapan baru" },
        { command: "bantuan", description: "Contoh perintah" },
      ],
    });
    console.log(`Webhook terpasang ke ${hookUrl}\n`);
    await info();
  }
} catch (e) {
  console.error(String(e.message || e).replaceAll(token, "***"));
  process.exit(1);
}
