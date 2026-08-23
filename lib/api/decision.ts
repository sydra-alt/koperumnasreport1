'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

/**
 * Buat satu baris `decision` berstatus 'menunggu' dari laporan yang baru dikirim.
 * RLS `dec_insert` (0002_rls.sql) mensyaratkan report_id merujuk laporan milik
 * pengirim sendiri -- karena itu ini WAJIB dipanggil setelah report tersimpan,
 * bukan sebelumnya. Dipakai dua jalur: blokKeputusanCeo (satu keputusan per
 * laporan) dan tabel `sumberKeputusan` (banyak keputusan per laporan, lihat
 * `forms/types.ts`) -- keduanya lewat fungsi generik yang sama, bukan dua
 * mekanisme terpisah.
 */
export async function buatKeputusanDariLaporan(
  reportId: string,
  judul: string,
  masalah: string | null,
  opsi?: { nominal?: number; deadline?: string | null; dampak?: string | null; urgensi?: number },
) {
  const supabase = createClient();
  const { error } = await supabase.from('decision').insert({
    report_id: reportId,
    judul,
    masalah,
    ...(opsi?.nominal !== undefined ? { nominal: opsi.nominal } : {}),
    ...(opsi?.deadline !== undefined ? { deadline: opsi.deadline } : {}),
    ...(opsi?.dampak !== undefined ? { dampak: opsi.dampak } : {}),
    ...(opsi?.urgensi !== undefined ? { urgensi: opsi.urgensi } : {}),
  });
  if (error) throw error;
}

/**
 * Task 19 -- Antrean Keputusan CEO. `report:report_id(...)` di-embed lewat
 * PostgREST -- kalau RLS `report_select` menolak baris sumbernya (mis. Pusat
 * melihat decision accounting SEBELUM migrasi 0016), embed itu jatuh jadi
 * `null`, bukan error; sejak 0016, `dec_select` sendiri sudah menyaring baris
 * accounting dari Pusat, jadi kasus itu tidak lagi terjadi untuk Pusat.
 */
export interface KeputusanRow {
  id: string;
  judul: string;
  masalah: string | null;
  dampak: string | null;
  nominal: number;
  deadline: string | null;
  urgensi: number;
  status: 'menunggu' | 'disetujui' | 'dicicil' | 'ditunda' | 'ditolak';
  keputusanCatatan: string | null;
  decidedByNama: string | null;
  decidedAt: string | null;
  createdAt: string;
  formKey: string | null;
  tanggalLaporan: string | null;
  authorNama: string | null;
}

const KOLOM_KEPUTUSAN =
  'id, judul, masalah, dampak, nominal, deadline, urgensi, status, keputusan_catatan, decided_at, created_at,' +
  ' decided_by:decided_by(nama), report:report_id(form_key, tanggal, author:author_id(nama))';

interface BarisMentahRelasi {
  nama: string | null;
}
interface BarisMentah {
  id: string;
  judul: string;
  masalah: string | null;
  dampak: string | null;
  nominal: number;
  deadline: string | null;
  urgensi: number;
  status: KeputusanRow['status'];
  keputusan_catatan: string | null;
  decided_at: string | null;
  created_at: string;
  decided_by: BarisMentahRelasi | null;
  report: { form_key: string; tanggal: string; author: BarisMentahRelasi | null } | null;
}

function petakanBaris(r: BarisMentah): KeputusanRow {
  return {
    id: r.id,
    judul: r.judul,
    masalah: r.masalah,
    dampak: r.dampak,
    nominal: Number(r.nominal),
    deadline: r.deadline,
    urgensi: r.urgensi,
    status: r.status,
    keputusanCatatan: r.keputusan_catatan,
    decidedByNama: r.decided_by?.nama ?? null,
    decidedAt: r.decided_at,
    createdAt: r.created_at,
    formKey: r.report?.form_key ?? null,
    tanggalLaporan: r.report?.tanggal ?? null,
    authorNama: r.report?.author?.nama ?? null,
  };
}

/** Antrean -- status 'menunggu', urut urgensi lalu deadline (persis decision_antrean_idx, 0001_init.sql). */
export function useAntreanKeputusan() {
  return useQuery({
    queryKey: ['antrean-keputusan'],
    queryFn: async (): Promise<KeputusanRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('decision')
        .select(KOLOM_KEPUTUSAN)
        .eq('status', 'menunggu')
        .order('urgensi', { ascending: true })
        .order('deadline', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data as unknown as BarisMentah[]).map(petakanBaris);
    },
  });
}

/** Riwayat -- status apa pun SELAIN 'menunggu', urut yang paling baru diputuskan. */
export function useRiwayatKeputusan() {
  return useQuery({
    queryKey: ['riwayat-keputusan'],
    queryFn: async (): Promise<KeputusanRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('decision')
        .select(KOLOM_KEPUTUSAN)
        .neq('status', 'menunggu')
        .order('decided_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as BarisMentah[]).map(petakanBaris);
    },
  });
}

/**
 * Tombol Setujui/Cicil/Tunda/Tolak -- RLS `dec_decide` (0002_rls.sql)
 * mensyaratkan `has_role('ceo')` di KEDUA `using` dan `with check`, jadi
 * update dari Pusat otomatis ditolak database, bukan cuma disembunyikan di UI.
 */
export function useMemutuskan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      catatan,
    }: {
      id: string;
      status: 'disetujui' | 'dicicil' | 'ditunda' | 'ditolak';
      catatan: string | null;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Belum masuk.');

      const { error } = await supabase
        .from('decision')
        .update({ status, keputusan_catatan: catatan, decided_by: user.id, decided_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antrean-keputusan'] });
      queryClient.invalidateQueries({ queryKey: ['riwayat-keputusan'] });
    },
  });
}
