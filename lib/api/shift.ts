'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

export interface ShiftRow {
  id: string;
  nama: string;
  jamMulai: string | null;
  jamSelesai: string | null;
  batasLapor: string | null;
}

/** Daftar shift aktif -- dipakai pemilih shift (form ber-scope shift, mis. security) dan resolusi nama/batas lapor dari id. */
export function useDaftarShift() {
  return useQuery({
    queryKey: ['shift-daftar'],
    queryFn: async (): Promise<ShiftRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('shift')
        .select('id, nama, jam_mulai, jam_selesai, batas_lapor')
        .eq('aktif', true)
        .order('nama');
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, nama: r.nama, jamMulai: r.jam_mulai, jamSelesai: r.jam_selesai, batasLapor: r.batas_lapor }));
    },
  });
}
