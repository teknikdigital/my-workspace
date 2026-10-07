# Aturan Kerja Stratt (semua project)

Berlaku untuk Claude Code di semua folder. Disalin ke `C:\Users\julia\.claude\CLAUDE.md`.

## Pemetaan folder ke project My Workspace
| Folder | Nama project |
|---|---|
| D:\Project\myworkspace | My Workspace |
| D:\Project\Rapiuang | RapiUang |
| D:\Rally District | Rally District |
| D:\Biofarma\Digitalisasi\oee tahap 3 | SIAP TPM |
| D:\Biofarma\Digitalisasi\Sparpart System 2 | Warehouse Monitoring |
Folder lain: pakai nama folder sebagai nama project.

## Awal sesi
- Bila ada HANDOFF.md di root project, baca dulu sebelum mengerjakan apa pun.

## Setiap selesai satu tugas (fitur, bugfix, deploy, dokumentasi, setup project baru)
1. Perbarui HANDOFF.md di root project (buat bila belum ada) dengan bagian: Ringkasan, Lokasi & Stack,
   Cara Menjalankan, Status Fitur, Keputusan Teknis, Masalah Diketahui, Langkah Berikutnya,
   Riwayat Perubahan (1 baris baru paling atas: tanggal + ringkasan + file utama, maksimal 30 baris).
   Jangan pernah menulis nilai password, API key, token, connection string, atau isi .env. Hanya nama variabel.
2. Catat ke My Workspace dari root project:
   node D:\Project\myworkspace\scripts\log-activity.mjs --project "<NAMA PROJECT>" --summary "<ringkasan 1 kalimat, Bahasa Indonesia>" --type <development|bugfix|deployment|documentation|testing|configuration> --files "<file1,file2>" --source claude-code --handoff HANDOFF.md
   Bila gagal karena My Workspace tidak berjalan, cukup beri tahu. Jangan menyalakan My Workspace.
3. PENGECUALIAN: bila instruksi menyebut "dijalankan otomatis oleh My Workspace", JANGAN jalankan langkah 2.
   Agent My Workspace yang mencatat setelah selesai.

## Larangan
- Jangan menjalankan npm run dev atau npm install di D:\Project\myworkspace.
- Jangan commit/push ke git tanpa diminta.
- Jangan membaca atau menampilkan isi file .env.
- Project Bio Farma (folder D:\Biofarma\...): jangan mengubah file tanpa persetujuan eksplisit di sesi itu.
