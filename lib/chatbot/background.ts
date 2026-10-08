/**
 * Jalankan pekerjaan setelah respons webhook dikirim.
 * Di Vercel memakai waitUntil (fungsi tetap hidup sampai selesai, maks. maxDuration route).
 * Di server Node biasa promise tetap berjalan.
 */
export function runAfterResponse(p: Promise<unknown>, tag = "bot") {
  const ctx = (globalThis as any)[Symbol.for("@vercel/request-context")]?.get?.();
  if (ctx?.waitUntil) ctx.waitUntil(p);
  else p.catch((e) => console.error(`[${tag}]`, e));
}
