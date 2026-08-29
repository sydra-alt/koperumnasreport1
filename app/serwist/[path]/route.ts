import { createSerwistRoute } from '@serwist/turbopack';

/**
 * Route Handler yang men-generate + menyajikan service worker
 * (`/serwist/sw.js`) lewat esbuild native, kompatibel Turbopack -- lihat
 * catatan di `next.config.ts`. Sumbernya `app/sw.ts`.
 */
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: 'app/sw.ts',
  useNativeEsbuild: true,
});
