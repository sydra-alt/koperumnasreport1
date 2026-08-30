'use client';

import type { Session } from '@supabase/supabase-js';
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
      }
    });

    return () => {
      aktif = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? pesanErrorMasuk(error.message) : null };
  }

  async function signOut() {
    await supabase.auth.signOut();
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
