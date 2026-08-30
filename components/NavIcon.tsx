/**
 * Ikon nav bawah (mobile) -- SVG tulis tangan, bukan library ikon (CLAUDE.md
 * §2: "jangan pasang library ikon berat"). Satu warna (`currentColor`),
 * garis tipis konsisten -- sengaja simpel, bukan ilustrasi, supaya nav
 * bawah tidak "terasa cuma tulisan" di HP (keluhan user, 30 Agustus 2026)
 * tanpa menambah dependensi baru.
 */

import type { ReactNode } from 'react';

const gaya = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

const IKON: Record<string, ReactNode> = {
  beranda: (
    <path d="M4 11.5 12 4l8 7.5M6 10v9h5v-5h2v5h5v-9" style={gaya} />
  ),
  absen: (
    <>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" style={gaya} />
      <circle cx="12" cy="12" r="6" style={gaya} />
      <path d="m9.5 12 1.8 1.8L15 10" style={gaya} />
    </>
  ),
  riwayat: (
    <>
      <path d="M4 4v5h5" style={gaya} />
      <path d="M4.6 15a8 8 0 1 0 1.6-8.4L4 9" style={gaya} />
      <path d="M12 8v4.5l3 2" style={gaya} />
    </>
  ),
  lapor: (
    <path d="M6 3h9l4 4v14H6zM15 3v4h4M9 12h6M9 15.5h6M9 8.5h3" style={gaya} />
  ),
  papan: (
    <path d="M4 4h16v16H4zM4 10h16M10 10v10" style={gaya} />
  ),
  keputusan: (
    <>
      <circle cx="12" cy="12" r="9" style={gaya} />
      <path d="m8 12.5 2.5 2.5L16 9.5" style={gaya} />
    </>
  ),
  marketing: (
    <path d="M4 18V13M9 18V9M14 18V5M19 18v-6" style={gaya} />
  ),
  terpusat: (
    <path d="M5 21V6l7-3 7 3v15M9 21v-5h6v5M9 11h1M14 11h1M9 15h1M14 15h1" style={gaya} />
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="2.6" style={gaya} />
      <path d="M12 3.5v2M12 18.5v2M4.6 6.6l1.4 1.4M18 16l1.4 1.4M3.5 12h2M18.5 12h2M4.6 17.4 6 16M18 8l1.4-1.4" style={gaya} />
    </>
  ),
  akun: (
    <>
      <circle cx="12" cy="8.3" r="3.3" style={gaya} />
      <path d="M5 20c1-4 4-6 7-6s6 2 7 6" style={gaya} />
    </>
  ),
  'absen-tinjau': (
    <>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" style={gaya} />
      <circle cx="12" cy="12" r="2.6" style={gaya} />
    </>
  ),
};

/** `key` tab (§ `lib/navUtama.ts`) -> nama ikon -- `lapor-dinamis-*` dipetakan ke ikon "lapor" yang sama. */
export function ikonUntukTab(tabKey: string): string {
  if (tabKey.startsWith('lapor-dinamis-')) return 'lapor';
  return tabKey;
}

export function NavIcon({ nama, size = 22 }: { nama: string; size?: number }) {
  const isi = IKON[nama];
  if (!isi) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {isi}
    </svg>
  );
}
