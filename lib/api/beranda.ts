'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';
import type { LaporanHariIniRingkas } from '../tugasHariIni';

/** Semua baris `report` milik SENDIRI untuk hari ini (draft maupun terkirim) -- dipakai Beranda menentukan status tiap tugas ("belum" / "tersimpan, belum dikirim" / selesai). */
export function useLaporanHariIniSaya() {
  return useQuery({
    queryKey: ['laporan-hari-ini-saya'],
    queryFn: async (): Promise<LaporanHariIniRingkas[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Belum masuk.');

      const { data, error } = await supabase
        .from('report')
        .select('form_key, lokasi_id, outlet_id, shift_id, status')
        .eq('author_id', user.id)
        .eq('tanggal', tanggalWIB());
      if (error) throw error;
      return data ?? [];
    },
  });
}
