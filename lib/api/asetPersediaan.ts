'use client';

import { useQuery } from '@tanstack/react-query';
import type { AsetPersediaan } from '../asetPersediaan';

/** GET /api/aset-persediaan -- data POS ditarik di server (token POS tidak pernah ke klien). */
export function useAsetPersediaan(bulan: string) {
  return useQuery({
    queryKey: ['aset-persediaan', bulan],
    queryFn: async (): Promise<AsetPersediaan> => {
      const res = await fetch(`/api/aset-persediaan?bulan=${bulan}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { galat?: string }).galat ?? `Gagal memuat (HTTP ${res.status}).`);
      return json as AsetPersediaan;
    },
  });
}
