'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * Task 20 -- 03-CALC-SPEC.md §4.2, dijumlahkan dari `pic_lokasi` hari ini.
 * `v_pembangunan_hari_ini` (migrasi 0018) SELALU tepat 1 baris (sum tanpa
 * GROUP BY) walau 0 laporan hari ini -- kolomnya NULL, di-coalesce ke 0 di
 * sini supaya dashboard tampil "0", bukan `NaN`, saat belum ada laporan.
 */
export interface PembangunanHariIni {
  sedangDibangun: number;
  finishing: number;
  selesaiHariIni: number;
  belumMulai: number;
}

export function usePembangunanHariIni(enabled = true) {
  return useQuery({
    queryKey: ['pembangunan-hari-ini'],
    queryFn: async (): Promise<PembangunanHariIni> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_pembangunan_hari_ini')
        .select('sedang_dibangun, finishing, selesai_hari_ini, belum_mulai')
        .single();
      if (error) throw error;
      return {
        sedangDibangun: Number(data?.sedang_dibangun ?? 0),
        finishing: Number(data?.finishing ?? 0),
        selesaiHariIni: Number(data?.selesai_hari_ini ?? 0),
        belumMulai: Number(data?.belum_mulai ?? 0),
      };
    },
    enabled,
  });
}

/** 03-CALC-SPEC.md §4.3 -- empat angka mutlak, sama yang dilihat Sabrina (Task 21 Bagian 11). */
export interface KeuanganRekap {
  tanggal: string;
  totalMasuk: number;
  totalKeluar: number;
  net: number;
  warna: 'hijau' | 'kuning' | 'merah' | null;
}

export function useKeuanganRekapHariIni(enabled = true) {
  return useQuery({
    queryKey: ['keuangan-rekap-hari-ini'],
    queryFn: async (): Promise<KeuanganRekap | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('v_keuangan_rekap').select('*').eq('tanggal', tanggalWIB()).maybeSingle();
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

/** 03-CALC-SPEC.md §4.4 -- silang-cek omzet resto hari ini, per outlet. */
export interface SelisihRestoRow {
  outlet: string;
  versiManager: number | null;
  versiIta: number | null;
  selisih: number | null;
}

export function useSelisihResto(enabled = true) {
  return useQuery({
    queryKey: ['selisih-resto'],
    queryFn: async (): Promise<SelisihRestoRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('v_selisih_resto').select('*').order('outlet');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        outlet: r.outlet,
        versiManager: r.versi_manager,
        versiIta: r.versi_ita,
        selisih: r.selisih,
      }));
    },
    enabled,
  });
}
