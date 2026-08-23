'use client';

import { createClient } from '../supabase/client';

/**
 * Buat satu baris `decision` berstatus 'menunggu' dari laporan yang baru dikirim.
 * RLS `dec_insert` (0002_rls.sql) mensyaratkan report_id merujuk laporan milik
 * pengirim sendiri -- karena itu ini WAJIB dipanggil setelah report tersimpan,
 * bukan sebelumnya.
 */
export async function buatKeputusanDariLaporan(reportId: string, judul: string, masalah: string | null) {
  const supabase = createClient();
  const { error } = await supabase.from('decision').insert({
    report_id: reportId,
    judul,
    masalah,
  });
  if (error) throw error;
}
