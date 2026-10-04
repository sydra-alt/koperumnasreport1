import type { Instrumentation } from 'next';

/** Error server dicatat ke galat_aplikasi (lib/galat/catat.ts, migrasi 0072). */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { catatGalatServer } = await import('./lib/galat/catat');
  await catatGalatServer(err, request, context);
};
