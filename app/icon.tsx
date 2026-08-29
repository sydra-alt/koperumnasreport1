import { ImageResponse } from 'next/og';
import { elemenIkon } from '../lib/ikonAplikasi';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/** Konvensi Next.js -- favicon/ikon tab browser, ditautkan otomatis ke `<head>`. */
export default function Icon() {
  return new ImageResponse(elemenIkon(32), { ...size });
}
