'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * Satu laporan GLOBAL hari ini (cs/ga/hrd/perizinan/dti/kendaraan/it/
 * pembangunan) -- masing-masing form_key itu paling banyak SATU baris per
 * hari (`scope:'global'`), jadi query biasa cukup, TIDAK butuh view. Pusat/
 * CEO sudah berhak baca lewat `can_see_report()` (form_key selain
 * 'accounting'), sama seperti `useOmzetRestoHariIni` (Task 17).
 */
export function useLaporanHariIni(formKey: string, enabled = true) {
  return useQuery({
    queryKey: ['laporan-hari-ini-terpusat', formKey],
    queryFn: async (): Promise<{ data: Record<string, unknown>; submittedAt: string | null } | null> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report')
        .select('data, submitted_at')
        .eq('form_key', formKey)
        .eq('tanggal', tanggalWIB())
        .neq('status', 'draft')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { data: data.data as Record<string, unknown>, submittedAt: data.submitted_at };
    },
    enabled,
  });
}

/** §4 Security -- v_security_hari_ini (migrasi 0019), SUM lintas lokasi+shift. */
export interface SecurityHariIni {
  satpamHadir: number;
  tamuDatang: number;
  konsumenDatang: number;
  jumlahKejadian: number;
}

export function useSecurityHariIni(enabled = true) {
  return useQuery({
    queryKey: ['security-hari-ini'],
    queryFn: async (): Promise<SecurityHariIni> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_security_hari_ini')
        .select('satpam_hadir, tamu_datang, konsumen_datang, jumlah_kejadian')
        .single();
      if (error) throw error;
      return {
        satpamHadir: Number(data?.satpam_hadir ?? 0),
        tamuDatang: Number(data?.tamu_datang ?? 0),
        konsumenDatang: Number(data?.konsumen_datang ?? 0),
        jumlahKejadian: Number(data?.jumlah_kejadian ?? 0),
      };
    },
    enabled,
  });
}

/** §9 STK -- v_stk_hari_ini (migrasi 0019), SUM lintas lokasi. */
export interface StkHariIni {
  total: number;
  sudahDitempati: number;
  belumDitempati: number;
  rumahKosong: number;
  perluMaintenance: number;
}

export function useStkHariIni(enabled = true) {
  return useQuery({
    queryKey: ['stk-hari-ini'],
    queryFn: async (): Promise<StkHariIni> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_stk_hari_ini')
        .select('stk_total, sudah_ditempati, belum_ditempati, rumah_kosong, perlu_maintenance')
        .single();
      if (error) throw error;
      return {
        total: Number(data?.stk_total ?? 0),
        sudahDitempati: Number(data?.sudah_ditempati ?? 0),
        belumDitempati: Number(data?.belum_ditempati ?? 0),
        rumahKosong: Number(data?.rumah_kosong ?? 0),
        perluMaintenance: Number(data?.perlu_maintenance ?? 0),
      };
    },
    enabled,
  });
}

/** §13 Marketing -- v_marketing_hari_ini (migrasi 0019), rollup harian seluruh karyawan. */
export interface MarketingHariIni {
  totalKaryawan: number;
  sudahLaporHariIni: number;
  undanganHariIni: number;
  closingHariIni: number;
}

export function useMarketingHariIni(enabled = true) {
  return useQuery({
    queryKey: ['marketing-hari-ini'],
    queryFn: async (): Promise<MarketingHariIni> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_marketing_hari_ini')
        .select('total_karyawan, sudah_lapor_hari_ini, undangan_hari_ini, closing_hari_ini')
        .single();
      if (error) throw error;
      return {
        totalKaryawan: Number(data?.total_karyawan ?? 0),
        sudahLaporHariIni: Number(data?.sudah_lapor_hari_ini ?? 0),
        undanganHariIni: Number(data?.undangan_hari_ini ?? 0),
        closingHariIni: Number(data?.closing_hari_ini ?? 0),
      };
    },
    enabled,
  });
}

/** Daftar karyawan "tertinggal" bulan ini -- FILTER baris `v_marketing_bulanan` yang sudah ada (Task 15), bukan agregasi baru. */
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

/** §8 Kontrol Per Lokasi -- listing langsung (bukan agregasi), pusat/ceo sudah berhak baca baris `pic_lokasi`. */
export interface PicLokasiHariIni {
  lokasi: string;
  picNama: string;
  data: Record<string, unknown>;
}

export function usePicLokasiHariIni(enabled = true) {
  return useQuery({
    queryKey: ['pic-lokasi-hari-ini-terpusat'],
    queryFn: async (): Promise<PicLokasiHariIni[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report')
        .select('data, lokasi:lokasi_id(nama), author:author_id(nama)')
        .eq('form_key', 'pic_lokasi')
        .eq('tanggal', tanggalWIB())
        .neq('status', 'draft');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        lokasi: (r.lokasi as unknown as { nama: string } | null)?.nama ?? '—',
        picNama: (r.author as unknown as { nama: string } | null)?.nama ?? '—',
        data: r.data as Record<string, unknown>,
      }));
    },
    enabled,
  });
}
