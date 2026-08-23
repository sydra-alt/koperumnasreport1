'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

export interface ProgresBulanan {
  user_id: string;
  nama: string;
  divisi: string | null;
  bulan: string;
  /** false = policy.pte_mulai_berlaku masih null -- kewajiban PTE belum berjalan sama sekali. */
  pte_berlaku: boolean;
  hari_wajib: number;
  hari_lengkap: number;
  hari_bolong: number;
  undangan: number;
  closing: number;
}

/**
 * Progres bulan berjalan MILIK USER YANG LOGIN, dari view `v_marketing_bulanan`
 * -- angka ini DIHITUNG SISTEM dari akumulasi pte_daily/closing, bukan
 * dihitung ulang di React dan bukan angka yang diketik user.
 */
export function useProgresBulananSaya() {
  return useQuery({
    queryKey: ['progres-bulanan-saya'],
    queryFn: async (): Promise<ProgresBulanan | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Belum masuk.');

      const { data, error } = await supabase
        .from('v_marketing_bulanan')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Task 22 -- Dashboard Kontrol Marketing. SEMUA baris `v_marketing_bulanan`
 * (bukan cuma milik sendiri seperti `useProgresBulananSaya`) -- tabel
 * "karyawan x kepatuhan bulan berjalan". RLS view ini `security_invoker=on`;
 * pembatas SIAPA yang boleh membuka halaman `/marketing` sudah di
 * `Terlindungi` (`kontrol_marketing`/`ceo`/`pusat`), sesuai "Selesai kalau".
 */
export function useMarketingBulananSemua() {
  return useQuery({
    queryKey: ['marketing-bulanan-semua'],
    queryFn: async (): Promise<ProgresBulanan[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('v_marketing_bulanan').select('*').order('nama');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Task 22 -- detail kalender per karyawan: baris `pte_daily` bulan berjalan. `pte_select` (0002_rls.sql) sudah mengizinkan kontrol_marketing/ceo/pusat membaca baris siapa pun. */
export interface PteHarianRingkas {
  tanggal: string;
  lengkap: boolean;
}

export function usePteBulanIniUntuk(userId: string | null) {
  return useQuery({
    queryKey: ['pte-bulan-ini', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<PteHarianRingkas[]> => {
      const supabase = createClient();
      const [tahun, bulan] = tanggalWIB().split('-');
      const awalBulan = `${tahun}-${bulan}-01`;
      const { data, error } = await supabase
        .from('pte_daily')
        .select('tanggal, lengkap')
        .eq('user_id', userId as string)
        .gte('tanggal', awalBulan)
        .order('tanggal');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Task 22 -- `mulai_kerja` karyawan terpilih, dibutuhkan kalender (lib/kalenderPte.ts) untuk "awal wajib" yang sama persis dengan rumus v_marketing_bulanan. `profile` broadly readable (0002_rls.sql). */
export function useMulaiKerja(userId: string | null) {
  return useQuery({
    queryKey: ['mulai-kerja', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<string | null> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('profile').select('mulai_kerja').eq('id', userId as string).single();
      if (error) throw error;
      return data?.mulai_kerja ?? null;
    },
  });
}

export type StatusWarna = 'hijau' | 'kuning' | 'merah';

/** Persis 03-CALC-SPEC.md §3. */
export function statusUndangan(undangan: number, target: number): StatusWarna {
  if (undangan >= target) return 'hijau';
  if (undangan >= target * 0.6) return 'kuning';
  return 'merah';
}

/** Persis 03-CALC-SPEC.md §3. */
export function statusClosing(closing: number, target: number): StatusWarna {
  if (closing >= target) return 'hijau';
  if (closing >= 1) return 'kuning';
  return 'merah';
}
