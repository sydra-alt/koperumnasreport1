'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import type { TabelAi } from '../ai/tabel';

/**
 * Data halaman Asisten AI. Baca langsung lewat klien Supabase (RLS: cuma
 * milik sendiri); kirim pertanyaan lewat POST /api/ai/chat (di sana Gemini
 * dipanggil -- kunci API tidak pernah sampai ke browser).
 */

export type PercakapanAi = { id: string; judul: string; updatedAt: string };
export type PesanAi = { id: string; peran: 'user' | 'model'; isi: string; tabel: TabelAi[] | null; createdAt: string };
/** Hasil ai_status(): aktif = policy terpasang & batas > 0; boleh = peran penanya diizinkan. */
export type StatusAi = { aktif: boolean; boleh: boolean; batas: number; terpakai: number };

type BarisPesan = { id: string; peran: 'user' | 'model'; isi: string; tabel: TabelAi[] | null; created_at: string };
const kePesan = (r: BarisPesan): PesanAi => ({ id: r.id, peran: r.peran, isi: r.isi, tabel: r.tabel, createdAt: r.created_at });

export function useStatusAi(enabled: boolean) {
  return useQuery({
    queryKey: ['ai-status'],
    enabled,
    queryFn: async (): Promise<StatusAi | null> => {
      const { data, error } = await createClient().rpc('ai_status').single<StatusAi>();
      if (error) throw error;
      return data;
    },
  });
}

export function useDaftarPercakapan(enabled: boolean) {
  return useQuery({
    queryKey: ['ai-percakapan'],
    enabled,
    queryFn: async (): Promise<PercakapanAi[]> => {
      const { data, error } = await createClient()
        .from('ai_percakapan')
        .select('id, judul, updated_at')
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.id, judul: r.judul, updatedAt: r.updated_at }));
    },
  });
}

export function usePesanPercakapan(percakapanId: string | null) {
  return useQuery({
    queryKey: ['ai-pesan', percakapanId],
    enabled: Boolean(percakapanId),
    queryFn: async (): Promise<PesanAi[]> => {
      const { data, error } = await createClient()
        .from('ai_pesan')
        .select('id, peran, isi, tabel, created_at')
        .eq('percakapan_id', percakapanId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as BarisPesan[]).map(kePesan);
    },
  });
}

export class GalatKirimAi extends Error {
  constructor(message: string, public readonly batasTercapai: boolean, public readonly percakapanId: string | null) {
    super(message);
  }
}

export function useKirimPesanAi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { percakapanId: string | null; pesan: string }) => {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new GalatKirimAi(body.error ?? 'Terjadi kesalahan. Coba lagi.', Boolean(body.batasTercapai), body.percakapanId ?? null);
      }
      return {
        percakapanId: body.percakapanId as string,
        pesanUser: kePesan(body.pesanUser as BarisPesan),
        pesanModel: kePesan(body.pesanModel as BarisPesan),
        statusAi: (body.statusAi ?? null) as StatusAi | null,
      };
    },
    onSettled: (_data, _err, input) => {
      queryClient.invalidateQueries({ queryKey: ['ai-percakapan'] });
      queryClient.invalidateQueries({ queryKey: ['ai-status'] });
      if (input.percakapanId) queryClient.invalidateQueries({ queryKey: ['ai-pesan', input.percakapanId] });
    },
  });
}

/** Outlet F&B yang boleh diimpor opname-nya (cakupan & izin dari pos-fnb). */
export function useOutletImpor(enabled: boolean) {
  return useQuery({
    queryKey: ['ai-impor-outlet'],
    enabled,
    retry: false,
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const res = await fetch('/api/asisten/impor-opname', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Daftar outlet tidak bisa dibaca.');
      return body.outlets as { id: string; name: string }[];
    },
  });
}

/** Impor opname Excel (29 September 2026, fase 2) -- satu impor = satu percakapan. */
export function useImporOpname() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { outletId: string; file: File }) => {
      const form = new FormData();
      form.set('outletId', input.outletId);
      form.set('file', input.file);
      const res = await fetch('/api/asisten/impor-opname', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new GalatKirimAi(body.error ?? 'Terjadi kesalahan. Coba lagi.', Boolean(body.batasTercapai), body.percakapanId ?? null);
      }
      return {
        percakapanId: body.percakapanId as string,
        pesanUser: kePesan(body.pesanUser as BarisPesan),
        pesanModel: kePesan(body.pesanModel as BarisPesan),
      };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-percakapan'] });
      queryClient.invalidateQueries({ queryKey: ['ai-status'] });
    },
  });
}

/** Impor resep dari Excel (29 September 2026) -- satu file untuk seluruh bisnis, tanpa pilihan outlet. */
export function useImporResep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File }) => {
      const form = new FormData();
      form.set('file', input.file);
      const res = await fetch('/api/asisten/impor-resep', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new GalatKirimAi(body.error ?? 'Terjadi kesalahan. Coba lagi.', Boolean(body.batasTercapai), body.percakapanId ?? null);
      }
      return {
        percakapanId: body.percakapanId as string,
        pesanUser: kePesan(body.pesanUser as BarisPesan),
        pesanModel: kePesan(body.pesanModel as BarisPesan),
      };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-percakapan'] });
      queryClient.invalidateQueries({ queryKey: ['ai-status'] });
    },
  });
}
