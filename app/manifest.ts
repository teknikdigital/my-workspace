import type { MetadataRoute } from "next";

/**
 * Manifest PWA: My Workspace bisa di-"Install" (Chrome/Edge desktop) dan "Tambahkan ke layar utama" (Android/iOS).
 * Disajikan di /manifest.webmanifest (dikecualikan dari login di middleware.ts).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Workspace",
    short_name: "Workspace",
    description: "Pusat kendali pekerjaan, project, aplikasi, database, akun, dan catatan pribadi.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#e9f4fa",
    theme_color: "#0e8aa0",
    lang: "id",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "AI Asisten", url: "/ai", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Task", url: "/work/tasks", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
