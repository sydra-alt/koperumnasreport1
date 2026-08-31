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
// Antrean 🟡 di luar radius dulu daftar TERPISAH (`useAntreanTinjauAbsen`) --
// digantikan `usePresensiUntukTanggal` di atas, yang menampilkan SEMUA
// orang (bukan cuma yang di luar radius) sekaligus membuka keputusan
// Terima/Tolak per baris lewat detail-nya (app/absen/tinjau/page.tsx,
// instruksi eksplisit user 31 Agustus 2026).
export function usePutuskanAbsensi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, diterima, catatan }: { id: string; diterima: boolean; catatan: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('putuskan_absensi', { p_id: id, p_diterima: diterima, p_catatan: catatan });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['presensi-untuk-tanggal'] }),
  });
}

// ─── Persetujuan privasi presensi (sekali seumur akun) ─────────────────
export function useSetujuiPrivasiPresensi() {
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc('setujui_privasi_presensi');
      if (error) throw error;
    },
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

// ─── Daftar presensi harian (Tinjau Absensi, ceo/pusat/HRD) ───────────────
// Satu baris per ORANG per TANGGAL (migrasi 0041 `presensi_untuk_tanggal`),
// termasuk yang BELUM absen sama sekali (jam_masuk null) -- instruksi
// eksplisit user, 31 Agustus 2026: "justru itu yang paling perlu dilihat
// HRD, jangan hilang dari daftar".
export interface PresensiHarianRow {
  userId: string;
  nama: string;
  titikNama: string | null;
  masukId: string | null;
  jamMasuk: string | null;
  /** Jam masuk yang DIPAKAI menghitung `terlambatMenit` -- per-orang (penugasan_absen.jam_masuk) atau default policy. 'HH:mm'. */
  masukJamEfektif: string | null;
  terlambatMenit: number | null;
  statusMasuk: 'valid' | 'di_luar_radius' | 'manual_hrd' | null;
  masukFotoPath: string | null;
  masukLat: number | null;
  masukLon: number | null;
  masukJarakMeter: number | null;
  masukAkurasiMeter: number | null;
  masukKeputusanHrd: 'diterima' | 'ditolak' | null;
  masukCatatan: string | null;
  pulangId: string | null;
  jamPulang: string | null;
  statusPulang: 'valid' | 'di_luar_radius' | 'manual_hrd' | null;
  pulangFotoPath: string | null;
  pulangLat: number | null;
  pulangLon: number | null;
  pulangJarakMeter: number | null;
  pulangAkurasiMeter: number | null;
  pulangKeputusanHrd: 'diterima' | 'ditolak' | null;
  pulangCatatan: string | null;
}

export function usePresensiUntukTanggal(tanggal: string) {
  return useQuery({
    queryKey: ['presensi-untuk-tanggal', tanggal],
    queryFn: async (): Promise<PresensiHarianRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('presensi_untuk_tanggal', { p_tanggal: tanggal });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        userId: r.user_id as string,
        nama: r.nama as string,
        titikNama: r.titik_nama as string | null,
        masukId: r.masuk_id as string | null,
        jamMasuk: r.jam_masuk as string | null,
        masukJamEfektif: r.masuk_jam_efektif as string | null,
        terlambatMenit: r.terlambat_menit as number | null,
        statusMasuk: r.status_masuk as PresensiHarianRow['statusMasuk'],
        masukFotoPath: r.masuk_foto_path as string | null,
        masukLat: r.masuk_lat as number | null,
        masukLon: r.masuk_lon as number | null,
        masukJarakMeter: r.masuk_jarak_meter as number | null,
        masukAkurasiMeter: r.masuk_akurasi_meter as number | null,
        masukKeputusanHrd: r.masuk_keputusan_hrd as PresensiHarianRow['masukKeputusanHrd'],
        masukCatatan: r.masuk_catatan as string | null,
        pulangId: r.pulang_id as string | null,
        jamPulang: r.jam_pulang as string | null,
        statusPulang: r.status_pulang as PresensiHarianRow['statusPulang'],
        pulangFotoPath: r.pulang_foto_path as string | null,
        pulangLat: r.pulang_lat as number | null,
        pulangLon: r.pulang_lon as number | null,
        pulangJarakMeter: r.pulang_jarak_meter as number | null,
        pulangAkurasiMeter: r.pulang_akurasi_meter as number | null,
        pulangKeputusanHrd: r.pulang_keputusan_hrd as PresensiHarianRow['pulangKeputusanHrd'],
        pulangCatatan: r.pulang_catatan as string | null,
      }));
    },
  });
}

// ─── Riwayat presensi milik SENDIRI (halaman Akun, semua karyawan) ────────
export interface PresensiSayaRow {
  tanggal: string;
  titikNama: string | null;
  jamMasuk: string | null;
  terlambatMenit: number | null;
  statusMasuk: 'valid' | 'di_luar_radius' | 'manual_hrd' | null;
  jamPulang: string | null;
  statusPulang: 'valid' | 'di_luar_radius' | 'manual_hrd' | null;
}

export function usePresensiSayaUntukBulan(bulan: string, aktif: boolean) {
  return useQuery({
    queryKey: ['presensi-saya-untuk-bulan', bulan],
    enabled: aktif,
    queryFn: async (): Promise<PresensiSayaRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('presensi_saya_untuk_bulan', { p_bulan: bulan });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        tanggal: r.tanggal as string,
        titikNama: r.titik_nama as string | null,
        jamMasuk: r.jam_masuk as string | null,
        terlambatMenit: r.terlambat_menit as number | null,
        statusMasuk: r.status_masuk as PresensiSayaRow['statusMasuk'],
        jamPulang: r.jam_pulang as string | null,
        statusPulang: r.status_pulang as PresensiSayaRow['statusPulang'],
      }));
    },
  });
}
