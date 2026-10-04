import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { ringkasGalat } from './sensor';

/**
 * Log galat aplikasi (7 Oktober 2026, migrasi 0072). Satu-satunya jalur tulis
 * adalah RPC catat_galat() dengan sesi PEMANGGIL sendiri (anon key + cookie),
 * bukan service role: peran ditentukan di SQL, pesan disensor lagi di SQL.
 * Yang dikirim hanya: sumber, pola rute (tanpa query string), metode, nama +
 * pesan error baris pertama (disensor), digest. TIDAK PERNAH isi request,
 * cookie, header, stack, atau data formulir.
 */
type PermintaanGalat = { path: string; method: string; headers: Record<string, string | string[] | undefined> };
type KonteksGalat = { routePath?: string };

export async function catatGalatServer(err: unknown, req: PermintaanGalat, ctx: KonteksGalat): Promise<void> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return;
    const mentah = req.headers['cookie'];
    const cookieHeader = Array.isArray(mentah) ? mentah.join('; ') : (mentah ?? '');
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => parseCookieHeader(cookieHeader).map((c) => ({ name: c.name, value: c.value ?? '' })),
        setAll: () => {},
      },
    });
    await supabase.rpc('catat_galat', {
      p_sumber: 'server',
      p_rute: (ctx.routePath || req.path).split('?')[0],
      p_metode: req.method,
      p_pesan: ringkasGalat(err),
      p_digest: (err as { digest?: string } | null)?.digest ?? null,
    });
  } catch {
    // Mencatat error tidak boleh memicu error baru.
  }
}
