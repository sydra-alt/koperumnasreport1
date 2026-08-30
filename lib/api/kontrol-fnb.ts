'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

/**
 * Angka Manager Resto (per outlet) untuk ditampilkan di form Kontrol F&B --
 * blok "Kontrol Stok Restoran" (silang-cek, dibandingkan dengan angka
 * pengisi kontrol_fnb sendiri) dan blok "Kebutuhan Stok/RAB" (rollup
 * baca-saja). Sumbernya `v_manager_resto_untuk_kontrol_fnb` (migrasi 0013,
 * DIGANTI NAMA dari `v_manager_resto_untuk_ita` -- migrasi 0036, mengikuti
 * pemecahan form `ita` jadi `thrifting`+`kontrol_fnb` -- security-definer +
 * penjaga `boleh_lihat_rekap('kontrol_fnb')`) -- pengisi kontrol_fnb tidak
 * punya akses baris ke `manager_resto`, lihat 04-CATATAN-TEKNIS.md §3.4b.
 */
export interface ManagerRestoUntukKontrolFnbRow {
  outlet: string;
  ada_selisih_stok: boolean | null;
  jumlah_item_selisih: number | null;
  stok_habis: { barang: string | null; jumlah: string | null; satuan: string | null }[];
  stok_akan_habis: { barang: string | null; jumlah: string | null; satuan: string | null; kebutuhan_tanggal: string | null }[];
}

export function useManagerRestoUntukKontrolFnb(enabled = true) {
  return useQuery({
    queryKey: ['manager-resto-untuk-kontrol-fnb'],
    queryFn: async (): Promise<ManagerRestoUntukKontrolFnbRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_manager_resto_untuk_kontrol_fnb')
        .select('outlet, ada_selisih_stok, jumlah_item_selisih, stok_habis, stok_akan_habis')
        .order('outlet');
      if (error) throw error;
      return data;
    },
    enabled,
  });
}
