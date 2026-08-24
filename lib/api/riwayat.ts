'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';

/**
 * "Laporan Saya" (Task riwayat, 24 Agustus 2026) -- sengaja DIBATASI ke
 * `author_id = diri sendiri` secara eksplisit di query, BUKAN cuma
 * mengandalkan RLS `report_select`/`can_see_report()`. RLS memang
 * mengizinkan ceo/pusat melihat laporan orang lain (form selain
 * 'accounting'), tapi "Laporan Saya" secara makna harus SELALU personal
 * bagi siapa pun yang membukanya -- CEO yang buka /riwayat tetap cuma
 * melihat laporannya sendiri, bukan daftar gabungan seluruh karyawan
 * (itu peran Papan Kontrol/Laporan Terpusat, halaman lain).
 */
export interface RiwayatRow {
  id: string;
  formKey: string;
  tanggal: string;
  submittedAt: string | null;
  status: 'draft' | 'terkirim' | 'terlambat';
  warna: 'hijau' | 'kuning' | 'merah' | null;
}

function tanggalMundur(hari: number): string {
  const [t, b, h] = tanggalWIB().split('-').map(Number);
  const d = new Date(Date.UTC(t, b - 1, h - hari));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function useRiwayatSaya() {
  return useQuery({
    queryKey: ['riwayat-saya'],
    queryFn: async (): Promise<RiwayatRow[]> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Belum masuk.');

      const { data, error } = await supabase
        .from('report')
        .select('id, form_key, tanggal, submitted_at, status, warna')
        .eq('author_id', user.id)
        .neq('status', 'draft')
        .gte('tanggal', tanggalMundur(30))
        .order('tanggal', { ascending: false })
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        formKey: r.form_key,
        tanggal: r.tanggal,
        submittedAt: r.submitted_at,
        status: r.status,
        warna: r.warna,
      }));
    },
  });
}

export interface LaporanDetail {
  id: string;
  formKey: string;
  tanggal: string;
  submittedAt: string | null;
  status: 'draft' | 'terkirim' | 'terlambat';
  warna: 'hijau' | 'kuning' | 'merah' | null;
  data: Record<string, unknown>;
}

/** Satu laporan MILIK SENDIRI, lengkap isinya -- utk mode baca saja. Sengaja `.eq('author_id', user.id)`, lihat catatan di atas. */
export function useLaporanDetail(id: string) {
  return useQuery({
    queryKey: ['laporan-detail', id],
    queryFn: async (): Promise<LaporanDetail | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Belum masuk.');

      const { data, error } = await supabase
        .from('report')
        .select('id, form_key, tanggal, submitted_at, status, warna, data')
        .eq('id', id)
        .eq('author_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        formKey: data.form_key,
        tanggal: data.tanggal,
        submittedAt: data.submitted_at,
        status: data.status,
        warna: data.warna,
        data: data.data as Record<string, unknown>,
      };
    },
  });
}

export interface LampiranRingkas {
  id: string;
  fieldKey: string;
  path: string;
  mime: string | null;
}

/** Semua lampiran milik satu laporan -- `att_select` RLS (0002_rls.sql) ikut visibilitas laporan induknya, author selalu boleh. */
export function useLampiranLaporan(reportId: string | undefined) {
  return useQuery({
    queryKey: ['lampiran-laporan', reportId],
    enabled: Boolean(reportId),
    queryFn: async (): Promise<LampiranRingkas[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('attachment')
        .select('id, field_key, path, mime')
        .eq('report_id', reportId as string)
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, fieldKey: r.field_key, path: r.path, mime: r.mime }));
    },
  });
}
