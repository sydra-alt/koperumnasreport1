'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../supabase/client';

/**
 * Task 23 -- CRUD admin. Enam entitas (`profile`, `role`, `assignment`,
 * `lokasi`, `outlet`, `policy`) SEMUANYA lewat klien browser biasa, BUKAN
 * lewat Route Handler/service_role -- CEO sudah punya akses tulis penuh ke
 * semuanya lewat RLS `*_admin` (`has_role('ceo')`, 0002_rls.sql), jadi
 * service_role di sini akan jadi hak istimewa yang tidak perlu. **Kecuali
 * membuat pengguna BARU** (baris `auth.users`) -- itu API Auth Admin,
 * bukan tabel biasa, RLS tidak berlaku sama sekali di situ, satu-satunya
 * yang WAJIB lewat Route Handler + `service_role` (`app/api/admin/user/route.ts`).
 */

// ─── Lokasi ────────────────────────────────────────────────────────────
export interface LokasiRow {
  id: string;
  nama: string;
  aktif: boolean;
}

export function useDaftarLokasiAdmin() {
  return useQuery({
    queryKey: ['admin-lokasi'],
    queryFn: async (): Promise<LokasiRow[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('lokasi').select('id, nama, aktif').order('nama');
      if (error) throw error;
      return data;
    },
  });
}

export function useTambahLokasi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nama: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('lokasi').insert({ nama });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-lokasi'] }),
  });
}

export function useUbahAktifLokasi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aktif }: { id: string; aktif: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase.from('lokasi').update({ aktif }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-lokasi'] }),
  });
}

// ─── Outlet ────────────────────────────────────────────────────────────
export interface OutletRowAdmin {
  id: string;
  nama: string;
  aktif: boolean;
}

export function useDaftarOutletAdmin() {
  return useQuery({
    queryKey: ['admin-outlet'],
    queryFn: async (): Promise<OutletRowAdmin[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('outlet').select('id, nama, aktif').order('nama');
      if (error) throw error;
      return data;
    },
  });
}

export function useTambahOutlet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (nama: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('outlet').insert({ nama });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-outlet'] }),
  });
}

export function useUbahAktifOutlet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, aktif }: { id: string; aktif: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase.from('outlet').update({ aktif }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-outlet'] }),
  });
}

// ─── Assignment ────────────────────────────────────────────────────────
export interface AssignmentRowAdmin {
  id: string;
  userId: string;
  userNama: string;
  formKey: string;
  lokasiNama: string | null;
  outletNama: string | null;
  shift: string | null;
}

export function useDaftarAssignmentAdmin() {
  return useQuery({
    queryKey: ['admin-assignment'],
    queryFn: async (): Promise<AssignmentRowAdmin[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('assignment')
        .select('id, form_key, shift, user:user_id(id, nama), lokasi:lokasi_id(nama), outlet:outlet_id(nama)')
        .order('form_key');
      if (error) throw error;
      return (data ?? []).map((r) => {
        const user = r.user as unknown as { id: string; nama: string } | null;
        const lokasi = r.lokasi as unknown as { nama: string } | null;
        const outlet = r.outlet as unknown as { nama: string } | null;
        return {
          id: r.id,
          userId: user?.id ?? '',
          userNama: user?.nama ?? '—',
          formKey: r.form_key,
          lokasiNama: lokasi?.nama ?? null,
          outletNama: outlet?.nama ?? null,
          shift: r.shift,
        };
      });
    },
  });
}

export function useTambahAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (baris: { userId: string; formKey: string; lokasiId?: string | null; outletId?: string | null; shift?: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase.from('assignment').insert({
        user_id: baris.userId,
        form_key: baris.formKey,
        lokasi_id: baris.lokasiId ?? null,
        outlet_id: baris.outletId ?? null,
        shift: baris.shift ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['papan-hari-ini'] });
    },
  });
}

export function useHapusAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { error } = await supabase.from('assignment').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['papan-hari-ini'] });
    },
  });
}

// ─── Policy ────────────────────────────────────────────────────────────
export interface PolicyRowAdmin {
  key: string;
  value: unknown;
}

export function useDaftarPolicyAdmin() {
  return useQuery({
    queryKey: ['admin-policy'],
    queryFn: async (): Promise<PolicyRowAdmin[]> => {
      const supabase = createClient();
      const { data, error } = await supabase.from('policy').select('key, value').order('key');
      if (error) throw error;
      return data;
    },
  });
}

export function useUbahPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const supabase = createClient();
      const { error } = await supabase.from('policy').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-policy'] });
      queryClient.invalidateQueries({ queryKey: ['policy'] });
    },
  });
}

// ─── Profile + role (listing, dan ubah role) ──────────────────────────
export interface ProfilDenganRole {
  id: string;
  nama: string;
  jabatan: string | null;
  divisi: string | null;
  aktif: boolean;
  roles: string[];
}

export function useDaftarProfilDenganRole() {
  return useQuery({
    queryKey: ['admin-profil-role'],
    queryFn: async (): Promise<ProfilDenganRole[]> => {
      const supabase = createClient();
      const [{ data: profil, error: errProfil }, { data: role, error: errRole }] = await Promise.all([
        supabase.from('profile').select('id, nama, jabatan, divisi, aktif').order('nama'),
        supabase.from('role').select('user_id, role'),
      ]);
      if (errProfil) throw errProfil;
      if (errRole) throw errRole;
      return (profil ?? []).map((p) => ({
        ...p,
        roles: (role ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });
}

const DAFTAR_ROLE = ['ceo', 'pusat', 'accounting', 'kontrol_marketing', 'kadiv', 'pic_lokasi', 'manager_resto', 'karyawan'] as const;
export { DAFTAR_ROLE };

export function useTambahRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from('role').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-profil-role'] }),
  });
}

export function useHapusRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from('role').delete().eq('user_id', userId).eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-profil-role'] }),
  });
}

// ─── Buat pengguna baru -- SATU-SATUNYA yang lewat Route Handler ──────
export interface BuatPenggunaInput {
  email: string;
  password: string;
  nama: string;
  jabatan?: string;
  divisi?: string;
  roles: string[];
}

export function useBuatPengguna() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BuatPenggunaInput) => {
      const res = await fetch('/api/admin/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const hasil = await res.json();
      if (!res.ok) throw new Error(hasil.error ?? 'Gagal membuat pengguna.');
      return hasil as { id: string };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-profil-role'] }),
  });
}

// ─── Titik Absen + siapa absen di mana (presensi, docs/06 §3) ────────
// Sama pola dengan Lokasi/Outlet/Assignment di atas -- CEO sudah punya
// akses tulis penuh lewat RLS `lokasi_absen_admin`/`penugasan_absen_admin`
// (has_role('ceo')), TIDAK ada Route Handler baru. Jam kerja per orang
// PENGECUALIAN -- lewat RPC atur_jam_kerja() (bisa dipanggil ceo/pusat/
// kadiv-HRD, bukan cuma ceo), bukan update tabel langsung.
export interface LokasiAbsenRowAdmin {
  id: string;
  nama: string;
  latitude: number;
  longitude: number;
  radiusMeter: number;
  aktif: boolean;
}

export function useDaftarLokasiAbsenAdmin() {
  return useQuery({
    queryKey: ['admin-lokasi-absen'],
    queryFn: async (): Promise<LokasiAbsenRowAdmin[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('lokasi_absen')
        .select('id, nama, latitude, longitude, radius_meter, aktif')
        .order('nama');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        nama: r.nama,
        latitude: r.latitude,
        longitude: r.longitude,
        radiusMeter: r.radius_meter,
        aktif: r.aktif,
      }));
    },
  });
}

export function useTambahLokasiAbsen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (baris: { nama: string; latitude: number; longitude: number; radiusMeter: number }) => {
      const supabase = createClient();
      const { error } = await supabase.from('lokasi_absen').insert({
        nama: baris.nama,
        latitude: baris.latitude,
        longitude: baris.longitude,
        radius_meter: baris.radiusMeter,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-lokasi-absen'] }),
  });
}

export function useUbahLokasiAbsen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (baris: { id: string; nama: string; latitude: number; longitude: number; radiusMeter: number; aktif: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('lokasi_absen')
        .update({ nama: baris.nama, latitude: baris.latitude, longitude: baris.longitude, radius_meter: baris.radiusMeter, aktif: baris.aktif })
        .eq('id', baris.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-lokasi-absen'] }),
  });
}

export interface PenugasanAbsenRowAdmin {
  userId: string;
  userNama: string;
  lokasiAbsenId: string;
  lokasiAbsenNama: string;
  jamMasuk: string | null;
  jamPulang: string | null;
}

export function useDaftarPenugasanAbsenAdmin() {
  return useQuery({
    queryKey: ['admin-penugasan-absen'],
    queryFn: async (): Promise<PenugasanAbsenRowAdmin[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('penugasan_absen')
        .select('user_id, lokasi_absen_id, jam_masuk, jam_pulang, user:user_id(nama), lokasi_absen:lokasi_absen_id(nama)');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        userId: r.user_id,
        userNama: (r.user as unknown as { nama: string } | null)?.nama ?? '—',
        lokasiAbsenId: r.lokasi_absen_id,
        lokasiAbsenNama: (r.lokasi_absen as unknown as { nama: string } | null)?.nama ?? '—',
        jamMasuk: r.jam_masuk,
        jamPulang: r.jam_pulang,
      }));
    },
  });
}

export function useTambahPenugasanAbsen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (baris: { userId: string; lokasiAbsenId: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from('penugasan_absen').insert({ user_id: baris.userId, lokasi_absen_id: baris.lokasiAbsenId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-penugasan-absen'] }),
  });
}

export function useHapusPenugasanAbsen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (baris: { userId: string; lokasiAbsenId: string }) => {
      const supabase = createClient();
      const { error } = await supabase.from('penugasan_absen').delete().eq('user_id', baris.userId).eq('lokasi_absen_id', baris.lokasiAbsenId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-penugasan-absen'] }),
  });
}

export function useAturJamKerja() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (baris: { userId: string; lokasiAbsenId: string; jamMasuk: string | null; jamPulang: string | null }) => {
      const supabase = createClient();
      const { error } = await supabase.rpc('atur_jam_kerja', {
        p_user_id: baris.userId,
        p_lokasi_absen_id: baris.lokasiAbsenId,
        p_jam_masuk: baris.jamMasuk,
        p_jam_pulang: baris.jamPulang,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-penugasan-absen'] }),
  });
}

// ─── Atur ulang kata sandi -- juga lewat Route Handler + service_role ─
// Satu-satunya jalan reset password di sistem ini (docs/07-CATATAN-
// PELUNCURAN.md) -- tidak ada alur "lupa password" mandiri lewat email.
export function useAturUlangKataSandi() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/user/${userId}/reset-password`, { method: 'POST' });
      const hasil = await res.json();
      if (!res.ok) throw new Error(hasil.error ?? 'Gagal mengatur ulang kata sandi.');
      return hasil as { password: string };
    },
  });
}
