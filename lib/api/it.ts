'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

/**
 * "PIC lokasi yang BELUM mengirim foto/video pembangunan" (form `it` §7,
 * keputusan D2) -- dihitung dari tabel `attachment`, bukan diketik PIC IT.
 * `attachment` tunduk pada `can_see_report()` seperti `report`, dan `it`
 * bukan salah satu role yang diberi akses ke `pic_lokasi` di situ -- jadi
 * dipisah dua query:
 *
 * 1. `v_pic_lokasi_belum_upload_progress` (migrasi 0012) -- view
 *    security-definer + penjaga `boleh_lihat_rekap('it')`. CUMA berisi
 *    lokasi (dari himpunan tetap tabel `lokasi`) -- TIDAK ADA nama PIC,
 *    karena §3.4b eksplisit melarang "nama orang" lewat view security-definer.
 * 2. Nama PIC utk tiap lokasi yang muncul di (1) diambil lewat query BIASA
 *    ke `assignment`+`profile` -- keduanya sudah broadly readable untuk
 *    SIAPA PUN yang login (lihat 0002_rls.sql: "profile: semua yang login
 *    boleh melihat nama rekan"), jadi tidak butuh security definer sama
 *    sekali di sini.
 */
export interface LokasiBelumUpload {
  lokasiId: string;
  lokasi: string;
  picNama: string[];
}

export function usePicLokasiBelumUpload(enabled = true) {
  return useQuery({
    queryKey: ['pic-lokasi-belum-upload'],
    queryFn: async (): Promise<LokasiBelumUpload[]> => {
      const supabase = createClient();

      const { data: belumUpload, error: errBelumUpload } = await supabase
        .from('v_pic_lokasi_belum_upload_progress')
        .select('lokasi_id, lokasi')
        .order('lokasi');
      if (errBelumUpload) throw errBelumUpload;
      if (belumUpload.length === 0) return [];

      const lokasiIds = belumUpload.map((l) => l.lokasi_id);
      const { data: penugasan, error: errPenugasan } = await supabase
        .from('assignment')
        .select('lokasi_id, profile:user_id(nama)')
        .eq('form_key', 'pic_lokasi')
        .in('lokasi_id', lokasiIds);
      if (errPenugasan) throw errPenugasan;

      return belumUpload.map((l) => ({
        lokasiId: l.lokasi_id,
        lokasi: l.lokasi,
        picNama: penugasan
          .filter((p) => p.lokasi_id === l.lokasi_id)
          .map((p) => (p.profile as unknown as { nama: string } | null)?.nama ?? '—'),
      }));
    },
    enabled,
  });
}
