# AI Workspace lewat Telegram

Chat ke bot Telegram = chat ke AI Asisten My Workspace (tool, data project, Activity, kartu Claude Code).
Riwayat masuk ke percakapan "✈️ Telegram · tanggal" dan bisa dilanjutkan dari halaman AI di web.
Gratis (Telegram Bot API), tanpa verifikasi bisnis. Yang dibayar tetap hanya token AI.

## 1. Buat bot (sekali)
1. Di Telegram buka **@BotFather** > `/newbot`.
2. Nama: mis. `My Workspace`. Username harus diakhiri `bot`, mis. `mw_stratt_bot`.
3. Simpan **token** yang diberikan. Jangan kirim ke chat mana pun.
4. Opsional di BotFather: `/setprivacy` > Enable, `/setjoingroups` > Disable (bot hanya untuk chat pribadi).

## 2. Environment (Vercel > Settings > Environment Variables, dan `.env.local`)
```
TELEGRAM_BOT_TOKEN=<token dari BotFather>
TELEGRAM_WEBHOOK_SECRET=<acak 48 karakter, lihat di bawah>
TELEGRAM_OWNER_ID=<diisi di langkah 4>
MW_OWNER_EMAIL=<email login My Workspace>   # boleh dilewati bila WHATSAPP_OWNER_EMAIL sudah diisi
```
Buat secret: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
Nilai di Vercel dan `.env.local` harus **sama**. Setelah mengubah env di Vercel: **Redeploy**.

## 3. Daftarkan webhook (dari laptop, folder project)
```
node scripts/telegram-webhook.mjs
```
Skrip membaca `.env.local`, memasang webhook ke `https://digitalworkspace.vercel.app/api/telegram`
dengan secret token, dan memasang menu `/baru` `/bantuan`.
- Cek status: `node scripts/telegram-webhook.mjs info`
- Hapus: `node scripts/telegram-webhook.mjs delete`
- Alamat lain: `--url https://domain-lain/api/telegram`

## 3b. Mode lokal (tanpa Vercel, mis. jaringan kantor memblokir Vercel)
Telegram tidak bisa mengirim webhook ke `localhost`, jadi dipakai polling:
```
npm run dev                          # terminal 1
node scripts/telegram-poll.mjs       # terminal 2
```
- Skrip menonaktifkan webhook Vercel selama mode lokal. Kembali ke Vercel: `node scripts/telegram-webhook.mjs`.
- Bot hanya menjawab selama laptop menyala dan kedua terminal berjalan.
- Butuh akses ke `api.telegram.org` (bila diblokir jaringan kantor: pakai hotspot HP).

## 4. Isi TELEGRAM_OWNER_ID
Selama `TELEGRAM_OWNER_ID` kosong, bot hanya membalas ID Telegram pengirim (AI tidak dijalankan).
Kirim pesan apa saja ke bot, salin angka ID yang dibalas, isi `TELEGRAM_OWNER_ID` di Vercel (dan `.env.local`), Redeploy.

## 5. Tes
`/bantuan`, lalu "Apa task saya hari ini?".

## 6. Dokumen
- **Kirim file ke bot** (📎 > File): PDF berteks, Word .docx, Excel, TXT/CSV/MD, maks 20 MB. Isinya dibaca AI seperti
  lampiran di web: fakta penting disimpan, teks utuh disimpan sebagai catatan "📚 nama-file". Ketik keterangan
  (caption) untuk pertanyaan spesifik, mis. "ini NIB Rally District, simpan".
  Foto/scan belum bisa (perlu OCR).
- **Minta dibuatkan dokumen**: "buatkan TOR rapat koordinasi isolator", "buat notulen dari catatan ini".
  Bot mengirim file **Word (.docx)** (A4, nomor halaman). Minta "dalam markdown" untuk file .md.
  Salinannya tersimpan sebagai catatan "📝 judul" di My Workspace.
- **Minta dokumen tersimpan**: "kirim HANDOFF RapiUang", "kirim TOR isolator kemarin" (mencari judul catatan/dokumen).

## 7. Claude Code dari Telegram (antrian)
Contoh: "suruh claude tambah filter kategori di RapiUang". Bot mengirim **kartu** dengan tombol **▶️ Jalankan** / **✖️ Batal**.
Setelah ditekan, instruksi masuk antrian; **agent di laptop** (v1.5.0) memeriksa antrian tiap 10 detik, menjalankan Claude Code,
lalu bot mengirim hasilnya (ringkasan, file yang berubah, biaya). Kartu di halaman AI web ikut diperbarui.

Persiapan (sekali):
1. Jalankan migration `supabase/migrations/20261008000001_claude_jobs.sql` di SQL Editor project **My Workspace**.
2. Token integrasi (sama dengan yang dipakai `log-activity.mjs`) tersimpan di `%USERPROFILE%\.myworkspace-token`.
   Bila belum ada: buat token di My Workspace (Integrasi), simpan isinya di file itu (satu baris).
3. Restart agent (tutup jendela agent, jalankan lagi). Log harus menampilkan
   `[antrian] aktif, memeriksa http://localhost:3000 setiap 10 detik`.
4. Alamat yang diperiksa agent: default `http://localhost:3000` (mode lokal). Setelah pindah ke Vercel, tambahkan di
   `agent/apps.json`: `"queue": { "url": "https://digitalworkspace.vercel.app" }` lalu restart agent.
   Nonaktifkan: `"queue": { "enabled": false }`. Status: `GET http://127.0.0.1:4545/queue` (dengan token agent).

Aturan tetap berlaku: project `claude.mode = "read"` (Bio Farma) tidak bisa diedit, perintah terlarang tetap diblokir,
instruksi berisi rahasia ditolak. Instruksi yang tidak diambil agent dalam 2 jam otomatis kedaluwarsa (tidak dijalankan
diam-diam belakangan). Job berjalan > 75 menit tanpa laporan dianggap gagal.

## Perintah
- `/baru` : mulai percakapan baru (otomatis juga setelah 12 jam tanpa pesan)
- `/bantuan` atau `/start` : contoh perintah

## Keamanan
- Header `X-Telegram-Bot-Api-Secret-Token` wajib sama dengan `TELEGRAM_WEBHOOK_SECRET` (401 bila salah, 503 bila env kosong).
- Hanya chat pribadi dari `TELEGRAM_OWNER_ID` yang dilayani; orang lain & grup diabaikan.
- AI berjalan dengan sesi akun pemilik (RLS sama seperti login web), sama seperti WhatsApp.
- Pesan lebih dari 15 menit dan update ganda diabaikan (tabel `whatsapp_inbound`, kunci `tg:<update_id>`).
- Chat bot Telegram **tidak** end-to-end terenkripsi: jangan kirim password, simpan lewat Vault.
- Claude Code: dari Telegram hanya disiapkan kartunya; dijalankan dari laptop (agent lokal).
- `GET /api/telegram` hanya menampilkan env mana yang sudah terisi (ya/tidak), tanpa nilai.

## Batasan saat ini
- Foto/scan belum bisa dibaca (perlu OCR); .pptx & .doc lama belum didukung.
- Dokumen sangat panjang dibatasi ±60.000 karakter; di Vercel, satu pesan maksimal 60 detik (mode lokal tanpa batas).
- Satu pemilik.

## Arsitektur
- `lib/chatbot/runner.ts` : inti bersama WhatsApp & Telegram (dedupe, percakapan, AI dengan sesi pemilik)
- `lib/chatbot/ownerSession.ts` : sesi Supabase pemilik tanpa browser
- `lib/telegram/{core,api,handler}.ts`, `app/api/telegram/route.ts`
- `scripts/telegram-webhook.mjs` (Vercel), `scripts/telegram-poll.mjs` (lokal)
- Dokumen: `lib/documents/markdownToDocx.ts`, `lib/files/extractServer.ts`, `lib/actions/generatedDocs.ts`, tool `create_document_file` / `get_document_file` (hanya kanal Telegram)
- Antrian Claude: `lib/claudeQueue/*`, `app/api/claude-queue/*`, `agent/queue.cjs`, migration `20261008000001_claude_jobs.sql`
