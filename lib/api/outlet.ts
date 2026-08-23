'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

export interface OutletRow {
  id: string;
  nama: string;
}

/** Daftar outlet aktif -- dipakai pemilih outlet (form ber-scope 'outlet', mis. manager_resto). */
export function useDaftarOutlet() {
  return useQuery({
    queryKey: ['outlet-daftar'],
    queryFn: async (): Promise<OutletRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('outlet').select('id, nama').eq('aktif', true).order('nama');
      if (error) throw error;
      return data;
    },
  });
}
