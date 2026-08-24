'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * Task 20 -- 03-CALC-SPEC.md §4.2, dijumlahkan dari `pic_lokasi` utk TANGGAL
 * yang diminta. RPC `pembangunan_untuk_tanggal` (migrasi 0020 -- dulu view
 * `v_pembangunan_hari_ini`, diubah jadi fungsi supaya Laporan Terpusat bisa
 * memilih tanggal mundur; default tetap hari ini utk pemanggil lama seperti
 * dashboard CEO di Beranda). SELALU tepat 1 baris (sum tanpa GROUP BY) walau
 * 0 laporan pada tanggal itu -- kolomnya NULL, di-coalesce ke 0 di sini
 * supaya dashboard tampil "0", bukan `NaN`.
 */
export interface PembangunanHariIni {
  sedangDibangun: number;
  finishing: number;
  selesaiHariIni: number;
  belumMulai: number;
}

export function usePembangunanUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['pembangunan-untuk-tanggal', tanggal],
    queryFn: async (): Promise<PembangunanHariIni> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('pembangunan_untuk_tanggal', { p_tanggal: tanggal }).single();
      if (error) throw error;
      const baris = data as Record<string, unknown> | null;
      return {
        sedangDibangun: Number(baris?.sedang_dibangun ?? 0),
        finishing: Number(baris?.finishing ?? 0),
        selesaiHariIni: Number(baris?.selesai_hari_ini ?? 0),
        belumMulai: Number(baris?.belum_mulai ?? 0),
      };
    },
    enabled,
  });
}

/** 03-CALC-SPEC.md §4.3 -- empat angka mutlak utk TANGGAL yang diminta, sama yang dilihat Sabrina (Task 21 Bagian 11). */
export interface KeuanganRekap {
  tanggal: string;
  totalMasuk: number;
  totalKeluar: number;
  net: number;
  warna: 'hijau' | 'kuning' | 'merah' | null;
}

export function useKeuanganRekapUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['keuangan-rekap-untuk-tanggal', tanggal],
    queryFn: async (): Promise<KeuanganRekap | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('v_keuangan_rekap').select('*').eq('tanggal', tanggal).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        tanggal: data.tanggal,
        totalMasuk: Number(data.total_masuk ?? 0),
        totalKeluar: Number(data.total_keluar ?? 0),
        net: Number(data.net ?? 0),
        warna: data.warna,
      };
    },
    enabled,
  });
}

/** 03-CALC-SPEC.md §4.4 -- silang-cek omzet resto utk TANGGAL yang diminta, per outlet. */
export interface SelisihRestoRow {
  outlet: string;
  versiManager: number | null;
  versiIta: number | null;
  selisih: number | null;
}

export function useSelisihRestoUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['selisih-resto-untuk-tanggal', tanggal],
    queryFn: async (): Promise<SelisihRestoRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('selisih_resto_untuk_tanggal', { p_tanggal: tanggal }).order('outlet');
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        outlet: r.outlet as string,
        versiManager: r.versi_manager as number | null,
        versiIta: r.versi_ita as number | null,
        selisih: r.selisih as number | null,
      }));
    },
    enabled,
  });
}
