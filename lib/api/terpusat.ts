'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * Fungsi Laporan Terpusat yang MASIH DIPAKAI (docs/RENCANA-PROYEK-BARU.md
 * §3 poin 3, 3 September 2026) -- `useLaporanCsHariIni`, `useStkUntukTanggal`,
 * `usePicLokasiUntukTanggal` (form `cs`/`pic_lokasi`, DIBUANG) sudah
 * dipindah ke lib/api/terpusat-form-perumahan.ts supaya gampang dihapus
 * sekaligus nanti. `useSecurityUntukTanggal` (form `security`) TETAP DI
 * SINI, TIDAK disentuh -- CEO sedang memutuskan apakah form itu masih
 * dipakai untuk resto/thrifting.
 */

/**
 * Satu laporan GLOBAL untuk TANGGAL yang diminta -- dulu dipakai
 * ga/hrd/perizinan/dti/kendaraan/it/pembangunan (masing-masing form_key itu
 * paling banyak SATU baris per hari, `scope:'global'`, jadi query biasa
 * cukup, TIDAK butuh view/RPC). SEKARANG cuma `hrd` yang masih relevan --
 * enam pemanggil lain (di app/terpusat/page.tsx) terikat form yang DIBUANG,
 * ikut hilang saat halaman itu ditulis ulang (§3 poin 4). Fungsi generiknya
 * sendiri TETAP DI SINI karena `hrd` masih memakainya, bukan dipindah --
 * bukan fungsi ini yang dibuang, cuma sebagian besar PEMANGGILNYA.
 * Pusat/CEO sudah berhak baca lewat `can_see_report()` (form_key selain
 * 'accounting'), sama seperti `useOmzetRestoHariIni` (Task 17).
 */
export function useLaporanHariIni(formKey: string, tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['laporan-hari-ini-terpusat', formKey, tanggal],
    queryFn: async (): Promise<{ data: Record<string, unknown>; submittedAt: string | null } | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report')
        .select('data, submitted_at')
        .eq('form_key', formKey)
        .eq('tanggal', tanggal)
        .neq('status', 'draft')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { data: data.data as Record<string, unknown>, submittedAt: data.submitted_at };
    },
    enabled,
  });
}

/** §4 Security -- RPC `security_untuk_tanggal` (migrasi 0020), SUM lintas lokasi+shift utk tanggal yang diminta. */
export interface SecurityHariIni {
  satpamHadir: number;
  tamuDatang: number;
  konsumenDatang: number;
  jumlahKejadian: number;
}

export function useSecurityUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['security-untuk-tanggal', tanggal],
    queryFn: async (): Promise<SecurityHariIni> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('security_untuk_tanggal', { p_tanggal: tanggal }).single();
      if (error) throw error;
      const baris = data as Record<string, unknown> | null;
      return {
        satpamHadir: Number(baris?.satpam_hadir ?? 0),
        tamuDatang: Number(baris?.tamu_datang ?? 0),
        konsumenDatang: Number(baris?.konsumen_datang ?? 0),
        jumlahKejadian: Number(baris?.jumlah_kejadian ?? 0),
      };
    },
    enabled,
  });
}

/** §13 Marketing -- RPC `marketing_untuk_tanggal` (migrasi 0020), rollup harian seluruh karyawan utk tanggal yang diminta. */
export interface MarketingHariIni {
  totalKaryawan: number;
  sudahLaporHariIni: number;
  undanganHariIni: number;
  closingHariIni: number;
}

export function useMarketingUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['marketing-untuk-tanggal', tanggal],
    queryFn: async (): Promise<MarketingHariIni> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('marketing_untuk_tanggal', { p_tanggal: tanggal }).single();
      if (error) throw error;
      const baris = data as Record<string, unknown> | null;
      return {
        totalKaryawan: Number(baris?.total_karyawan ?? 0),
        sudahLaporHariIni: Number(baris?.sudah_lapor_hari_ini ?? 0),
        undanganHariIni: Number(baris?.undangan_hari_ini ?? 0),
        closingHariIni: Number(baris?.closing_hari_ini ?? 0),
      };
    },
    enabled,
  });
}

/**
 * Daftar karyawan "tertinggal" BULAN INI -- FILTER baris `v_marketing_bulanan`
 * yang sudah ada (Task 15), bukan agregasi baru. Ini SENGAJA tidak ikut
 * pemilih tanggal harian Terpusat -- `v_marketing_bulanan` sendiri sudah
 * berbasis "bulan berjalan sampai hari ini", bukan satu tanggal.
 */
export interface KaryawanTertinggal {
  nama: string;
  undangan: number;
  closing: number;
}

export function useKaryawanTertinggal(enabled = true) {
  return useQuery({
    queryKey: ['karyawan-tertinggal'],
    queryFn: async (): Promise<KaryawanTertinggal[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_marketing_bulanan')
        .select('nama, undangan, closing, pte_berlaku')
        .eq('pte_berlaku', true)
        .or('undangan.lt.20,closing.lt.2')
        .order('nama');
      if (error) throw error;
      return (data ?? []).map((r) => ({ nama: r.nama, undangan: Number(r.undangan), closing: Number(r.closing) }));
    },
    enabled,
  });
}
