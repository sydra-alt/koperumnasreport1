'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

export interface LokasiRow {
  id: string;
  nama: string;
}

/** Daftar lokasi aktif -- dipakai untuk pemilih lokasi (form ber-scope 'lokasi') dan resolusi nama→id. */
export function useDaftarLokasi() {
  return useQuery({
    queryKey: ['lokasi-daftar'],
    queryFn: async (): Promise<LokasiRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('lokasi').select('id, nama').eq('aktif', true).order('nama');
      if (error) throw error;
      return data;
    },
  });
}
