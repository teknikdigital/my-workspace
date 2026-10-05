# My Workspace — Build Spec untuk AI Coding Assistant (Versi Final)

> Dokumen ini adalah instruksi lengkap untuk membangun aplikasi **My Workspace**.
> Kerjakan **per fase**. Jangan membuat semua fitur sekaligus. Mulai dari **Fase 1**, berhenti setelah selesai, lalu tunggu konfirmasi sebelum lanjut.

---

## 0. Cara Kerja yang Diminta

1. Baca seluruh dokumen sebelum menulis kode.
2. Kerjakan hanya fase yang diminta (default: Fase 1).
3. Jika ada keputusan yang tidak tercantum di sini, pilih opsi paling sederhana dan catat asumsinya di `docs/DECISIONS.md`.
4. Setelah tiap fase selesai, tulis ringkasan: file yang dibuat, cara menjalankan, dan apa yang belum dikerjakan.
5. Gunakan TypeScript strict. Tidak ada `any` kecuali benar-benar perlu dan diberi komentar.
6. Semua teks UI dalam **Bahasa Indonesia**. Nama kode, tabel, dan variabel dalam **bahasa Inggris**.

---

## 1. Ringkasan Produk

**My Workspace** adalah *Personal Work & Life OS*: satu tempat untuk menyimpan, menghubungkan, dan mencari semua hal digital milik pengguna.

Masalah yang diselesaikan: pengguna membuat banyak aplikasi (Next.js, Supabase, Apps Script, Google Spreadsheet, GitHub, Vercel) sehingga link, akun, database, repository, password, API key, dan catatan tersebar. Aplikasi ini menjawab pertanyaan seperti:

- Aplikasi X memakai database apa, di akun mana?
- Di mana link Apps Script Editor / spreadsheet / Supabase untuk project Y?
- Apa yang terakhir saya kerjakan di project Z, dan apa berikutnya?

Prinsip inti: **hubungan antar data adalah fitur utama**. Satu email bisa punya banyak project Supabase, jadi jangan pernah mengasumsikan `1 email = 1 project`.

### Area utama

| Area | Isi |
|---|---|
| WORK | Projects, Applications, Tasks, Activity, Resources, Accounts |
| PERSONAL | Notes, Documents, Links, Personal Accounts, Reminders |
| VAULT | Password, API key, token, service role key, recovery code |
| AI | Assistant yang memahami konteks workspace (fase lanjut) |

---

## 2. Tech Stack

- **Framework:** Next.js (App Router) + TypeScript (strict)
- **Styling:** Tailwind CSS
- **Komponen:** shadcn/ui (boleh), ikon `lucide-react`
- **Backend/DB/Auth/Storage:** Supabase (PostgreSQL, Supabase Auth, Row Level Security)
- **Deploy:** Vercel
- **Validasi:** Zod
- **Data fetching:** Server Components + Server Actions. Gunakan `@supabase/ssr` untuk auth berbasis cookie.
- **Command palette:** `cmdk`
- **Tema:** `next-themes` (light, dark, system)
- **Test:** Vitest (unit test untuk Zod schema dan fungsi util). E2E tidak wajib di Fase 1.

Apps Script **bukan** bagian backend. Ia hanya salah satu *tipe aplikasi/resource* yang dicatat.

### Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only, jangan pernah ke client
VAULT_ENCRYPTION_KEY=             # server only, dipakai Fase 2
```

Sediakan `.env.example` tanpa nilai asli.

---

## 3. Desain UI

### 3.1 Prinsip

- Modern, bersih, minimal, profesional. Bukan tampilan admin dashboard lama.
- Banyak whitespace, tipografi jelas, **tidak terlalu banyak card**.
- Tidak memakai emoji sebagai elemen UI utama. Gunakan ikon SVG.
- Warna dipakai sebagai **status**, bukan dekorasi.
- Desktop-first, tetap nyaman di mobile.
- Light dan dark mode.
- Global search dan command palette (`Ctrl/Cmd + K`) adalah elemen penting.

### 3.2 Layout shell (WAJIB, ini identitas visual aplikasi)

Tidak memakai sidebar. Navigasi memakai **top bar melayang** dan **bottom nav melayang**, keduanya berbentuk pill dengan efek kaca.

```text
┌──────────────────────────────────────────────────────────────┐
│ (pill) Logo  My Workspace   [ Cari apa saja…  Ctrl K ]  AR  14:55  Keluar │  ← sticky, top
└──────────────────────────────────────────────────────────────┘

                       konten halaman
              (max-width ±1100px, di tengah)

                ┌────────────────────────────┐
                │ ● Beranda  Work  Personal  Vault  AI │      ← fixed, bottom, di tengah
                └────────────────────────────┘
```

**Top bar**

- Pill penuh (`border-radius: 9999px`), latar `glass`, `backdrop-filter: blur(14px)`, shadow lembut.
- `position: sticky`, offset atas 10px + `env(safe-area-inset-top)`.
- Isi dari kiri: logo, nama app, kolom search (membuka command palette), avatar + nama + role, jam + tanggal, tombol Keluar.
- Mobile: sembunyikan nama user, jam, tombol Keluar, dan hint shortcut. Logo, search, avatar tetap tampil.
- Nama dan role pada top bar berasal dari tabel `profiles` (`display_name`, `role_label`). Jika kosong, pakai bagian email sebelum `@` dan role `Owner`.
- Tombol **Keluar** memanggil server action `signOut` (lihat Fase 1 bagian Auth). Di mobile, sediakan juga akses Keluar lewat menu avatar.

**Bottom nav**

- `position: fixed`, di tengah horizontal, `bottom: max(14px, env(safe-area-inset-bottom))`.
- Pill kaca, 5 item: **Beranda, Work, Personal, Vault, AI**.
- Item aktif: latar gradient teal, teks putih, ikon + label.
- Item tidak aktif: ikon saja di layar < 720px, ikon + label di layar lebih besar.
- Beri `padding-bottom` ≥ 120px pada konten agar tidak tertutup.

**Sub-navigasi di dalam area**

- **Work:** tab/segmented control untuk Projects, Tasks, Activity, Applications, Resources, Accounts.
- **Personal:** Notes, Documents, Links, Accounts, Reminders.
- **Vault:** Secrets (Fase 2).
- Gunakan tab pill di bagian atas konten, bukan sidebar.

### 3.3 Design tokens

Definisikan sebagai CSS variables di `globals.css` dan petakan ke Tailwind.

```css
:root {
  --bg-1: #e9f4fa;
  --bg-2: #fdf3e7;
  --ink: #0f2a33;
  --mute: #5d7580;
  --glass: rgba(255,255,255,.72);
  --card: #ffffff;
  --line: rgba(15,42,51,.08);
  --teal: #0e8aa0;
  --teal-2: #0a6f84;
  --orange: #f08a24;
  --ok: #16a05a;
  --red: #d63a3a;
  --shadow: 0 8px 30px rgba(14,90,110,.10);
}

.dark {
  --bg-1: #0b1a20;
  --bg-2: #1a1410;
  --ink: #e8f3f6;
  --mute: #8fa8b2;
  --glass: rgba(24,42,50,.72);
  --card: #14262e;
  --line: rgba(255,255,255,.08);
  --shadow: 0 8px 30px rgba(0,0,0,.35);
}
```

- **Font:** Plus Jakarta Sans (400/500/600/700/800) via `next/font/google`. Judul halaman 28px/800 dengan letter-spacing −0.02em.
- **Radius:** pill untuk bar dan tombol, 24px untuk panel, 16px untuk tombol aksi besar.
- **Panel penting** (mis. "Lanjutkan bekerja") boleh punya strip gradient teal→orange setinggi 5px di tepi atas. Hanya satu per halaman.
- **Status:** ok = hijau, urgent = merah, high = oranye, medium = teal. Selalu sertakan label teks, jangan hanya warna.
- **Motion:** minimal. Tidak ada animasi masuk di setiap section. Hormati `prefers-reduced-motion`.
- **Aksesibilitas:** fokus keyboard terlihat jelas, kontras cukup, target sentuh ≥ 44px.

### 3.4 Halaman Beranda (referensi mockup)

Urutan dari atas:

1. Greeting (nama dari `profiles.display_name`): `"Selamat pagi/siang/sore/malam, {nama}"` + sub `"Sedang mengerjakan apa hari ini?"`
2. Panel **Lanjutkan bekerja**: project terakhir aktif, aktivitas terakhir, badge status, tombol `"Buka project"`.
3. Ringkasan tiga angka: Project aktif, Task hari ini, Task terlambat. (Kartu Reminder baru ditambahkan di Fase 2 setelah tabel reminders ada.)
4. Dua kolom: **Task hari ini** dan **Aktivitas terbaru** (satu kolom di mobile).

Jangan menambah widget lain di Fase 1.

### 3.5 Halaman Login

Route `/login`, berada di route group `(auth)` sehingga **tidak** menampilkan TopBar maupun BottomNav.

```text
        (latar gradient --bg-1 → --bg-2, sama seperti aplikasi)

              ┌──────────────────────────────┐
              │  (logo gradient teal→orange) │
              │                              │
              │   Masuk ke My Workspace      │
              │   Pusat kendali pekerjaan    │
              │   dan informasi pribadimu.   │
              │                              │
              │   Email                      │
              │   [______________________]   │
              │   Kata sandi                 │
              │   [______________________ ◉]│   ← tombol tampil/sembunyi (ikon SVG)
              │                              │
              │   (pesan error inline)       │
              │   [        Masuk         ]   │   ← gradient teal, penuh, pill/16px
              └──────────────────────────────┘
```

- Panel di tengah layar (vertikal dan horizontal), lebar maksimum 400px, radius 24px, latar `--glass` dengan blur, shadow `--shadow`.
- Tidak ada link Daftar, tidak ada login sosial.
- Tombol **Masuk** menampilkan status loading dan dinonaktifkan selama proses; cegah submit ganda.
- Pesan error tampil di atas tombol dengan `role="alert"` / `aria-live="polite"`.
- Ikuti tema sistem/light/dark yang sama dengan aplikasi (tanpa flash).
- Mobile 375px: panel hampir selebar layar dengan margin 16px, input tinggi minimal 44px.
- Teks UI: judul `Masuk ke My Workspace`, label `Email` dan `Kata sandi`, tombol `Masuk`.

---

## 4. Skema Database (Fase 1)

Semua tabel memiliki `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users`, `created_at`, `updated_at`. **RLS wajib aktif di semua tabel** dengan kebijakan `user_id = auth.uid()`. Pengecualian: `profiles` memakai `user_id` sebagai primary key (tanpa kolom `id` terpisah).

### Tabel inti

```sql
-- enum
create type project_status as enum (
  'planning',
  'development',
  'testing',
  'production',
  'maintenance',
  'archived'
);

create type app_type as enum (
  'nextjs',
  'apps_script',
  'pwa',
  'streamlit',
  'static',
  'backend',
  'other'
);

create type resource_category as enum (
  'github',
  'supabase',
  'vercel',
  'apps_script',
  'google_sheet',
  'google_drive',
  'figma',
  'postman',
  'documentation',
  'production',
  'staging',
  'other'
);

create type task_status as enum (
  'todo',
  'in_progress',
  'done'
);

create type task_priority as enum (
  'low',
  'medium',
  'high',
  'urgent'
);

create type task_source as enum (
  'manual',
  'ai',
  'claude',
  'whatsapp',
  'activity'
);

create type note_scope as enum (
  'personal',
  'work',
  'project'
);

projects(
  name text not null,
  description text,
  status project_status default 'planning',
  progress int default 0 check (progress between 0 and 100),
  category text,
  tech_stack text[] default '{}',
  last_opened_at timestamptz
)

applications(
  project_id uuid references projects on delete cascade,
  name text not null,
  type app_type default 'other',
  framework text,
  production_url text,
  staging_url text,
  status project_status default 'development'
)

services(
  name text not null,
  slug text
)
-- Google, GitHub, Supabase, Vercel, Figma, dst.

accounts(
  service_id uuid references services,
  label text not null,
  -- mis. "Gmail utama"
  identifier text not null,
  -- email / username
  notes text,
  is_personal boolean default false
)

resources(
  title text not null,
  url text not null,
  category resource_category default 'other',
  account_id uuid references accounts,
  notes text
)

tasks(
  title text not null,
  description text,
  status task_status default 'todo',
  priority task_priority default 'medium',
  due_date date,
  project_id uuid references projects,
  application_id uuid references applications,
  source task_source default 'manual',
  completed_at timestamptz
)

notes(
  title text,
  body text,
  scope note_scope default 'work'
)

activity_logs(
  project_id uuid references projects on delete set null,
  summary text not null,
  source text not null default 'manual'   -- manual | seed (Fase 3 menambah claude, github, whatsapp, ai)
)

profiles(
  user_id uuid primary key references auth.users on delete cascade,
  display_name text,
  role_label text default 'Owner',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
-- RLS profiles: select/update hanya jika user_id = auth.uid()
```

### Tabel relasi many-to-many

Komposit PK, plus `user_id`.

```text
project_accounts(project_id, account_id)

project_resources(project_id, resource_id, role text)

application_resources(application_id, resource_id, role text)

application_accounts(application_id, account_id)

note_links(
  note_id,
  entity_type text,
  entity_id uuid
)
-- tautkan note ke project/application/task/account/resource
```

### Catatan desain

- Satu resource bisa dipakai banyak project, jadi **jangan** taruh `project_id` langsung di `resources`.
- Relasi database sebuah application dicatat sebagai `application_resources` dengan resource berkategori `supabase` atau `google_sheet`.
- Kolom `role` pada `project_resources` dan `application_resources` (sudah tercantum di atas) berisi salah satu nilai berikut (gunakan `check` constraint, boleh kosong):
  - `database`
  - `repository`
  - `deployment`
  - `legacy`
  - `other`
- Dengan demikian sistem bisa menjawab:
  - aplikasi ini menggunakan database apa?
  - database tersebut berada di akun mana?
  - repository-nya apa?
  - deployment-nya di mana?
- Buat index pada semua FK dan `(user_id, created_at)`.
- Trigger `handle_new_user`: setiap ada baris baru di `auth.users`, otomatis buat baris `profiles` (`display_name` = bagian email sebelum `@`).
- Trigger `updated_at` generik.
- Semua tabel mewajibkan `user_id`, jadi **seed tidak boleh dijalankan otomatis saat migrasi**. Sediakan `supabase/seed.sql` yang berisi fungsi `seed_demo_data(target_user uuid)`, dijalankan manual **setelah user pertama dibuat**, misalnya: `select seed_demo_data('<uuid-user>');`. Fungsi ini idempotent (aman dijalankan ulang) dan berisi data contoh:
  - Warehouse Monitoring
  - Energy Power Meter
  - Finance App
  - beberapa akun
  - resource
  - task

### Global Search

Buat **view** `search_index` dengan opsi `security_invoker = true` (**WAJIB**, agar RLS tabel sumber tetap berlaku; tanpa opsi ini view berjalan dengan hak pemilik dan dapat membocorkan data user lain) yang meng-UNION kolom teks dari:

- projects
- applications
- resources
- accounts
- tasks
- notes

Dengan kolom seragam:

```text
entity_type
entity_id
title
subtitle
url_path
search_vector tsvector
```

Gunakan:

```sql
to_tsvector('simple', ...)
```

ditambah:

```sql
pg_trgm
```

untuk pencarian parsial/typo ringan.

Buat fungsi RPC:

```text
search_workspace(q text)
```

yang mengembalikan hasil dikelompokkan berdasarkan `entity_type`, maksimal 5 per grup.

Fungsi harus `security invoker` dan tetap memfilter `user_id = auth.uid()` secara eksplisit sebagai lapisan kedua. Tambahkan test yang memastikan user B tidak mendapat hasil milik user A.

**Jangan** memasukkan nilai secret ke index mana pun. Berlaku penuh ketika Vault dibuat pada Fase 2; search hanya boleh mengetahui metadata secret.

---

## 5. Struktur Folder

```text
app/
  (auth)/
    layout.tsx
    # tanpa TopBar/BottomNav
    login/
      page.tsx
      LoginForm.tsx
      actions.ts
      # server action signIn

  (app)/
    layout.tsx
    # TopBar + BottomNav + providers

    page.tsx
    # Beranda

    work/
      layout.tsx
      # tab sub-nav

      projects/
        page.tsx
        [id]/
          page.tsx

      tasks/
        page.tsx

      applications/
        page.tsx

      resources/
        page.tsx

      accounts/
        page.tsx

    personal/
      notes/
        page.tsx
      ...

    vault/
      # Fase 2

components/
  shell/
    TopBar.tsx
    BottomNav.tsx
    CommandPalette.tsx

  ui/
    # shadcn

lib/
  supabase/
    client.ts
    server.ts
    middleware.ts

  validators/
    # Zod schema per entitas

  actions/
    # server actions per entitas
    auth.ts
    # signOut

supabase/
  migrations/
  seed.sql

docs/
  DECISIONS.md
```

`middleware.ts` (di root project) memakai helper `lib/supabase/middleware.ts` untuk me-refresh sesi dan melindungi semua route kecuali `/login` (lihat Fase 1 bagian Auth).

Tambahan file: `scripts/create-user.ts` (opsional, dijalankan lokal) untuk membuat user pertama.

---

# 6. FASE 1 — Core Workspace

**Kerjakan ini dulu.**

## Ruang Lingkup

### 1. Setup

- Project Next.js
- Tailwind
- shadcn
- Font
- Tema light/dark
- `.env.example`

### 2. Auth (Login)

Metode: **Email + Kata sandi** lewat Supabase Auth. Tidak ada OAuth, magic link, atau 2FA di Fase 1.

**Halaman login**

- Route `/login`, tampilan sesuai bagian 3.5.
- Form memakai Server Action `signIn` (`app/(auth)/login/actions.ts`).
- Validasi input dengan Zod: email valid, kata sandi tidak kosong.
- Panggil `supabase.auth.signInWithPassword`.
- Jika berhasil: redirect ke parameter `next` jika ada, selain itu ke `/`.
- Jika gagal: tampilkan pesan generik `Email atau kata sandi salah.` Jangan membedakan "email tidak terdaftar" dan "kata sandi salah".
- Jika Supabase mengembalikan rate limit (HTTP 429): tampilkan `Terlalu banyak percobaan. Coba lagi beberapa menit lagi.`
- Jangan pernah log kata sandi, dan jangan kembalikan kata sandi ke client dalam bentuk apa pun.
- Input: `autocomplete="email"` dan `autocomplete="current-password"`, fokus awal di kolom email, Enter untuk submit.

**Parameter `next` (cegah open redirect)**

- Hanya terima path relatif yang diawali satu `/` dan tidak diawali `//` atau mengandung skema (`http:`, `https:`, `javascript:`).
- Jika tidak valid, abaikan dan arahkan ke `/`.

**Logout**

- Server action `signOut` (`lib/actions/auth.ts`): panggil `supabase.auth.signOut()` lalu redirect ke `/login`.
- Dipanggil dari tombol **Keluar** di TopBar.

**Middleware (`middleware.ts`)**

- Gunakan pola `@supabase/ssr`: buat server client dari cookie request, refresh sesi, tulis cookie kembali ke response.
- Gunakan `supabase.auth.getUser()` untuk menentukan status login, **bukan** `getSession()` (karena `getSession` tidak memvalidasi token ke server).
- Belum login dan mengakses route selain `/login`: redirect ke `/login?next=<path asal>`.
- Sudah login dan membuka `/login`: redirect ke `/`.
- `matcher` mengecualikan `_next/static`, `_next/image`, `favicon.ico`, dan file aset gambar/font.

**Pertahanan berlapis**

- `app/(app)/layout.tsx` juga memanggil `getUser()` di server dan `redirect('/login')` jika tidak ada user, sehingga proteksi tidak hanya bergantung pada middleware.
- Setiap server action data memverifikasi user sebelum query. RLS tetap menjadi lapisan terakhir.

**Registrasi dinonaktifkan** karena ini aplikasi pribadi:

- Tidak ada halaman atau route daftar.
- Nonaktifkan signup di Supabase: Dashboard → Authentication → Sign In / Providers → Email → matikan *Allow new users to sign up*. Untuk Supabase lokal, set `enable_signup = false` pada bagian `[auth]` di `supabase/config.toml`.

**Cara membuat user pertama (wajib didokumentasikan di README)**

1. Buka Supabase Dashboard → Authentication → Users → **Add user** → *Create new user*.
2. Isi email dan kata sandi, centang *Auto Confirm User*.
3. Trigger `handle_new_user` otomatis membuat baris `profiles`. Ubah `display_name` jika perlu.
4. Jalankan `select seed_demo_data('<uuid-user>');` untuk data contoh (opsional).
5. Alternatif: `scripts/create-user.ts` yang memakai `SUPABASE_SERVICE_ROLE_KEY` dari `.env.local` dan hanya dijalankan lokal.

Untuk menguji RLS (kriteria selesai), buat **user kedua** dengan cara yang sama.

**Lupa kata sandi:** tidak ada di Fase 1. Reset dilakukan lewat Supabase Dashboard.

### 3. Shell

Implementasikan:

- TopBar
- BottomNav
- CommandPalette

Sesuai bagian 3.2.

### 4. Database

Implementasikan:

- Migration
- RLS
- Seed

Sesuai bagian 4.

### 5. Beranda

Beranda menggunakan data nyata dari database.

Sesuai bagian 3.4.

### 6. Projects

Buat:

- daftar project
- filter status
- pencarian
- halaman detail project

Tab project:

```text
Overview
Resources
Applications
Accounts
Tasks
Notes
```

Tombol:

```text
Quick Access
```

menampilkan resource project sebagai tautan yang bisa diklik.

CRUD:

- Create
- Edit
- Delete

Setiap kali halaman detail project dibuka, perbarui `projects.last_opened_at = now()` (di server). Kolom ini dipakai panel **Lanjutkan bekerja** di Beranda.

### 7. Applications

CRUD aplikasi.

Dari detail aplikasi, tampilkan:

- Database
- Repository
- Deployment
- Account terkait

### 8. Resources

CRUD resource.

Filter berdasarkan kategori.

Resource dapat ditautkan ke:

- Project
- Application
- Account

Contoh resource:

```text
GitHub
Supabase
Vercel
Apps Script
Google Spreadsheet
Google Drive
Figma
Postman
Production
Staging
Documentation
```

### 9. Accounts

CRUD account.

Kelompokkan berdasarkan service.

Contoh:

```text
Google
GitHub
Supabase
Vercel
Figma
```

Tampilkan project apa saja yang menggunakan account tersebut.

**Penting:**

Satu account/email dapat digunakan oleh banyak project.

Jangan membuat struktur:

```text
email → 1 project
```

Gunakan:

```text
Account
├── Project A
├── Project B
├── Project C
└── Project D
```

### 10. Tasks

CRUD task.

Kelompok:

```text
Hari ini
Mendatang
Terlambat
Selesai
```

Task memiliki:

- priority
- status
- due date
- project
- application
- source

### 11. Notes

CRUD notes.

Scope:

```text
personal
work
project
```

Note dapat ditautkan ke:

- Project
- Application
- Task
- Account
- Resource

### 12. Global Search

Command palette memanggil:

```text
search_workspace
```

Hasil dikelompokkan berdasarkan entity.

Contoh:

```text
Projects
  Warehouse Monitoring

Applications
  Warehouse Web App

Resources
  Supabase Warehouse
  GitHub Warehouse
  Apps Script Warehouse

Accounts
  Gmail Development

Tasks
  Perbaiki RLS inventory

Notes
  Struktur database warehouse
```

Tekan Enter untuk membuka halaman terkait.

Gunakan debounce:

```text
150ms
```

---

## Di luar Lingkup Fase 1

**Jangan dikerjakan pada Fase 1:**

- Vault
- Secrets
- Encryption
- Documents/upload
- AI Assistant
- Integrasi GitHub
- Integrasi Google
- Integrasi Vercel
- Integrasi Supabase API
- Integrasi Claude
- Integrasi WhatsApp
- Activity log otomatis
- Reminder terjadwal
- Login sosial/OAuth, magic link, 2FA, dan fitur lupa kata sandi

### Activity pada Fase 1

Activity hanya berupa placeholder halaman dan kartu **Aktivitas terbaru** di Beranda.

Gunakan tabel sederhana:

```text
activity_logs
```

dengan field:

```text
project_id
summary
source
created_at
```

Activity dapat diisi:

- manual
- seed

Pencatatan otomatis baru dibuat pada Fase 3.

---

# Kriteria Selesai Fase 1

- [ ] `npm run build` lulus tanpa error.
- [ ] `npm run lint` lulus tanpa error.
- [ ] `npm run test` lulus tanpa error.
- [ ] Pengguna yang belum login tidak bisa mengakses halaman mana pun selain `/login`.
- [ ] Login dengan kredensial benar membuka Beranda; kredensial salah menampilkan pesan generik tanpa membocorkan penyebab.
- [ ] Membuka `/work/projects` tanpa login diarahkan ke `/login?next=/work/projects`, dan setelah login kembali ke halaman tersebut.
- [ ] `/login?next=https://contoh.com` dan `/login?next=//contoh.com` diabaikan; setelah login diarahkan ke `/`.
- [ ] Pengguna yang sudah login dan membuka `/login` diarahkan ke `/`.
- [ ] Tombol Keluar menghapus sesi, mengarahkan ke `/login`, dan tombol Back browser tidak menampilkan data aplikasi.
- [ ] Tidak ada route atau halaman daftar; signup nonaktif di Supabase.
- [ ] Halaman login tampil benar di desktop dan 375px, light dan dark, tanpa TopBar/BottomNav.
- [ ] Nama dan role di TopBar serta greeting di Beranda berasal dari `profiles`.
- [ ] `search_index` memakai `security_invoker = true`; user B tidak melihat hasil search milik user A.
- [ ] `seed_demo_data(uuid)` dapat dijalankan setelah user pertama dibuat dan aman dijalankan ulang.
- [ ] Pengguna A tidak bisa membaca atau mengubah data pengguna B.
- [ ] Pengujian dilakukan menggunakan minimal 2 akun (user kedua dibuat lewat Supabase Dashboard karena registrasi dinonaktifkan).
- [ ] Top bar tampil dengan benar di desktop.
- [ ] Top bar tampil dengan benar di mobile.
- [ ] Bottom nav tampil dengan benar di desktop.
- [ ] Bottom nav tampil dengan benar di mobile lebar 375px.
- [ ] Dark mode bekerja.
- [ ] Light mode bekerja.
- [ ] Tidak ada flash tema saat load.
- [ ] `Ctrl/Cmd + K` membuka command palette.
- [ ] Mengetik `"warehouse"` menampilkan project terkait.
- [ ] Mengetik `"warehouse"` menampilkan application terkait.
- [ ] Mengetik `"warehouse"` menampilkan resource terkait.
- [ ] Mengetik `"warehouse"` menampilkan account terkait.
- [ ] Mengetik `"warehouse"` menampilkan task terkait.
- [ ] Mengetik `"warehouse"` menampilkan note terkait.
- [ ] Dari halaman project dapat dijawab:
  - [ ] database apa yang digunakan
  - [ ] akun mana yang digunakan
  - [ ] link dashboard/database
  - [ ] repository
  - [ ] deployment
- [ ] Satu account bisa dikaitkan ke banyak project.
- [ ] Satu account bisa memiliki banyak resource Supabase tanpa konflik.
- [ ] Setiap halaman daftar memiliki empty state.
- [ ] Empty state memberikan arahan tindakan.
- [ ] Empty state tidak hanya menampilkan `"Tidak ada data"`.
- [ ] README berisi langkah setup lokal.
- [ ] README berisi langkah deploy ke Vercel.

---

# 7. Fase Berikutnya

> Bagian ini hanya sebagai konteks. **Jangan dikerjakan sebelum Fase 1 selesai dan dikonfirmasi.**

---

## Fase 2 — Personal & Vault

### Personal Area

Tambahkan:

- Documents
- Links
- Personal Accounts
- Reminders
- Personal Information
- Personal Notes

Personal harus memiliki pemisahan visual yang jelas dari Work.

Contoh:

```text
WORK
```

dan

```text
PERSONAL
```

dengan aksen visual yang berbeda.

### Vault

Buat tabel:

```text
credentials
```

untuk menyimpan:

- Password
- API Key
- Supabase Key
- Service Role Key
- Access Token
- Recovery Code
- Secret

Nilai credential harus terenkripsi.

Pilihan implementasi:

```text
AES-256-GCM
```

di server atau:

```text
pgcrypto
```

Kunci berasal dari:

```env
VAULT_ENCRYPTION_KEY
```

Kunci:

- server only
- tidak pernah dikirim ke client
- tidak pernah dimasukkan ke browser
- tidak pernah dimasukkan ke log

### Reveal

Nilai secret disembunyikan secara default.

Aksi:

```text
Reveal
Copy
```

memanggil server action.

Server mengembalikan nilai hanya ketika diperlukan.

Setiap akses dicatat pada:

```text
vault_audit_logs
```

Field:

```text
user_id
created_at
action
credential_id
```

**Jangan pernah menyimpan nilai credential pada audit log.**

### Re-authentication

Untuk credential sangat sensitif, gunakan re-authentication menggunakan:

- password
- atau PIN

sebelum Reveal.

### Secret Search

Secret tidak boleh muncul:

- dalam global search
- activity log
- server log
- error message

Search hanya boleh mengetahui metadata.

### Documents

Upload dokumen menggunakan:

```text
Supabase Storage
```

Bucket:

```text
private
```

Gunakan:

```text
signed URL
```

---

# Fase 3 — Work Intelligence

## Activity / Work Log

Activity dibuat lebih terstruktur.

Field:

```text
project_id
application_id
task_id
type
summary
files_changed
status
source
created_at
```

Contoh:

```text
Project:
Warehouse Monitoring

Activity:
Memperbaiki RLS pada tabel inventory.

Source:
Claude

Files Changed:
inventory.sql
```

### AI Context

Setiap project memiliki:

```text
AI Context
```

AI Context memahami:

```text
Project
↓
Application
↓
Resource
↓
Account
↓
Task
↓
Activity
↓
Note
```

Tujuannya agar AI tidak hanya mencari teks, tetapi memahami hubungan antar data.

### AI Assistant

AI dapat menggunakan:

- OpenAI API
- Claude API

dengan akses terbatas ke workspace pengguna.

AI dapat:

- mencari resource
- mencari project
- mencari application
- mencari account
- melihat task hari ini
- meringkas activity
- membuat task
- membuat note
- membantu menentukan pekerjaan berikutnya

Contoh:

```text
Apa terakhir yang saya kerjakan di Warehouse Monitoring?
```

```text
Resource Supabase Warehouse ada di mana?
```

```text
Apa task saya hari ini?
```

```text
Buat task untuk memperbaiki RLS inventory besok.
```

---

# Fase 4 — Integrasi

Tambahkan integrasi:

```text
GitHub
Vercel
Supabase
Google
```

Integrasi digunakan untuk mengambil metadata, bukan menjadikan layanan tersebut sebagai database utama.

### Claude Integration

Claude dapat mengirim:

```text
structured activity
```

bukan seluruh percakapan.

Contoh:

```json
{
  "project": "Warehouse Monitoring",
  "activity_type": "development",
  "summary": "Memperbaiki RLS inventory",
  "files_changed": [
    "inventory.sql"
  ],
  "status": "completed",
  "source": "claude"
}
```

Dengan demikian My Workspace mengetahui apa yang dikerjakan tanpa harus menyimpan seluruh chat Claude.

---

# Fase 5 — WhatsApp

WhatsApp menjadi **interface**, bukan database utama.

Flow:

```text
WhatsApp
    ↓
Webhook
    ↓
My Workspace
    ↓
Task / Note / Reminder / Query
```

Endpoint:

```text
/api/whatsapp
```

Contoh command:

```text
Ingatkan saya jam 8 malam cek Supabase Warehouse.
```

```text
Apa task saya hari ini?
```

```text
Buat task memperbaiki RLS Warehouse besok.
```

```text
Catat note bahwa database Warehouse memakai Supabase project X.
```

```text
Di mana link Supabase Warehouse?
```

Pengingat terjadwal menggunakan:

```text
Vercel Cron
```

Database utama tetap:

```text
My Workspace
```

WhatsApp hanya menjadi interface tambahan.

---

# 8. Aturan Keamanan

Aturan ini berlaku **sejak Fase 1**.

### RLS

RLS wajib aktif pada setiap tabel.

Tidak boleh ada tabel aplikasi tanpa policy.

Policy dasar:

```sql
user_id = auth.uid()
```

### Service Role Key

```env
SUPABASE_SERVICE_ROLE_KEY
```

hanya boleh digunakan pada:

```text
server
```

Tidak boleh:

- di client component
- di browser
- di public environment variable
- dikirim ke frontend

### Validation

Semua input dari server action wajib divalidasi menggunakan:

```text
Zod
```

### URL

URL resource hanya menerima:

```text
http
https
```

Saat membuka link:

```html
rel="noopener noreferrer"
```

### Sensitive Data

Jangan log:

- password
- API key
- access token
- service role key
- secret
- credential value

### Security Headers

Tambahkan security headers dasar pada:

```text
next.config
```

---

# 9. Prinsip Arsitektur Utama

My Workspace **bukan sekadar**:

```text
Password Manager
+
Bookmark Manager
+
Notes
+
Task Manager
```

Inti aplikasi adalah:

```text
Personal Work & Life OS
```

Hubungan antar data merupakan fitur utama.

Struktur hubungan:

```text
Project
    ↓
Application
    ↓
Resource
    ↓
Account
    ↓
Task
    ↓
Activity
    ↓
Note
    ↓
AI Context
```

Satu project dapat memiliki banyak application.

```text
Warehouse Monitoring
│
├── Main Web App
├── Apps Script Legacy
└── Google Spreadsheet System
```

Satu account dapat digunakan banyak project.

```text
Gmail Development
│
├── Warehouse Monitoring
├── Energy Power Meter
├── Finance App
└── Project X
```

Satu resource juga dapat digunakan banyak project.

```text
Supabase Account
│
├── Warehouse DB
├── Energy DB
└── Finance DB
```

Jangan membuat asumsi:

```text
1 Email = 1 Project
```

Gunakan relasi many-to-many.

---

# 10. Prinsip AI Context

AI tidak boleh hanya melihat data sebagai daftar terpisah.

Contoh ketika pengguna bertanya:

```text
Database Warehouse Monitoring apa?
```

AI harus dapat mengikuti hubungan:

```text
Warehouse Monitoring
        ↓
Main Web App
        ↓
Resource
        ↓
Supabase
        ↓
Account
        ↓
Gmail Development
```

Sehingga jawaban dapat berupa:

```text
Warehouse Monitoring menggunakan Supabase sebagai database.

Project tersebut terkait dengan:
- Supabase Dashboard
- GitHub Repository
- Vercel Deployment
- Gmail Development

Akun Supabase:
Gmail Development
```

AI Context menjadi lapisan yang menghubungkan seluruh workspace.

---

# 11. Prinsip Pengembangan

Jangan membangun semua fitur sekaligus.

Urutan wajib:

```text
FASE 1
Core Workspace
    ↓
FASE 2
Personal + Vault
    ↓
FASE 3
Work Intelligence + AI
    ↓
FASE 4
Integrations
    ↓
FASE 5
WhatsApp
```

Setelah setiap fase:

1. Jalankan test (`npm run test`).
2. Jalankan lint.
3. Jalankan build.
4. Periksa security.
5. Periksa responsive.
6. Tulis ringkasan perubahan.
7. Tulis fitur yang belum dibuat.
8. **Berhenti dan tunggu konfirmasi pengguna.**

Jangan otomatis melanjutkan ke fase berikutnya.

---

# 12. Keputusan Default

Jika pengguna belum memberikan keputusan tertentu, gunakan:

```text
App Name:
My Workspace

Framework:
Next.js

Language:
TypeScript

Database:
Supabase PostgreSQL

Authentication:
Supabase Auth

Deployment:
Vercel

UI:
Tailwind CSS + shadcn/ui

Font:
Plus Jakarta Sans

Theme:
Light + Dark

Navigation:
Floating Top Bar + Floating Bottom Navigation

Primary Areas:
Beranda
Work
Personal
Vault
AI

Registration:
Disabled

Login:
Email + Password (Supabase Auth), tanpa OAuth/2FA/lupa password di Fase 1

Default User:
Single User

PWA:
Belum pada Fase 1
```

---

# 13. Hal yang Perlu Dikonfirmasi ke Pemilik Sebelum Mulai

1. Apakah aplikasi hanya untuk **satu pengguna**?

   Asumsi default: **ya**.

   Namun RLS tetap berbasis:

   ```text
   user_id
   ```

   agar struktur siap dikembangkan menjadi multi-user.

2. Nama final aplikasi dan logo?

   Default:

   ```text
   My Workspace
   ```

   Logo placeholder:

   ```text
   gradient teal → orange
   ```

3. Apakah ingin PWA sehingga bisa di-install di HP?

   Default:

   ```text
   belum
   ```

   PWA dapat ditambahkan setelah Fase 1.

Jika tidak ada jawaban, lanjutkan dengan asumsi default dan catat keputusan tersebut di:

```text
docs/DECISIONS.md
```

---

# 14. Final Instruction untuk AI Coding Assistant

**Baca seluruh dokumen ini sebelum mulai coding.**

Untuk permintaan pertama:

```text
Implementasikan Fase 1.
```

AI hanya boleh mengerjakan:

```text
Core Workspace
```

dengan fitur:

```text
Authentication (Login/Logout)
Shell
Dashboard
Projects
Applications
Resources
Accounts
Tasks
Notes
Activity Placeholder
Global Search
RLS
Database
Seed
Dark/Light Mode
Responsive UI
```

AI **tidak boleh** mengimplementasikan:

```text
Vault
Secrets
Encryption
AI Assistant
Claude Integration
GitHub Integration
Google Integration
Vercel Integration
WhatsApp
Automatic Activity Tracking
Scheduled Reminder
```

sebelum pengguna memberikan konfirmasi untuk fase berikutnya.

Setelah Fase 1 selesai, AI wajib memberikan:

```text
1. Ringkasan implementasi
2. File yang dibuat
3. File yang diubah
4. Database migration
5. RLS policy
6. Cara menjalankan lokal
7. Cara membuat user pertama
8. Cara deploy ke Vercel
9. Hasil build
10. Hasil lint
11. Fitur yang belum dikerjakan
```

Kemudian:

```text
BERHENTI.
Tunggu konfirmasi pengguna.
```

Jangan melanjutkan ke Fase 2 secara otomatis.