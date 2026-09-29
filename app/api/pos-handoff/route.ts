import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '../../../lib/supabase/server';
import { buatTokenHandoffPos, type AksesPos } from '../../../lib/posHandoff';

/**
 * GET /api/pos-handoff — titik AWAL "satu pintu masuk" ke dashboard pos-fnb
 * (25 September 2026). Lihat lib/posHandoff.ts untuk desain token dan
 * batasnya, dan pos-fnb `src/app/handoff/route.ts` (repo terpisah) untuk
 * sisi penerima.
 *
 * Cuma pembuat token + redirect -- TIDAK PERNAH memutuskan siapa boleh
 * masuk ke pos-fnb ATAU dengan peran apa (itu murni urusan
 * report_identity_links + membership di pos-fnb sendiri). Kalau orang ini
 * belum dipetakan di sana, pos-fnb sendiri yang menampilkan pesan gagal
 * yang wajar -- route ini tidak tahu dan tidak perlu tahu itu.
 */
export async function GET(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.redirect(new URL('/masuk', request.url));
  }

  const posUrl = process.env.POS_INTEGRASI_URL;
  if (!posUrl) {
    return NextResponse.json(
      { error: 'POS_INTEGRASI_URL belum dikonfigurasi di server.' },
      { status: 503 }
    );
  }

  // Akses POS orang INI dihitung database laporan (akses_pos_saya(), migrasi
  // 0068) lewat sesinya sendiri. Kalau ditolak (tanpa_akses_pos, dst.) token
  // tetap dikirim: pos-fnb yang menampilkan alasannya dengan jelas.
  const [{ data: akses }, { data: profil }] = await Promise.all([
    supabase.rpc('akses_pos_saya'),
    supabase.from('profile').select('nama').eq('id', user.id).maybeSingle(),
  ]);
  const token = buatTokenHandoffPos(
    { id: user.id, email: user.email },
    { nama: (profil?.nama as string | undefined) ?? null, akses: (akses as AksesPos | null) ?? null },
  );
  return NextResponse.redirect(`${posUrl.replace(/\/+$/, '')}/handoff?token=${token}`);
}
