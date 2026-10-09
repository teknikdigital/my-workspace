/**
 * File ASLI di Supabase Storage (bucket privat "documents", sama dengan menu Personal > Documents).
 * Dipakai bot Telegram: file yang dikirim pengguna disimpan utuh, dan bisa dikirim balik kapan saja
 * walau laptop mati (beda dengan folder _Masuk yang hanya ada di laptop).
 *
 * Rujukan file disimpan di catatan sebagai "File asli: storage:documents/<user_id>/telegram/<nama>".
 * Harus dipanggil di dalam sesi pemilik (withOwner) karena memakai RLS Storage per pengguna.
 */

import { createClient } from "@/lib/supabase/server";

export const STORAGE_PREFIX = "storage:documents/";
export const MAX_STORE_BYTES = 45 * 1024 * 1024;
const STORE_EXT = ["pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "txt", "md", "csv", "png", "jpg", "jpeg", "webp", "zip"];

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  zip: "application/zip",
};

const ext = (name: string) => (String(name).match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();

export function canStore(fileName: string) {
  return STORE_EXT.includes(ext(fileName));
}

/** Nama aman untuk path Storage (tanpa spasi aneh / karakter yang ditolak). */
export function storageSafeName(fileName: string) {
  const e = ext(fileName);
  const base = String(fileName)
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^\w-]+/g, "_") // titik di nama juga diganti: ".." tidak boleh ada di path
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 80);
  return `${base || "file"}${e ? `.${e}` : ""}`;
}

/** "storage:documents/<uid>/telegram/1791_NIB.pdf" -> path di bucket, atau null bila bukan rujukan Storage. */
export function storagePathOf(ref: string | null | undefined): string | null {
  const s = String(ref || "").trim();
  if (!s.startsWith(STORAGE_PREFIX)) return null;
  const p = s.slice(STORAGE_PREFIX.length);
  if (!p || p.includes("..") || p.startsWith("/")) return null;
  return p;
}

/** Nama file untuk dikirim: buang awalan "<timestamp>_". */
export function displayNameOf(path: string) {
  return (path.split("/").pop() || "file").replace(/^\d{10,}_/, "");
}

export type StoreResult = { ok: true; ref: string; id: string | null } | { ok: false; error: string };

export async function saveOriginalToStorage(input: { data: Buffer; fileName: string; title?: string; category?: string }): Promise<StoreResult> {
  if (!canStore(input.fileName)) return { ok: false, error: "Jenis file tidak disimpan" };
  if (input.data.length > MAX_STORE_BYTES) return { ok: false, error: "File lebih dari 45 MB" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tidak terautentikasi" };
  const path = `${user.id}/telegram/${Date.now()}_${storageSafeName(input.fileName)}`;
  const contentType = MIME[ext(input.fileName)] || "application/octet-stream";
  const up = await supabase.storage.from("documents").upload(path, input.data, { contentType, upsert: false });
  if (up.error) return { ok: false, error: up.error.message };
  const { data: row, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title: String(input.title || input.fileName).slice(0, 150),
      file_path: path,
      file_size: input.data.length,
      mime_type: contentType,
      category: input.category || "telegram",
    })
    .select("id")
    .single();
  // file sudah di Storage walau baris gagal; rujukan tetap bisa dipakai untuk kirim balik
  return { ok: true, ref: `${STORAGE_PREFIX}${path}`, id: error ? null : row?.id || null };
}

export type StorageOriginal = { ok: true; data: Buffer; name: string } | { ok: false; reason: string };

export async function readStorageOriginal(ref: string): Promise<StorageOriginal> {
  const path = storagePathOf(ref);
  if (!path) return { ok: false, reason: "Rujukan file tidak valid" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "Tidak terautentikasi" };
  if (!path.startsWith(`${user.id}/`)) return { ok: false, reason: "File bukan milik akun ini" };
  const { data, error } = await supabase.storage.from("documents").download(path);
  if (error || !data) return { ok: false, reason: `File asli tidak bisa diambil dari Documents (${error?.message || "kosong"})` };
  const buf = Buffer.from(await data.arrayBuffer());
  if (buf.length > MAX_STORE_BYTES) return { ok: false, reason: "File asli lebih dari 45 MB" };
  return { ok: true, data: buf, name: displayNameOf(path) };
}
