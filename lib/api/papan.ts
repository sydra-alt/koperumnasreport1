'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

/**
 * Satu baris = satu penugasan (`assignment`) hari ini, dari `v_papan_hari_ini`
 * (migrasi 0015, persis 03-CALC-SPEC.md §4.1 + kolom `nudged_at` tambahan).
 * `reportId === null` berarti BELUM LAPOR -- itulah kontrak view ini, bukan
 * dihitung ulang di sini.
 */
export interface PapanRow {
  assignmentId: string;
  formKey: string;
  scopeNama: string;
  picNama: string;
  reportId: string | null;
  status: 'draft' | 'terkirim' | 'terlambat' | null;
  warna: 'hijau' | 'kuning' | 'merah' | null;
  submittedAt: string | null;
  nudgedAt: string | null;
}

export function usePapanHariIni() {
  return useQuery({
    queryKey: ['papan-hari-ini'],
    queryFn: async (): Promise<PapanRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('v_papan_hari_ini')
        .select('assignment_id, form_key, scope_nama, pic_nama, report_id, status, warna, submitted_at, nudged_at')
        .order('form_key');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        assignmentId: r.assignment_id,
        formKey: r.form_key,
        scopeNama: r.scope_nama,
        picNama: r.pic_nama,
        reportId: r.report_id,
        status: r.status,
        warna: r.warna,
        submittedAt: r.submitted_at,
        nudgedAt: r.nudged_at,
      }));
    },
  });
}

/** Tombol "Tagih" -- RPC `tagih_laporan` (security definer, migrasi 0015), BUKAN update langsung (lihat 04-CATATAN-TEKNIS.md §3.2). */
export function useTagihLaporan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('tagih_laporan', { assignment: assignmentId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['papan-hari-ini'] });
    },
  });
}
