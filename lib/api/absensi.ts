'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../supabase/client';
import { tanggalWIB } from '../tanggal';
import type { TitikAbsen } from '../absen';

// ─── Titik yang ditugaskan ke user ini ────────────────────────────────
export function useTitikAbsenSaya(userId: string | undefined) {
  return useQuery({
    queryKey: ['titik-absen-saya', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<TitikAbsen[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('penugasan_absen')
        .select('jam_masuk, jam_pulang, lokasi_absen:lokasi_absen_id(id, nama, latitude, longitude, radius_meter, aktif)')
        .eq('user_id', userId as string);
      if (error) throw error;
      return (data ?? [])
        .map((r) => {
          const t = r.lokasi_absen as unknown as {
            id: string;
            nama: string;
            latitude: number;
            longitude: number;
            radius_meter: number;
            aktif: boolean;
          } | null;
          if (!t || !t.aktif) return null;
          return {
            id: t.id,
            nama: t.nama,
            latitude: t.latitude,
            longitude: t.longitude,
            radiusMeter: t.radius_meter,
            jamMasuk: r.jam_masuk,
            jamPulang: r.jam_pulang,
          };
        })
        .filter((t): t is TitikAbsen => t !== null);
    },
  });
}

// ─── Absensi hari ini (masuk & pulang, kalau ada) ─────────────────────
export interface AbsensiHariIni {
  tipe: 'masuk' | 'pulang';
  waktu: string;
  status: 'valid' | 'di_luar_radius' | 'manual_hrd';
  jarakMeter: number | null;
  terlambatMenit: number | null;
  lokasiNama: string | null;
}

export function useAbsenHariIni(userId: string | undefined) {
  return useQuery({
    queryKey: ['absen-hari-ini', userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<AbsensiHariIni[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('absensi')
        .select('tipe, waktu, status, jarak_meter, terlambat_menit, lokasi_absen:lokasi_absen_id(nama)')
        .eq('user_id', userId as string)
        .eq('tanggal', tanggalWIB());
      if (error) throw error;
      return (data ?? []).map((r) => ({
        tipe: r.tipe,
        waktu: r.waktu,
        status: r.status,
        jarakMeter: r.jarak_meter,
        terlambatMenit: r.terlambat_menit,
        lokasiNama: (r.lokasi_absen as unknown as { nama: string } | null)?.nama ?? null,
      }));
    },
  });
}

// ─── Kirim absen (unggah foto + insert baris) ─────────────────────────
interface KirimAbsenInput {
  tipe: 'masuk' | 'pulang';
  lokasiAbsenId: string;
  lat: number;
  lon: number;
  akurasi: number;
  jarak: number;
  status: 'valid' | 'di_luar_radius';
  terlambatMenit: number | null;
  fotoBlob: Blob;
}

async function unggahFotoAbsen(userId: string, blob: Blob, accessToken: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error('Konfigurasi Supabase belum lengkap.');

  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.jpg`;
  const res = await fetch(`${supabaseUrl}/storage/v1/object/absensi/${path}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'false',
    },
    body: blob,
  });
  if (!res.ok) {
    const teks = await res.text().catch(() => '');
    throw new Error(`Unggah foto gagal (${res.status}): ${teks || 'kesalahan server'}`);
  }
  return path;
}

export function useKirimAbsen(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: KirimAbsenInput) => {
      if (!userId) throw new Error('Belum masuk.');
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Belum masuk.');

      const fotoPath = await unggahFotoAbsen(userId, input.fotoBlob, session.access_token);

      const { error } = await supabase.from('absensi').insert({
        user_id: userId,
        tanggal: tanggalWIB(),
        tipe: input.tipe,
        lokasi_absen_id: input.lokasiAbsenId,
        latitude: input.lat,
        longitude: input.lon,
        akurasi_meter: input.akurasi,
        jarak_meter: input.jarak,
        status: input.status,
        foto_path: fotoPath,
        terlambat_menit: input.terlambatMenit,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['absen-hari-ini', userId] });
    },
  });
}

// ─── Tinjau Absensi (HRD/pusat/ceo) ────────────────────────────────────
export interface AbsensiTinjau {
  id: string;
  userNama: string;
  tanggal: string;
  tipe: 'masuk' | 'pulang';
  waktu: string;
  jarakMeter: number | null;
  akurasiMeter: number | null;
  lokasiNama: string | null;
  fotoPath: string;
  keputusanHrd: 'diterima' | 'ditolak' | null;
  catatan: string | null;
}

export function useAntreanTinjauAbsen() {
  return useQuery({
    queryKey: ['absen-tinjau'],
    queryFn: async (): Promise<AbsensiTinjau[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('absensi')
        .select(
          'id, tanggal, tipe, waktu, jarak_meter, akurasi_meter, foto_path, keputusan_hrd, catatan, user:user_id(nama), lokasi_absen:lokasi_absen_id(nama)',
        )
        .eq('status', 'di_luar_radius')
        .is('keputusan_hrd', null)
        .order('waktu', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        userNama: (r.user as unknown as { nama: string } | null)?.nama ?? '—',
        tanggal: r.tanggal,
        tipe: r.tipe,
        waktu: r.waktu,
        jarakMeter: r.jarak_meter,
        akurasiMeter: r.akurasi_meter,
        lokasiNama: (r.lokasi_absen as unknown as { nama: string } | null)?.nama ?? null,
        fotoPath: r.foto_path,
        keputusanHrd: r.keputusan_hrd,
        catatan: r.catatan,
      }));
    },
  });
}

export function usePutuskanAbsensi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, diterima, catatan }: { id: string; diterima: boolean; catatan: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('putuskan_absensi', { p_id: id, p_diterima: diterima, p_catatan: catatan });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absen-tinjau'] }),
  });
}

export function useSignedUrlAbsensi() {
  return useMutation({
    mutationFn: async ({ path, umurDetik = 60 }: { path: string; umurDetik?: number }) => {
      const supabase = createClient();
      const { data, error } = await supabase.storage.from('absensi').createSignedUrl(path, umurDetik);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
