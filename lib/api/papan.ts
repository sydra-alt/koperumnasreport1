'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * Satu baris = satu penugasan (`assignment`) untuk TANGGAL yang diminta, dari
 * RPC `papan_untuk_tanggal` (migrasi 0020 -- dulu view `v_papan_hari_ini`
 * yang cuma bisa "hari ini", diubah jadi fungsi supaya Papan Kontrol dan
 * Laporan Terpusat bisa memilih tanggal mundur). `reportId === null` berarti
 * BELUM LAPOR pada tanggal itu -- itulah kontrak fungsi ini, bukan dihitung
 * ulang di sini.
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

export function usePapanUntukTanggal(tanggal: string = tanggalWIB()) {
  return useQuery({
    queryKey: ['papan-untuk-tanggal', tanggal],
    queryFn: async (): Promise<PapanRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('papan_untuk_tanggal', { p_tanggal: tanggal }).order('form_key');
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        assignmentId: r.assignment_id as string,
        formKey: r.form_key as string,
        scopeNama: r.scope_nama as string,
        picNama: r.pic_nama as string,
        reportId: r.report_id as string | null,
        status: r.status as PapanRow['status'],
        warna: r.warna as PapanRow['warna'],
        submittedAt: r.submitted_at as string | null,
        nudgedAt: r.nudged_at as string | null,
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
      queryClient.invalidateQueries({ queryKey: ['papan-untuk-tanggal'] });
    },
  });
}
