'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import type { BarisKontrol } from '../kontrolHarian';

export type DataKontrolHarian = { tanggal: string; bolehUbah: boolean; posGalat: string | null; baris: BarisKontrol[] };

/** GET /api/kontrol-harian -- data POS ditarik di server (token POS tidak pernah ke klien). */
export function useKontrolHarian(tanggal: string) {
  return useQuery({
    queryKey: ['kontrol-harian', tanggal],
    queryFn: async (): Promise<DataKontrolHarian> => {
      const res = await fetch(`/api/kontrol-harian?tanggal=${tanggal}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { galat?: string }).galat ?? `Gagal memuat (HTTP ${res.status}).`);
      return json as DataKontrolHarian;
    },
  });
}

/** Catatan penyebab & tindakan -- RLS kontrol_harian_catatan: Ita, CEO, Admin. */
export function useSimpanCatatanKontrol(tanggal: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { outletId: string; penyebab: string; tindakan: string }) => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Sesi berakhir, silakan masuk lagi.');
      const { error } = await supabase.from('kontrol_harian_catatan').upsert(
        { outlet_id: v.outletId, tanggal, penyebab: v.penyebab, tindakan: v.tindakan, diubah_oleh: auth.user.id, diubah_pada: new Date().toISOString() },
        { onConflict: 'outlet_id,tanggal' },
      );
      if (error) throw new Error('Catatan gagal disimpan. Coba lagi.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kontrol-harian', tanggal] }),
  });
}
