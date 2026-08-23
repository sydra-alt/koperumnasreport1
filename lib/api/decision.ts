'use client';

import { createClient } from '../supabase/client';

/**
 * Buat satu baris `decision` berstatus 'menunggu' dari laporan yang baru dikirim.
 * RLS `dec_insert` (0002_rls.sql) mensyaratkan report_id merujuk laporan milik
 * pengirim sendiri -- karena itu ini WAJIB dipanggil setelah report tersimpan,
 * bukan sebelumnya. Dipakai dua jalur: blokKeputusanCeo (satu keputusan per
 * laporan) dan tabel `sumberKeputusan` (banyak keputusan per laporan, lihat
 * `forms/types.ts`) -- keduanya lewat fungsi generik yang sama, bukan dua
 * mekanisme terpisah.
 */
export async function buatKeputusanDariLaporan(
  reportId: string,
  judul: string,
  masalah: string | null,
  opsi?: { nominal?: number; deadline?: string | null; dampak?: string | null; urgensi?: number },
) {
  const supabase = createClient();
  const { error } = await supabase.from('decision').insert({
    report_id: reportId,
    judul,
    masalah,
    ...(opsi?.nominal !== undefined ? { nominal: opsi.nominal } : {}),
    ...(opsi?.deadline !== undefined ? { deadline: opsi.deadline } : {}),
    ...(opsi?.dampak !== undefined ? { dampak: opsi.dampak } : {}),
    ...(opsi?.urgensi !== undefined ? { urgensi: opsi.urgensi } : {}),
  });
  if (error) throw error;
}
