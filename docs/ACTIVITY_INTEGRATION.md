# Catatan Pekerjaan Harian (Activity)

Semua pekerjaan masuk ke menu **Work > Activity**, terhubung ke project.

## 1. Lewat chat AI My Workspace

Cukup ceritakan:

> Hari ini saya kerjakan RapiUang: fix bug saldo 0 dan deploy ke cPanel, progress 85%. Task "uji Catat Cepat Bersama" sudah selesai. Kemarin rapat kualifikasi HVAC 2 jam.

AI mencatat satu aktivitas per project, menandai task selesai, memperbarui progress, dan memakai tanggal kemarin untuk yang "kemarin".

Pertanyaan laporan:

> Apa saja yang saya kerjakan minggu ini? / Buat laporan harian hari ini.

## 2. Otomatis dari AI coding (Antigravity, Claude Code, Cursor)

### Sekali saja

1. My Workspace > **Work > Settings > Token API** > buat token (mis. "Antigravity"). Salin nilainya (hanya tampil sekali).
2. Simpan token ke file `C:\Users\<nama-anda>\.myworkspace-token` (satu baris, tanpa spasi).
   PowerShell: `Set-Content -NoNewline "$env:USERPROFILE\.myworkspace-token" "TOKEN_ANDA"`
3. Tes:
   ```
   node D:\Project\myworkspace\scripts\log-activity.mjs --project "RapiUang" --summary "Tes koneksi activity" --type other --source manual
   ```
   Harus muncul `Tercatat di My Workspace: ...` dan aktivitas tampil di menu Activity.

### Instruksi untuk Antigravity / Claude Code

Tempel ke rules/instruksi project (mis. `AGENTS.md`, `CLAUDE.md`, atau Rules di Antigravity):

```
Setiap selesai satu tugas (fitur, perbaikan bug, deploy, dokumentasi), catat ke My Workspace dengan:
node D:\Project\myworkspace\scripts\log-activity.mjs --project "<NAMA PROJECT>" --summary "<ringkasan 1 kalimat, Bahasa Indonesia>" --type <development|bugfix|deployment|documentation|testing> --files "<file1,file2>" --source antigravity
Jangan menjalankan npm run dev atau npm install di folder D:\Project\myworkspace.
```

Ganti `<NAMA PROJECT>` sesuai project (RapiUang, SIAP TPM, Rally District, ...). Nama dicocokkan sebagian, tidak harus persis.

Versi lengkap (dengan HANDOFF.md) ada di `docs/ANTIGRAVITY_RULE.md`.

### Handoff project (HANDOFF.md)

Tambahkan `--handoff HANDOFF.md` agar isi HANDOFF.md di root project ikut terkirim. My Workspace menyimpannya
sebagai dokumen project "📚 HANDOFF.md" (diperbarui setiap kirim, bukan ganda). Nilai rahasia (baris .env berisi
KEY/SECRET/TOKEN/PASSWORD, password di URL koneksi, API key, JWT) disamarkan otomatis sebelum disimpan.
AI Asisten membacanya saat ditanya "project X sudah sampai mana" atau saat menyusun instruksi untuk Antigravity.
Format: `docs/HANDOFF_TEMPLATE.md`.

### Catatan

- My Workspace harus berjalan (lokal `http://localhost:3000`, atau set `MW_URL` ke alamat Vercel).
- Token bisa dicabut kapan saja di halaman Token API.
- `source` bebas (huruf kecil, angka, `-`, `_`), mis. `antigravity`, `claude-code`, `git`.
