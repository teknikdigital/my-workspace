import React from "react";

/**
 * Kebijakan privasi publik (tanpa login). Dibutuhkan Meta untuk menerbitkan app WhatsApp
 * (Pengaturan aplikasi > Dasar > URL Kebijakan Privasi & URL penghapusan data: /privacy#hapus-data).
 */
export const metadata = { title: "Kebijakan Privasi | My Workspace" };

const CONTACT = "adarmawantanjung@gmail.com";
const UPDATED = "7 Oktober 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-sm leading-relaxed text-ink">
      <h1 className="text-2xl font-bold">Kebijakan Privasi My Workspace</h1>
      <p className="text-mute">Privacy Policy · Diperbarui {UPDATED}</p>

      <h2 className="mt-6 text-lg font-bold">1. Tentang layanan</h2>
      <p>
        My Workspace adalah aplikasi produktivitas pribadi yang dioperasikan oleh Teknik Digital. Asisten WhatsApp
        pada nomor bisnis kami hanya melayani pemilik akun My Workspace yang terdaftar. Pesan dari nomor lain tidak
        diproses dan tidak disimpan.
      </p>

      <h2 className="mt-6 text-lg font-bold">2. Data yang diproses</h2>
      <ul className="ml-5 list-disc">
        <li>Isi pesan WhatsApp yang dikirim pemilik ke nomor bisnis, nomor telepon pengirim, dan waktu pesan.</li>
        <li>Data kerja milik pemilik di My Workspace (project, task, catatan, aktivitas) untuk menjawab pertanyaan.</li>
      </ul>

      <h2 className="mt-6 text-lg font-bold">3. Penggunaan & pihak ketiga</h2>
      <ul className="ml-5 list-disc">
        <li>Pesan diteruskan ke penyedia AI (OpenAI) untuk menyusun jawaban. Kata sandi dan kunci rahasia disamarkan sebelum dikirim.</li>
        <li>Riwayat percakapan disimpan di database Supabase milik pemilik dengan pembatasan akses per pengguna.</li>
        <li>Pesan WhatsApp dikirim dan diterima melalui WhatsApp Business Platform (Meta).</li>
        <li>Data tidak dijual, tidak dipakai untuk iklan, dan tidak dibagikan ke pihak lain di luar layanan di atas.</li>
      </ul>

      <h2 className="mt-6 text-lg font-bold">4. Penyimpanan</h2>
      <p>
        Riwayat percakapan disimpan hingga 180 hari sejak pesan terakhir, kecuali disematkan oleh pemilik. Pemilik
        dapat menghapus percakapan kapan saja dari halaman AI di My Workspace.
      </p>

      <h2 id="hapus-data" className="mt-6 text-lg font-bold">5. Penghapusan data</h2>
      <p>
        Untuk menghapus seluruh data terkait nomor WhatsApp Anda, kirim email ke <a className="text-teal underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>{" "}
        dengan subjek &quot;Hapus data WhatsApp&quot; dan sebutkan nomor Anda. Permintaan diproses paling lambat 30 hari.
      </p>

      <h2 className="mt-6 text-lg font-bold">6. Kontak</h2>
      <p>
        Pertanyaan tentang kebijakan ini: <a className="text-teal underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </main>
  );
}
