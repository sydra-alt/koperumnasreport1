import { ImageResponse } from 'next/og';
import { elemenIkon } from '../../lib/ikonAplikasi';

export const dynamic = 'force-static';

/** Ukuran 512x512 -- dirujuk `app/manifest.ts` (ikon "any" + "maskable" utk Android/Chrome). */
export function GET() {
  return new ImageResponse(elemenIkon(512), { width: 512, height: 512 });
}
