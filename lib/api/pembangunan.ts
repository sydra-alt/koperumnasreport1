'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

/**
 * Satu baris rekap per lokasi untuk form Pembangunan (blok 1/3/5, read-only
 * -- §3.5b "satu angka, satu pengisi"). Sumbernya `v_pembangunan_per_lokasi`
 * (migrasi 0009), BUKAN query langsung ke `report` -- lihat `04-CATATAN-TEKNIS.md`
 * §3.4b: Kepala Pembangunan butuh ANGKANYA, bukan ISI laporan PIC Lokasi
 * (keluhan konsumen, nama, permintaan keputusan CEO). View ini `security_invoker
 * = off` dengan penjaga `boleh_lihat_rekap('pembangunan')` di dalamnya --
 * BUKAN pelebaran `can_see_report()`, supaya siapa pun yang boleh mengisi
 * form `pembangunan` (atau `ceo`/`pusat`) dapat rekap angkanya SAJA, tanpa
 * pernah bisa `select * from report where form_key='pic_lokasi'`.
 *
 * View-nya SENGAJA cuma berisi angka/status terstruktur (int, boolean, enum
 * pendek dari field `pilih`) -- `material_kurang` (array nama material +
 * catatan bebas) diringkas jadi JUMLAH baris saja, dan `kiriman_kekurangan`
 * / `infrastruktur_kebutuhan` (teks_panjang bebas) TIDAK ikut terbawa sama
 * sekali. Kalau nanti perlu menambah kolom, pastikan tetap "angka agregat",
 * bukan teks bebas/nama -- §3.4b syarat #1.
 */
export interface PembangunanPerLokasiRow {
  lokasi: string;
  target: number | null;
  sedang_dibangun: number | null;
  finishing: number | null;
  selesai_hari_ini: number | null;
  belum_mulai: number | null;
  material_cukup: boolean | null;
  material_kurang_jumlah: number | null;
  kiriman_precast_jumlah: number | null;
  jalan_status: string | null;
  listrik_status: string | null;
  air_status: string | null;
  drainase_baik: boolean | null;
  penerangan_baik: boolean | null;
  gerbang_baik: boolean | null;
}

export function useRekapPembangunanPerLokasi(enabled = true) {
  return useQuery({
    queryKey: ['rekap-pembangunan-per-lokasi'],
    queryFn: async (): Promise<PembangunanPerLokasiRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_pembangunan_per_lokasi')
        .select(
          'lokasi, target, sedang_dibangun, finishing, selesai_hari_ini, belum_mulai, material_cukup, material_kurang_jumlah, kiriman_precast_jumlah, jalan_status, listrik_status, air_status, drainase_baik, penerangan_baik, gerbang_baik',
        )
        .order('lokasi');
      if (error) throw error;
      return data;
    },
    enabled,
  });
}
