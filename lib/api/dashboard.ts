'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * Fungsi campuran YANG DIBAWA (docs/RENCANA-PROYEK-BARU.md §3 poin 3, 3
 * September 2026) -- dulu file ini juga punya `usePembangunanUntukTanggal`
 * (form `pembangunan`, DIBUANG), sekarang dipindah ke lib/api/pembangunan.ts
 * supaya file itu bisa dihapus utuh nanti tanpa mencari-cari fungsi yang
 * masih dipakai. Kedua fungsi di bawah ini INTI sistem baru (keuangan +
 * silang-cek omzet resto), tetap dipakai.
 */

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

/**
 * 03-CALC-SPEC.md §4.4 -- silang-cek omzet resto utk TANGGAL yang diminta,
 * per outlet. Diperbarui 30 Agustus 2026 (migrasi 0036) -- `versiIta`
 * diganti `versiKontrolFnb`, mengikuti form `ita` yang dipecah jadi
 * `thrifting`+`kontrol_fnb`.
 */
export interface SelisihRestoRow {
  outlet: string;
  versiManager: number | null;
  versiKontrolFnb: number | null;
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
        versiKontrolFnb: r.versi_kontrol_fnb as number | null,
        selisih: r.selisih as number | null,
      }));
    },
    enabled,
  });
}
