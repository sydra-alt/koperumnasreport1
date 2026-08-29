'use client';

import Link from 'next/link';
import { useAuth } from '../../lib/auth/AuthProvider';
import { formRegistry } from '../../forms';
import { tabTerlihat, tabLuapan } from '../../lib/navUtama';

/**
 * Halaman "Akun" -- slot terakhir nav bawah (§2 06-RENCANA-PRESENSI-MOBILE.md).
 * Selain profil & Keluar, ini JUGA tempat "luapan" tab yang berhak dibuka
 * user tapi kalah prioritas di nav bawah (mis. CEO tetap bisa buka Marketing
 * & Admin, cuma tidak dapat slot di antara 5 tombol) -- supaya tidak ada
 * halaman yang jadi tidak terjangkau sama sekali gara-gara batas 5 tombol.
 */
export default function AkunPage() {
  const { profile, roles, assignments, signOut } = useAuth();
  const semua = tabTerlihat(roles, assignments, formRegistry);
  const luapan = tabLuapan(semua);

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
        Akun
      </h1>

      <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
        <p style={{ fontFamily: 'var(--display)' }}>{profile?.nama ?? '—'}</p>
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          {profile?.jabatan ?? '—'} · {profile?.divisi ?? '—'}
        </p>
        <p className="text-sm" style={{ color: 'var(--biru-3)' }}>
          Peran: {roles.length > 0 ? roles.join(', ') : '—'}
        </p>
      </div>

      {luapan.length > 0 && (
        <div className="flex flex-col gap-2">
          <p style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
            Lainnya
          </p>
          {luapan.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className="border p-3"
              style={{ borderColor: 'var(--garis)', minHeight: 48 }}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => void signOut()}
        className="border px-4 py-3"
        style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 48, alignSelf: 'flex-start' }}
      >
        Keluar
      </button>
    </main>
  );
}
