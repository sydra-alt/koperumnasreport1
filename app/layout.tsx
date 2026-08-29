import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { KopHalaman } from "../components/KopHalaman";
import { Providers } from "../components/Providers";
import "./globals.css";

// SATU keluarga huruf untuk seluruh antarmuka (30 Agustus 2026, 04-CATATAN-
// TEKNIS.md §6) -- dulu dua (Barlow Condensed untuk judul/label + IBM Plex
// Sans untuk isi). Plus Jakarta Sans dipilih user secara eksplisit (dibuat
// untuk konteks Indonesia). --font-display/--font-body TIDAK dipakai lagi
// di sini -- app/tokens.css meng-alias `--display`/`--body` ke `--font-sans`
// yang sama, supaya kode lama yang masih menulis var(--display)/var(--body)
// tidak perlu diubah satu per satu.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Pusat Kontrol Koperumnas Group",
  // display:'standalone' minta app/manifest.ts. appleWebApp membuat iOS
  // memakai ikon+judul ini juga saat "Tambahkan ke Layar Utama" (Safari
  // tidak selalu membaca manifest.json dengan benar, dua jalur ini saling melengkapi).
  appleWebApp: {
    capable: true,
    title: "Koperumnas",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // viewportFit:'cover' WAJIB -- tanpa ini env(safe-area-inset-bottom) di
  // app/globals.css selalu bernilai 0, dan nav bawah akan tertutup home
  // bar iPhone (§2 06-RENCANA-PRESENSI-MOBILE.md).
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  themeColor: "#123A56",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${plusJakartaSans.variable} ${ibmPlexMono.variable}`}
    >
      <body>
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === "development"}>
          <Providers>
            <KopHalaman />
            {children}
          </Providers>
        </SerwistProvider>
      </body>
    </html>
  );
}
