import { NextResponse } from 'next/server';
import { createClient } from '../supabase/server';

/**
 * Penjaga peran untuk SEMUA Route Handler ekspor (§4 06-RENCANA-PRESENSI-
 * MOBILE.md) -- "hak akses ekspor mengikuti aturan yang sama dengan layar.
 * Setiap endpoint ekspor memeriksa peran di sisi server, bukan menyembunyikan
 * tombol" (instruksi eksplisit). Pola PERSIS `app/api/admin/user/route.ts`
 * (Task 23): sesi login sungguhan dulu (proxy.ts sudah menolak sebelum
 * sampai sini, dicek ulang di sini sebagai jaring pengaman kedua), lalu
 * `role` dicek lewat klien SESI ITU SENDIRI (RLS `role_select` mengizinkan
 * baca baris sendiri) -- BUKAN admin/service_role, endpoint ekspor tidak
 * butuh itu sama sekali, cukup baca datanya lewat RLS yang sama dengan
 * layar (lihat pemakaian di tiap route ekspor).
 *
 * `divisi` opsional -- dipakai satu-satunya kasus yang butuh gabungan
 * peran+divisi (kadiv+HRD, sama seperti `is_hrd_kadiv()` di database).
 */
export async function periksaPeranEkspor(
  peranDiizinkan: string[],
  opsi?: { bolehKadivHrd?: boolean },
): Promise<{ ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string } | { ok: false; response: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Belum masuk.' }, { status: 401 }) };
  }

  const { data: rolesData, error: errRoles } = await supabase.from('role').select('role').eq('user_id', user.id);
  if (errRoles) {
    return { ok: false, response: NextResponse.json({ error: errRoles.message }, { status: 500 }) };
  }
  const roles = (rolesData ?? []).map((r) => r.role);

  let berhak = peranDiizinkan.some((p) => roles.includes(p));
  if (!berhak && opsi?.bolehKadivHrd && roles.includes('kadiv')) {
    const { data: profil } = await supabase.from('profile').select('divisi').eq('id', user.id).maybeSingle();
    berhak = profil?.divisi === 'HRD';
  }

  if (!berhak) {
    return { ok: false, response: NextResponse.json({ error: 'Tidak berhak mengunduh ekspor ini.' }, { status: 403 }) };
  }

  return { ok: true, supabase, userId: user.id };
}

/** "2026-08" -> tanggal awal & akhir bulan (string 'YYYY-MM-DD', WIB kalender murni, bukan Date/instant). */
export function rentangBulan(bulan: string): { awal: string; akhir: string } {
  const cocok = /^(\d{4})-(\d{2})$/.exec(bulan);
  if (!cocok) throw new Error('Parameter bulan wajib format YYYY-MM, mis. 2026-08.');
  const tahun = Number(cocok[1]);
  const bulanAngka = Number(cocok[2]);
  const hariTerakhir = new Date(Date.UTC(tahun, bulanAngka, 0)).getUTCDate();
  const dua = (n: number) => String(n).padStart(2, '0');
  return {
    awal: `${cocok[1]}-${cocok[2]}-01`,
    akhir: `${cocok[1]}-${cocok[2]}-${dua(hariTerakhir)}`,
  };
}
