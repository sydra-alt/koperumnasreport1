import { ImageResponse } from 'next/og';
import { elemenIkon } from '../../lib/ikonAplikasi';

export const dynamic = 'force-static';

/** Ukuran 192x192 -- dirujuk `app/manifest.ts` (ikon "any" utk Android/Chrome). */
export function GET() {
  return new ImageResponse(elemenIkon(192), { width: 192, height: 192 });
}
