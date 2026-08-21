'use client';

import { useAuth } from '../lib/auth/AuthProvider';

export default function Home() {
  const { profile, roles, loading } = useAuth();

  return (
    <main className="flex min-h-svh flex-col gap-4 p-6">
      <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
        Beranda
      </h1>
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <>
          <p>Masuk sebagai: {profile?.nama ?? '(profil belum termuat)'}</p>
          <p>Peran: {roles.length > 0 ? roles.join(', ') : '(belum ada peran)'}</p>
        </>
      )}
    </main>
  );
}
