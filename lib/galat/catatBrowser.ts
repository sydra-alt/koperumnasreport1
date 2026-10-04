'use client';

import { createClient } from '../supabase/client';
import { ringkasGalat } from './sensor';

/** Error layar. Error ber-digest berasal dari server dan SUDAH dicatat instrumentation.ts. */
export function catatGalatBrowser(error: Error & { digest?: string }) {
  if (error.digest) return;
  try {
    void createClient()
      .rpc('catat_galat', { p_sumber: 'browser', p_rute: window.location.pathname, p_metode: null, p_pesan: ringkasGalat(error), p_digest: null })
      .then(() => {}, () => {});
  } catch {
    // Mencatat error tidak boleh memicu error baru.
  }
}
