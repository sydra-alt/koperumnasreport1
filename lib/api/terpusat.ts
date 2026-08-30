'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * Satu laporan GLOBAL untuk TANGGAL yang diminta (ga/hrd/perizinan/dti/
 * kendaraan/it/pembangunan) -- masing-masing form_key itu paling banyak SATU
 * baris per hari (`scope:'global'`), jadi query biasa cukup, TIDAK butuh
 * view/RPC. Pusat/CEO sudah berhak baca lewat `can_see_report()` (form_key
 * selain 'accounting'), sama seperti `useOmzetRestoHariIni` (Task 17).
 * Default `tanggal` = hari ini WIB -- pemanggil yang belum ikut pemilih
 * tanggal (kalau ada) tetap dapat perilaku lama tanpa berubah.
 *
 * `cs` TIDAK lagi lewat sini sejak 30 Agustus 2026 -- lihat
 * `useLaporanCsHariIni` di bawah.
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

/**
 * §2 CS -- sejak Koreksi 2 (30 Agustus 2026) form `cs` bisa punya sampai 7
 * pengisi sekaligus dalam satu hari (Avril/Anne/Fur + 4 inservice
 * security/GA yang juga bertugas CS kalau ada konsumen datang), jadi TIDAK
 * bisa lagi diasumsikan satu baris per hari seperti `useLaporanHariIni`.
 * Kembalikan daftar per pengisi -- pemanggil yang menjumlahkan angka &
 * menampilkan masalah urgent per orang.
 */
export interface LaporanCsHariIni {
  penulisNama: string;
  submittedAt: string | null;
  data: Record<string, unknown>;
}

export function useLaporanCsHariIni(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['laporan-cs-hari-ini-terpusat', tanggal],
    queryFn: async (): Promise<LaporanCsHariIni[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report')
        .select('data, submitted_at, author:author_id(nama)')
        .eq('form_key', 'cs')
        .eq('tanggal', tanggal)
        .neq('status', 'draft');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        penulisNama: (r.author as unknown as { nama: string } | null)?.nama ?? '—',
        submittedAt: r.submitted_at,
        data: r.data as Record<string, unknown>,
      }));
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

/** §9 STK -- RPC `stk_untuk_tanggal` (migrasi 0020), SUM lintas lokasi utk tanggal yang diminta. */
export interface StkHariIni {
  total: number;
  sudahDitempati: number;
  belumDitempati: number;
  rumahKosong: number;
  perluMaintenance: number;
}

export function useStkUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['stk-untuk-tanggal', tanggal],
    queryFn: async (): Promise<StkHariIni> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('stk_untuk_tanggal', { p_tanggal: tanggal }).single();
      if (error) throw error;
      const baris = data as Record<string, unknown> | null;
      return {
        total: Number(baris?.stk_total ?? 0),
        sudahDitempati: Number(baris?.sudah_ditempati ?? 0),
        belumDitempati: Number(baris?.belum_ditempati ?? 0),
        rumahKosong: Number(baris?.rumah_kosong ?? 0),
        perluMaintenance: Number(baris?.perlu_maintenance ?? 0),
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

/** §8 Kontrol Per Lokasi -- listing langsung (bukan agregasi) utk tanggal yang diminta, pusat/ceo sudah berhak baca baris `pic_lokasi`. */
export interface PicLokasiHariIni {
  lokasi: string;
  picNama: string;
  data: Record<string, unknown>;
}

export function usePicLokasiUntukTanggal(tanggal: string = tanggalWIB(), enabled = true) {
  return useQuery({
    queryKey: ['pic-lokasi-untuk-tanggal', tanggal],
    queryFn: async (): Promise<PicLokasiHariIni[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('report')
        .select('data, lokasi:lokasi_id(nama), author:author_id(nama)')
        .eq('form_key', 'pic_lokasi')
        .eq('tanggal', tanggal)
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
