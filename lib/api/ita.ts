'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

/**
 * Angka Manager Resto (per outlet) untuk ditampilkan di form Ita -- blok
 * "Kontrol Stok Restoran" (silang-cek, dibandingkan dengan angka Ita sendiri)
 * dan blok "Kebutuhan Stok/RAB" (rollup baca-saja). Sumbernya
 * `v_manager_resto_untuk_ita` (migrasi 0013, security-definer + penjaga
 * `boleh_lihat_rekap('ita')`) -- Ita tidak punya akses baris ke
 * `manager_resto`, lihat 04-CATATAN-TEKNIS.md §3.4b.
 */
export interface ManagerRestoUntukItaRow {
  outlet: string;
  ada_selisih_stok: boolean | null;
  jumlah_item_selisih: number | null;
  stok_habis: { barang: string | null; jumlah: string | null; satuan: string | null }[];
  stok_akan_habis: { barang: string | null; jumlah: string | null; satuan: string | null; kebutuhan_tanggal: string | null }[];
}

export function useManagerRestoUntukIta(enabled = true) {
  return useQuery({
    queryKey: ['manager-resto-untuk-ita'],
    queryFn: async (): Promise<ManagerRestoUntukItaRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_manager_resto_untuk_ita')
        .select('outlet, ada_selisih_stok, jumlah_item_selisih, stok_habis, stok_akan_habis')
        .order('outlet');
      if (error) throw error;
      return data;
    },
    enabled,
  });
}
