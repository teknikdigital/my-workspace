# AI Workspace lewat WhatsApp (Meta Cloud API)

Chat ke nomor bot WhatsApp = chat ke AI Asisten My Workspace (tool, data project, Activity, kartu Claude Code).
Riwayat masuk ke percakapan "📱 WhatsApp · tanggal" dan bisa dilanjutkan dari halaman AI di web.

## Biaya
- Balasan dalam 24 jam setelah Anda mengirim pesan = pesan layanan, **gratis** (aturan Meta per-message pricing).
- Yang tetap dibayar: token OpenAI (batas harian `AI_DAILY_BUDGET_IDR` tetap berlaku).

## 1. Siapkan di Meta (sekali)
1. developers.facebook.com > My Apps > Create App > use case WhatsApp (atau tipe Business).
2. WhatsApp > API Setup: catat **Phone number ID** dan **access token**.
   - Uji coba: nomor tes gratis + token sementara (24 jam).
   - Permanen: Business Settings > System users > buat system user (Admin) > Generate token
     dengan izin `whatsapp_business_messaging` dan `whatsapp_business_management`.
3. Di "To", tambahkan nomor WA pribadi Anda sebagai penerima (verifikasi kode).
4. App settings > Basic > **App Secret**.

## 2. Isi `.env.local` (dan nanti Vercel > Environment Variables)
```
WHATSAPP_VERIFY_TOKEN=<teks bebas buatan Anda, mis. mw-verif-8f3k>
WHATSAPP_APP_SECRET=<App Secret>
WHATSAPP_API_TOKEN=<access token>
WHATSAPP_PHONE_NUMBER_ID=<Phone number ID>
WHATSAPP_OWNER_PHONE=62812xxxxxxx      # nomor WA pribadi Anda
WHATSAPP_OWNER_EMAIL=<email login My Workspace>
```
Restart `npm run dev` setelah mengubah `.env.local`.

## 3. Migration
Jalankan `supabase/migrations/20261007000002_whatsapp.sql` di SQL Editor project **My Workspace**
(pencatat id pesan agar pesan yang dikirim ulang Meta tidak diproses dua kali).

## 4. Alamat webhook
Meta hanya mengirim ke HTTPS publik.
- **Sementara (laptop):** Cloudflare quick tunnel
  ```
  winget install Cloudflare.cloudflared
  cloudflared tunnel --url http://localhost:3000
  ```
  Pakai alamat `https://xxxx.trycloudflare.com` yang muncul. Alamat berubah setiap tunnel dijalankan ulang.
- **Permanen:** alamat Vercel, mis. `https://my-workspace.vercel.app`.

Di Meta: WhatsApp > Configuration > Webhook > Edit:
- Callback URL: `https://<alamat>/api/whatsapp`
- Verify token: sama dengan `WHATSAPP_VERIFY_TOKEN`
- Klik Verify and save, lalu di Webhook fields **Subscribe** `messages`.

## 5. Tes
Kirim "bantuan" dari WA pribadi ke nomor bot. Lalu "Apa task saya hari ini?".

## Perintah
- `baru` : mulai percakapan baru (otomatis juga setelah 12 jam tanpa pesan)
- `bantuan` : daftar contoh

## Keamanan
- Tanda tangan `X-Hub-Signature-256` wajib valid (App Secret). Webhook palsu ditolak 401.
- Hanya `WHATSAPP_OWNER_PHONE` yang dilayani; nomor lain diabaikan.
- AI berjalan dengan sesi akun `WHATSAPP_OWNER_EMAIL` (RLS sama seperti login web), dibuat di server
  lewat magic link admin tanpa mengirim email.
- Pesan lebih dari 15 menit (pengiriman ulang setelah server mati) diabaikan.
- Jangan kirim password lewat WA: pesan melewati server Meta. Simpan lewat halaman Vault.
- Claude Code: dari WA hanya disiapkan kartunya; dijalankan dari laptop (agent lokal).

## Batasan saat ini
- Baru pesan teks (foto/dokumen menyusul).
- Token sementara Meta habis 24 jam: untuk pemakaian rutin pakai token System User.
