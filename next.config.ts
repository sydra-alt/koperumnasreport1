import type { NextConfig } from "next";
import path from "node:path";
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
};

// PWA (§2 06-RENCANA-PRESENSI-MOBILE.md) -- @serwist/turbopack DIPILIH,
// bukan @serwist/next yang disebut user secara langsung: proyek ini build
// pakai Turbopack (default Next.js 16), dan @serwist/next perlu webpack
// (plugin bundler, tidak kompatibel). @serwist/turbopack dibuat KHUSUS
// untuk Turbopack lewat Route Handler (app/serwist/[path]/route.ts),
// bukan plugin bundler -- npm run build tetap Turbopack, tidak ada yang
// berubah di luar fitur ini. Dikonfirmasi ke user sebelum dipasang.
export default withSerwist(nextConfig);
