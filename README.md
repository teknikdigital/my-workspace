# My Workspace — Personal Work & Life OS

My Workspace adalah platform sentral untuk mencatat, menghubungkan, dan menelusuri seluruh aset digital, project, database, repository, akun layanan, catatan, dan pekerjaan harian.

---

## Fitur Utama

- **Floating Shell & Modern UI**: TopBar dan BottomNav berbentuk pill kaca melayang (glassmorphism) dengan tipografi Plus Jakarta Sans dan dukungan Dark/Light mode.
- **Prinsip Relasi Many-to-Many**: Satu akun (misal Gmail) dapat digunakan pada banyak project dan database Supabase tanpa batasan 1 email = 1 project.
- **Overview Arsitektur**: Melacak Database, Repository, Deployment, dan Akun terkait langsung dari detail project dan aplikasi.
- **Global Search (`Ctrl + K`)**: Command palette instan dengan grouping per entitas (Projects, Applications, Resources, Accounts, Tasks, Notes) dan keamanan `security_invoker`.
- **Row Level Security (RLS)**: Semua tabel diisolasi secara ketat per user (`user_id = auth.uid()`).
- **Encrypted Vault (Fase 2)**: Penyimpanan rahasia dan kredensial terenkripsi AES-256-GCM dengan audit log & re-autentikasi.
- **Work Intelligence & AI Assistant (Fase 3)**: AI assistant yang memahami konteks relasi workspace, mendukung OpenAI & Claude.
- **Integrations & Structured Activity (Fase 4)**: Penerima aktivitas terstruktur untuk Claude & CI/CD.
- **WhatsApp Webhook & Reminders (Fase 5)**: Interaksi via WhatsApp & pengingat otomatis terjadwal Vercel Cron.

---

## Panduan Menjalankan Secara Lokal

### 1. Prasyarat
- Node.js v18+ atau v20+
- Akun Supabase (project baru)

### 2. Konfigurasi Environment Variable
Salin `.env.example` ke `.env.local`:
```bash
cp .env.example .env.local
```
Isi variabel berikut:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
VAULT_ENCRYPTION_KEY=<32-byte-hex-string>
```

### 3. Menjalankan Database Migration
Jalankan file SQL migrasi di Supabase SQL Editor secara berurutan:
1. `supabase/migrations/20261005000001_phase1_core_workspace.sql`
2. `supabase/migrations/20261005000002_phase2_personal_vault.sql`
3. `supabase/migrations/20261005000003_phase3_work_intelligence.sql`
4. `supabase/migrations/20261005000004_phase4_integrations.sql`
5. `supabase/migrations/20261005000005_phase5_whatsapp_reminders.sql`

### 4. Membuat User Pertama & Seed Data
Registrasi publik dinonaktifkan demi keamanan. Buat user pertama dengan salah satu cara:

**Opsi A: Melalui Supabase Dashboard**
1. Buka Supabase Dashboard → Authentication → Users → **Add user** → *Create new user*.
2. Masukkan email dan password, centang **Auto Confirm User**.
3. Buka SQL Editor dan jalankan:
```sql
SELECT seed_demo_data('<uuid-user-anda>');
```

**Opsi B: Melalui Script CLI**
```bash
npx tsx scripts/create-user.ts nama@domain.com password123 "Nama Anda"
```

### 5. Menjalankan Server Development
```bash
npm run dev
```
Buka browser di `http://localhost:3000`.

---

## Langkah Deploy ke Vercel

1. Push repository ke GitHub / GitLab.
2. Impor project di dashboard Vercel.
3. Tambahkan semua Environment Variable dari `.env.example` di tab **Settings → Environment Variables** di Vercel.
4. Klik **Deploy**.
