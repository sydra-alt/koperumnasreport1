'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PolicyMap } from './policy';
import { createClient } from '../supabase/client';
import { jamWIB, tanggalWIB } from '../tanggal';

export interface ScopeOpsi {
  lokasiId?: string;
  outletId?: string;
  shift?: string;
  /** false = query dimatikan -- dipakai selagi scope (mis. lokasi) belum dipilih user. Default true. */
  aktif?: boolean;
}

export interface ReportRow {
  id: string;
  form_key: string;
  tanggal: string;
  author_id: string;
  lokasi_id: string | null;
  outlet_id: string | null;
  shift: string | null;
  data: Record<string, unknown>;
  status: 'draft' | 'terkirim' | 'terlambat';
  warna: 'hijau' | 'kuning' | 'merah' | null;
  submitted_at: string | null;
}

function kunciQuery(formKey: string, opsi?: ScopeOpsi) {
  return ['report-hari-ini', formKey, opsi?.lokasiId ?? null, opsi?.outletId ?? null, opsi?.shift ?? null];
}

/** Laporan hari ini (WIB) milik user yang sedang login untuk form+scope ini, kalau ada. */
export function useReportHariIni(formKey: string, opsi?: ScopeOpsi) {
  return useQuery({
    queryKey: kunciQuery(formKey, opsi),
    enabled: opsi?.aktif ?? true,
    queryFn: async (): Promise<ReportRow | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Belum masuk.');

      let query = supabase
        .from('report')
        .select('*')
        .eq('form_key', formKey)
        .eq('tanggal', tanggalWIB())
        .eq('author_id', user.id);

      query = opsi?.lokasiId ? query.eq('lokasi_id', opsi.lokasiId) : query.is('lokasi_id', null);
      query = opsi?.outletId ? query.eq('outlet_id', opsi.outletId) : query.is('outlet_id', null);
      query = opsi?.shift ? query.eq('shift', opsi.shift) : query.is('shift', null);

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Simpan draft. Kalau laporan hari ini BELUM ada (reportId null), buat baris baru
 * sekali; setelah itu selalu UPDATE baris yang sama -- tidak pernah insert lagi.
 * Ini yang membuat "kirim dua kali tidak membuat dua baris" otomatis benar,
 * bukan penanganan kasus khusus terpisah.
 */
export function useSimpanDraft(formKey: string, opsi?: ScopeOpsi) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, isi }: { reportId: string | null; isi: Record<string, unknown> }) => {
      const supabase = createClient();

      if (reportId) {
        const { error } = await supabase.from('report').update({ data: isi }).eq('id', reportId);
        if (error) throw error;
        return reportId;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Belum masuk.');

      const { data, error } = await supabase
        .from('report')
        .insert({
          form_key: formKey,
          tanggal: tanggalWIB(),
          author_id: user.id,
          lokasi_id: opsi?.lokasiId ?? null,
          outlet_id: opsi?.outletId ?? null,
          shift: opsi?.shift ?? null,
          data: isi,
          status: 'draft',
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kunciQuery(formKey, opsi) });
    },
  });
}

/** Batas jam kirim (WIB, "HH:mm") untuk form+shift ini, dari policy.deadline_by_form / shift_deadline. */
export function batasJamKirim(policy: PolicyMap, formKey: string, shift?: string | null): string {
  const deadlineByForm = policy.deadline_by_form as Record<string, string> | undefined;
  const deadlineDefault = (policy.deadline_default as string | undefined) ?? '18:00';
  const batas = deadlineByForm?.[formKey] ?? deadlineDefault;

  if (batas === 'per_shift') {
    const shiftDeadline = policy.shift_deadline as Record<string, string> | undefined;
    return (shift && shiftDeadline?.[shift]) ?? deadlineDefault;
  }
  return batas;
}

/** true kalau jam kirim WIB sekarang sudah lewat batas. */
export function apakahTerlambat(policy: PolicyMap, formKey: string, shift?: string | null): boolean {
  return jamWIB() > batasJamKirim(policy, formKey, shift);
}

export function useKirimReport(formKey: string, opsi?: ScopeOpsi) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      isi,
      warna,
      policy,
    }: {
      reportId: string;
      isi: Record<string, unknown>;
      warna: 'hijau' | 'kuning' | 'merah';
      policy: PolicyMap;
    }) => {
      const supabase = createClient();
      const status = apakahTerlambat(policy, formKey, opsi?.shift) ? 'terlambat' : 'terkirim';

      const { error } = await supabase
        .from('report')
        .update({
          data: isi,
          status,
          warna,
          submitted_at: new Date().toISOString(), // timestamptz presisi, BUKAN tanggal kalender -- aman
        })
        .eq('id', reportId);
      if (error) throw error;
      return status;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: kunciQuery(formKey, opsi) });
    },
  });
}
