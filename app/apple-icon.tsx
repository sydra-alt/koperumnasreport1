import { ImageResponse } from 'next/og';
import { elemenIkon } from '../lib/ikonAplikasi';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Konvensi Next.js -- ikon "Tambahkan ke Layar Utama" di iOS Safari, ditautkan otomatis. */
export default function AppleIcon() {
  return new ImageResponse(elemenIkon(180), { ...size });
}
