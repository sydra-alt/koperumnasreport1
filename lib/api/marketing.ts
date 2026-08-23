'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

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
