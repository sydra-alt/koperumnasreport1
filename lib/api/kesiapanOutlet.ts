'use client';

import { useQuery } from '@tanstack/react-query';
import type { BarisKesiapan } from '../kesiapanOutlet';

export type DataKesiapan = { dibuatPada: string; baris: BarisKesiapan[] };

/** GET /api/kesiapan-outlet -- data POS ditarik di server (token POS tidak pernah ke klien). */
export function useKesiapanOutlet() {
  return useQuery({
    queryKey: ['kesiapan-outlet'],
    queryFn: async (): Promise<DataKesiapan> => {
      const res = await fetch('/api/kesiapan-outlet', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { galat?: string }).galat ?? `Gagal memuat (HTTP ${res.status}).`);
      return json as DataKesiapan;
    },
  });
}
