'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

export type CutiJenis = 'cuti' | 'sakit' | 'izin';
export type CutiStatus = 'diajukan' | 'disetujui' | 'ditolak';

export interface CutiSaya {
  id: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jenis: CutiJenis;
  keterangan: string | null;
  status: CutiStatus;
  suratPath: string | null;
  catatanKeputusan: string | null;
}

// ─── Pengajuan (karyawan) ──────────────────────────────────────────────
export function useCutiSaya(userId: string | undefined) {
  return useQuery({
    queryKey: ['cuti-saya', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<CutiSaya[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('cuti')
        .select('id, tanggal_mulai, tanggal_selesai, jenis, keterangan, status, surat_path, catatan_keputusan')
        .eq('user_id', userId as string)
        .order('tanggal_mulai', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        tanggalMulai: r.tanggal_mulai,
        tanggalSelesai: r.tanggal_selesai,
        jenis: r.jenis,
        keterangan: r.keterangan,
        status: r.status,
        suratPath: r.surat_path,
        catatanKeputusan: r.catatan_keputusan,
      }));
    },
  });
}

interface AjukanCutiInput {
  userId: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jenis: CutiJenis;
  keterangan: string | null;
  suratFile: File | null;
}

export function useAjukanCuti() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AjukanCutiInput) => {
      const supabase = createClient();
      let suratPath: string | null = null;
      if (input.suratFile) {
        const ekstensi = input.suratFile.name.split('.').pop() ?? 'bin';
        suratPath = `${input.userId}/${Date.now()}-${crypto.randomUUID()}.${ekstensi}`;
        const { error: errUnggah } = await supabase.storage.from('cuti').upload(suratPath, input.suratFile);
        if (errUnggah) throw errUnggah;
      }
      const { error } = await supabase.from('cuti').insert({
        user_id: input.userId,
        tanggal_mulai: input.tanggalMulai,
        tanggal_selesai: input.tanggalSelesai,
        jenis: input.jenis,
        keterangan: input.keterangan,
        surat_path: suratPath,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cuti-saya', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['cuti-tinjau'] });
    },
  });
}

export function useSignedUrlCuti() {
  return useMutation({
    mutationFn: async ({ path, umurDetik = 60 }: { path: string; umurDetik?: number }) => {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from('cuti').createSignedUrl(path, umurDetik);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

// ─── Tinjau (ceo / is_hrd_kadiv) ────────────────────────────────────────
export interface CutiTinjau {
  id: string;
  userNama: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  jenis: CutiJenis;
  keterangan: string | null;
  suratPath: string | null;
}

export function useAntreanTinjauCuti() {
  return useQuery({
    queryKey: ['cuti-tinjau'],
    queryFn: async (): Promise<CutiTinjau[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('cuti')
        .select('id, tanggal_mulai, tanggal_selesai, jenis, keterangan, surat_path, user:user_id(nama)')
        .eq('status', 'diajukan')
        .order('tanggal_mulai', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        userNama: (r.user as unknown as { nama: string } | null)?.nama ?? '—',
        tanggalMulai: r.tanggal_mulai,
        tanggalSelesai: r.tanggal_selesai,
        jenis: r.jenis,
        keterangan: r.keterangan,
        suratPath: r.surat_path,
      }));
    },
  });
}

export function usePutuskanCuti() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, disetujui, catatan }: { id: string; disetujui: boolean; catatan: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('putuskan_cuti', { p_id: id, p_disetujui: disetujui, p_catatan: catatan });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cuti-tinjau'] }),
  });
}

// ─── Rekap untuk panel otomatis "Absensi Hari Ini" (form hrd) ──────────
// Cuti yang DISETUJUI dan mencakup `tanggal` -- dipakai LaporForm.tsx supaya
// HRD tidak mengetik ulang sakit/izin/cuti yang sudah tercatat lewat
// halaman /cuti. Boleh dibaca is_hrd_kadiv()/ceo lewat RLS cuti_select yang
// sama dipakai halaman tinjau -- tidak perlu view/RPC terpisah.
export interface CutiUntukTanggal {
  jenis: CutiJenis;
  nama: string;
}

export function useCutiUntukTanggal(tanggal: string, enabled = true) {
  return useQuery({
    queryKey: ['cuti-untuk-tanggal', tanggal],
    enabled,
    queryFn: async (): Promise<CutiUntukTanggal[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('cuti')
        .select('jenis, user:user_id(nama)')
        .eq('status', 'disetujui')
        .lte('tanggal_mulai', tanggal)
        .gte('tanggal_selesai', tanggal);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        jenis: r.jenis,
        nama: (r.user as unknown as { nama: string } | null)?.nama ?? '—',
      }));
    },
  });
}
