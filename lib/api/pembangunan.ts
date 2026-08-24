'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * Satu baris rekap per lokasi untuk form Pembangunan (blok 1/3/5, read-only
 * -- §3.5b "satu angka, satu pengisi"). Sumbernya `v_pembangunan_per_lokasi`
 * (migrasi 0011, versi terakhir), BUKAN query langsung ke `report` -- lihat
 * `04-CATATAN-TEKNIS.md` §3.4b: Kepala Pembangunan butuh ANGKANYA, bukan ISI
 * laporan PIC Lokasi (keluhan konsumen, nama, permintaan keputusan CEO).
 * View ini `security_invoker = off` dengan penjaga
 * `boleh_lihat_rekap('pembangunan')` di dalamnya -- BUKAN pelebaran
 * `can_see_report()`, supaya siapa pun yang boleh mengisi form `pembangunan`
 * (atau `ceo`/`pusat`) dapat rekap angkanya SAJA, tanpa pernah bisa
 * `select * from report where form_key='pic_lokasi'`.
 *
 * Patokan §3.4b syarat #1 (diperbaiki user, 23 Agustus 2026): BUKAN "hanya
 * angka", tapi "apakah isinya bisa ditebak". `material_kurang` BOLEH masuk
 * lengkap dengan nama material/kebutuhan/untuk_unit/dibutuhkan_tanggal --
 * itu tabel terstruktur yang memang dibutuhkan supaya Ronald bisa memesan.
 * `kiriman_kekurangan` dan `infrastruktur_kebutuhan` TETAP di luar view --
 * keduanya field teks bebas, isinya tidak bisa dijamin.
 *
 * `material_kurang` direkonstruksi di view lewat subquery berkorelasi yang
 * cuma mengambil 4 kunci whitelist per elemen -- kalau form menambah kolom
 * baru di tabel itu suatu saat, view ini TIDAK otomatis ikut membocorkannya.
 */
export interface MaterialKurangBaris {
  material: string | null;
  kebutuhan: string | null;
  untuk_unit: string | null;
  dibutuhkan_tanggal: string | null;
}

export interface PembangunanPerLokasiRow {
  lokasi: string;
  target: number | null;
  sedang_dibangun: number | null;
  finishing: number | null;
  selesai_hari_ini: number | null;
  belum_mulai: number | null;
  material_cukup: boolean | null;
  material_kurang: MaterialKurangBaris[];
  kiriman_precast_jumlah: number | null;
  jalan_status: string | null;
  listrik_status: string | null;
  air_status: string | null;
  drainase_baik: boolean | null;
  penerangan_baik: boolean | null;
  gerbang_baik: boolean | null;
}

/**
 * `tanggal` opsional (default hari ini) -- RPC `pembangunan_per_lokasi_untuk_tanggal`
 * (migrasi 0020, dulu view `v_pembangunan_per_lokasi`) diubah jadi fungsi
 * bertanggal supaya Laporan Terpusat bisa memilih tanggal mundur. Rollup
 * baca-saja form `pembangunan` sendiri TIDAK mengirim `tanggal` sama sekali
 * (selalu hari ini), jadi perilakunya tidak berubah dari sebelumnya.
 */
export function useRekapPembangunanPerLokasi(enabled = true, tanggal: string = tanggalWIB()) {
  return useQuery({
    queryKey: ['rekap-pembangunan-per-lokasi', tanggal],
    queryFn: async (): Promise<PembangunanPerLokasiRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .rpc('pembangunan_per_lokasi_untuk_tanggal', { p_tanggal: tanggal })
        .order('lokasi');
      if (error) throw error;
      return data;
    },
    enabled,
  });
}
