# Aplikasi Lokal (Launcher localhost)

Fitur **Work > Lokal** di My Workspace untuk menyalakan, mematikan, dan membuka
aplikasi yang ada di laptop, lewat program kecil bernama **My Workspace Agent**.

## Cara kerja

```
My Workspace (localhost:3000 atau Vercel)  --browser-->  Agent 127.0.0.1:4545  -->  npm run dev / dst
```

- Agent hanya listen di `127.0.0.1` (tidak bisa diakses dari jaringan lain).
- Semua aksi wajib token (`agent/.agent-token`), dan hanya untuk origin di `allowedOrigins`.
- Agent hanya menjalankan perintah yang tertulis di `agent/apps.json`. Web tidak bisa mengirim perintah bebas.
- Fitur ini hanya jalan di laptop yang menjalankan agent (dari HP: tidak tersedia).

## Setup pertama (sekali saja)

1. Buka folder `D:\Project\myworkspace\agent`.
2. Double-click **Jalankan-Agent.bat**. Token otomatis tersalin ke clipboard.
3. Buka My Workspace > Work > **Lokal** > **Pengaturan Agent**, tempel token, klik Simpan.
4. (Disarankan) Double-click **Pasang-AutoStart.bat** agar agent aktif setiap login Windows.
5. (Opsional) Double-click **Daftarkan-Tombol-Web.bat** agar tombol **Nyalakan Agent** di halaman Lokal
   bisa menyalakan agent saat agent mati (lewat link `mwagent://start`, tanpa admin).

## File di folder agent

| File | Fungsi |
|---|---|
| `apps.json` | Daftar aplikasi, folder, perintah, port |
| `server.cjs` | Program agent (Node.js, tanpa dependency) |
| `Jalankan-Agent.bat` / `Hentikan-Agent.bat` | Nyalakan / matikan agent (aplikasi yang dinyalakan agent ikut mati) |
| `Pasang-AutoStart.bat` / `Hapus-AutoStart.bat` | Atur auto-start saat login Windows |
| `Lihat-Token.bat` | Salin token ke clipboard |
| `Daftarkan-Tombol-Web.bat` / `Hapus-Tombol-Web.bat` | Daftar / hapus link `mwagent://` untuk tombol Nyalakan Agent |
| `logs/agent.log` | Log agent (dirotasi otomatis di 5 MB) |

## Pembagian port

| Aplikasi | Port | Preview di panel |
|---|---|---|
| My Workspace | 3000 | Tidak (X-Frame-Options DENY), pakai Buka |
| SIAP TPM (oee tahap 3) | 3001 | Tidak (X-Frame-Options DENY), pakai Buka |
| Sparepart / WMS | 3002 | Ya |
| Rally District | 3003 | Ya (NEXT_PUBLIC_SITE_URL di-override ke localhost:3003 oleh agent) |
| Rapiuang API | 3100 | - |
| Rapiuang Web | 5173 | Ya |
| Agent | 4545 | - |

Catatan Rapiuang: `client/vite.config.js` kini membaca `RAPIUANG_API_PORT` (default tetap 3000),
jadi menjalankan Rapiuang secara manual seperti biasa tetap berfungsi.

## Menambah aplikasi baru

Tambahkan blok di `apps.json`, lalu restart agent:

```json
{
  "id": "nama-app",
  "name": "Nama Tampilan",
  "group": "Bio Farma",
  "url": "http://localhost:3003",
  "embeddable": true,
  "autoStart": false,
  "processes": [
    { "name": "web", "cwd": "D:\\Folder\\App", "command": "npm run dev -- -p 3003", "port": 3003 }
  ]
}
```

- `id`: huruf kecil, angka, tanda minus.
- `embeddable`: `false` bila aplikasi memasang header X-Frame-Options (tombol Preview disembunyikan).
- `autoStart`: `true` agar ikut menyala saat agent start.
- Port jangan sama dengan aplikasi lain.

## Menjalankan perintah sekali jalan (actions): npm install, file .bat, build

Tambahkan `actions` di aplikasi pada `apps.json`. Setiap action muncul sebagai tombol di kartu,
dan outputnya tampil di Log (tab terpisah). Contoh menjalankan file .bat:

```json
"actions": [
  { "id": "install", "label": "Install Dependencies", "cwd": "D:\\Folder\\App", "command": "npm install" },
  { "id": "backup", "label": "Backup Data", "cwd": "D:\\Folder\\App", "command": "call Backup.bat",
    "confirm": "Jalankan backup sekarang?" }
]
```

- File .bat dijalankan tanpa jendela. Hindari `pause` di dalam .bat (akan menunggu selamanya).
- `confirm` (opsional) memunculkan konfirmasi sebelum dijalankan.
- Setelah mengubah `apps.json`, klik **Pengaturan Agent > Muat ulang apps.json** (tidak perlu restart agent,
  kecuali mengubah `port`).

## Kirim file ke folder project (_Masuk)

- **Dari chat AI:** klik ikon 📎, pilih file, sebut nama project di pesan (mis. "simpan ke Rally District")
  atau pilih di "Simpan ke". File dikirim langsung browser -> agent, TIDAK lewat Vercel/AI.
  AI hanya menerima nama, ukuran, dan lokasi file.
- **Dari halaman Lokal:** tombol **Kirim File** atau seret (drag & drop) file ke kartu aplikasi.
  Tombol **_Masuk** membuka foldernya di Explorer.
- Tujuan: `<folder>\_Masuk\` (field `folder` per aplikasi di `apps.json`). Tidak pernah menimpa
  (nama sama -> `nama (2).ext`). Batas ukuran: `maxUploadMB` (default 200).
- `_Masuk\.gitignore` dibuat otomatis berisi `*`, jadi isi folder ini tidak ikut ter-commit ke git.
- Hanya bisa dari laptop yang menjalankan agent. Dari HP belum tersedia (rencana Jalur 2: lewat Supabase Storage).

## AI membaca isi file & mengingat faktanya

- Saat file dilampirkan di chat, isinya dibaca **di browser** (PDF berteks, Word .docx, Excel, txt/md/csv).
  Tiap file punya centang **baca** (default aktif) + perkiraan token. Hapus centang bila isi tidak boleh dikirim ke AI.
- Maks 15.000 karakter per file (sisanya dipotong dan diberi tahu).
- AI menyimpan fakta penting (NIB, NPWP, nomor izin, tanggal, alamat, nilai) sebagai **catatan dokumen tersemat**
  (judul `📄 nama-file`, tag `dokumen`) di project tujuan. Catatan ini selalu ikut konteks AI,
  jadi pertanyaan seperti "berapa NIB Rally District?" bisa dijawab kapan saja.
- Isi file di riwayat chat diringkas setelah dibaca, jadi tidak dikirim ulang (hemat token).
- Belum bisa: gambar & PDF hasil scan (perlu OCR), .doc lama, .pptx.

## Pembatas biaya AI

- Tabel `ai_usage` (jalankan `supabase/migrations/20261006000001_ai_usage.sql`) mencatat token tiap pesan.
- Header chat menampilkan pemakaian hari ini. Batas harian: env `AI_DAILY_BUDGET_IDR` (default 5000).
  Bila tercapai, chat AI terkunci sampai 00.00 WIB.
- Env opsional: `AI_USD_IDR` (kurs, default 16500), `AI_PRICE_INPUT_PER_M` & `AI_PRICE_OUTPUT_PER_M` (tarif USD per 1 juta token).
- Riwayat yang dikirim ke AI: 12 pesan terakhir. Jawaban maks 800 token. Maks 4 langkah tool per pesan.

## Setelah My Workspace di-deploy ke Vercel

Tambahkan domain Vercel ke `allowedOrigins` di `apps.json`, contoh:

```json
"allowedOrigins": ["http://localhost:3000", "http://127.0.0.1:3000", "https://myworkspace-anda.vercel.app"]
```

Lalu restart agent. Saat pertama membuka halaman Lokal dari domain Vercel, Chrome/Edge
akan meminta izin "akses jaringan lokal": pilih Izinkan. Gunakan Chrome atau Edge.

## Status

| Status | Arti |
|---|---|
| Berjalan | Dinyalakan agent dan port merespons |
| Berjalan (di luar agent) | Port merespons, tapi dinyalakan manual (log tidak tersedia). Stop tetap bisa |
| Menyalakan... | Proses jalan, port belum merespons (Next.js pertama kali butuh beberapa detik) |
| Error / berhenti | Proses keluar dengan error dalam 10 menit terakhir. Cek tombol Log |
| Mati | Tidak berjalan |
