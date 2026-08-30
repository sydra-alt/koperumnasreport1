'use client';

import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { pesanErrorMasuk } from '../pesanError';
import { createClient } from '../supabase/client';

interface Profile {
  id: string;
  nama: string;
  jabatan: string | null;
  divisi: string | null;
  aktif: boolean;
  persetujuan_privasi_absen_at: string | null;
}

interface Assignment {
  id: string;
  form_key: string;
  lokasi_id: string | null;
  outlet_id: string | null;
  shift_id: string | null;
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  roles: string[];
  assignments: Assignment[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function muatProfilPeran(supabase: ReturnType<typeof createClient>, userId: string) {
  const [{ data: profileData }, { data: roleData }, { data: assignmentData }] = await Promise.all([
    supabase.from('profile').select('*').eq('id', userId).single(),
    supabase.from('role').select('role').eq('user_id', userId),
    supabase.from('assignment').select('*').eq('user_id', userId),
  ]);
  return {
    profile: (profileData as Profile | null) ?? null,
    roles: ((roleData as { role: string }[] | null) ?? []).map((r) => r.role),
    assignments: (assignmentData as Assignment[] | null) ?? [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let aktif = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!aktif) return;
      setSession(data.session);
      if (data.session) {
        const hasil = await muatProfilPeran(supabase, data.session.user.id);
        if (!aktif) return;
        setProfile(hasil.profile);
        setRoles(hasil.roles);
        setAssignments(hasil.assignments);
      }
      setLoading(false);
    });

    // sesiBaru === null menutupi DUA kasus sekaligus -- signOut() eksplisit
    // (tombol "Keluar") DAN token yang mati sendiri saat aplikasi terbuka
    // (refresh token kedaluwarsa/dicabut) -- Supabase memancarkan event yang
    // sama untuk keduanya, jadi satu penanganan di sini cukup, bukan dua
    // jalur terpisah. `queryClient.clear()` WAJIB di sini (bukan cuma di
    // `signOut()`) supaya kasus token-mati-sendiri juga bersih -- itu tidak
    // pernah melewati fungsi signOut() sama sekali (instruksi eksplisit
    // user, 30 Agustus 2026, ditemukan lewat uji browser sungguhan: nav
    // akun lama masih terlihat di /masuk setelah logout).
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, sesiBaru) => {
      setSession(sesiBaru);
      if (sesiBaru) {
        const hasil = await muatProfilPeran(supabase, sesiBaru.user.id);
        setProfile(hasil.profile);
        setRoles(hasil.roles);
        setAssignments(hasil.assignments);
      } else {
        setProfile(null);
        setRoles([]);
        setAssignments([]);
        queryClient.clear();
        setLoading(false);
      }
    });

    return () => {
      aktif = false;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `queryClient`/`router` stabil (dari provider), dependensi berlebih di sini cuma memicu resubscribe listener tanpa manfaat.
  }, [supabase]);

  // Alihkan ke /masuk begitu sesi hilang -- KECUALI sudah di /masuk atau
  // /ganti-password (dua halaman itu memang untuk orang TANPA sesi valid,
  // redirect di sana cuma bikin loop). Efek TERPISAH dari listener di atas
  // supaya pathname yang dipakai selalu yang TERBARU (listener attach cuma
  // sekali saat mount, closure-nya akan membeku ke pathname awal kalau
  // redirect ditaruh di sana).
  useEffect(() => {
    if (!loading && !session && pathname !== '/masuk' && pathname !== '/ganti-password') {
      router.replace('/masuk');
    }
  }, [loading, session, pathname, router]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? pesanErrorMasuk(error.message) : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
  }

  return (
    <AuthContext.Provider value={{ session, profile, roles, assignments, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
