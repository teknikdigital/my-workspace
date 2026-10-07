# Rule Global Antigravity (salin ke ~/.gemini/GEMINI.md)

Ganti seluruh isi `C:\Users\julia\.gemini\GEMINI.md` dengan blok di bawah, atau tempel di
Antigravity > Customizations > Rules > Global.

```markdown
# Aturan Kerja Stratt (semua project)

## 1. Pemetaan folder ke project My Workspace
| Folder | Nama project |
|---|---|
| D:\Project\myworkspace | My Workspace |
| D:\Project\Rapiuang | RapiUang |
| D:\Rally District | Rally District |
| D:\Biofarma\Digitalisasi\oee tahap 3 | SIAP TPM |
| D:\Biofarma\Digitalisasi\Sparpart System 2 | Warehouse Monitoring |
Nama project harus sama (atau bagian dari) nama project di My Workspace > Work > Projects.
Folder lain: pakai nama folder sebagai nama project.

## 2. Awal sesi
- Bila ada HANDOFF.md di root project, BACA dulu sebelum mengerjakan apa pun.
- Bila belum ada dan saya meminta membuat/mengubah project, buat HANDOFF.md
  dengan format D:\Project\myworkspace\docs\HANDOFF_TEMPLATE.md (isi dari kode yang ada).

## 3. Setiap selesai satu tugas (fitur, bugfix, deploy, dokumentasi, setup project baru)
a. Perbarui HANDOFF.md di root project:
   - Status Fitur, Keputusan Teknis, Masalah Diketahui, Langkah Berikutnya: sesuaikan kondisi terkini.
   - Riwayat Perubahan: tambah 1 baris di paling atas (tanggal hari ini + ringkasan + file utama), simpan maks 30 baris.
   - JANGAN menulis nilai password, API key, token, connection string, atau isi .env. Hanya nama variabel.
b. Catat ke My Workspace (satu perintah, jalankan dari root project):
   node D:\Project\myworkspace\scripts\log-activity.mjs --project "<NAMA PROJECT>" --summary "<ringkasan 1 kalimat, Bahasa Indonesia>" --type <development|bugfix|deployment|documentation|testing|configuration> --files "<file1,file2>" --source antigravity --handoff HANDOFF.md
c. Bila perintah gagal karena My Workspace tidak berjalan, cukup beri tahu saya. Jangan menyalakan My Workspace.

## 4. Larangan
- Jangan menjalankan npm run dev atau npm install di D:\Project\myworkspace.
- Jangan mengubah file di luar folder project yang sedang dikerjakan tanpa izin.
- Jangan commit/push ke git tanpa saya minta.
```
