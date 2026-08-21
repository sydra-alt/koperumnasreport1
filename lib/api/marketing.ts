'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

export interface ProgresBulanan {
  user_id: string;
  nama: string;
  divisi: string | null;
  bulan: string;
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
