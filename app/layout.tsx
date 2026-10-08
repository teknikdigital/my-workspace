import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Workspace — Personal Work & Life OS",
  description: "Pusat kendali pekerjaan, project, aplikasi, database, akun, dan catatan pribadimu.",
  applicationName: "My Workspace",
  // Ikon tab, ikon iPhone & manifest PWA diambil otomatis dari app/favicon.ico, app/icon.png,
  // app/apple-icon.png dan app/manifest.ts (konvensi file Next.js).
  appleWebApp: { capable: true, title: "Workspace", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0e8aa0" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1a20" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning className={plusJakarta.variable}>
      <body className="min-h-screen bg-transparent antialiased selection:bg-teal selection:text-white">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
