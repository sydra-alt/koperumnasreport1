'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth/AuthProvider';
import { formRegistry } from '../forms';
import { tabTerlihat, tabBawah } from '../lib/navUtama';
import { tanggalIndonesiaWIB } from '../lib/tanggal';

/**
 * Nav atas (layar lebar) dan nav bawah (layar sempit, §2
 * 06-RENCANA-PRESENSI-MOBILE.md) SATU komponen -- keduanya butuh sesi/peran
 * yang sama, dan CSS (`.nav-atas`/`.nav-bawah`, `app/globals.css`) yang
 * menentukan mana yang benar-benar terlihat lewat media query, bukan JS.
 * Ini menghindari dua kali `useAuth()`/dua kali pengecekan sesi kosong.
 */
export function KopHalaman() {
  const { roles, session, signOut, assignments, profile } = useAuth();
  const pathname = usePathname();

  if (!session) return null;

  const semua = tabTerlihat(roles, assignments, formRegistry, profile?.divisi ?? null);
  const bawah = tabBawah(semua);

  return (
    <>
      <header className="nav-atas border-b" style={{ borderColor: 'var(--tinta)', borderWidth: 1.5, background: 'var(--kertas-2)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div>
            <div className="text-lg" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
              Koperumnas Group
            </div>
            <div
              className="text-sm"
              style={{ fontFamily: 'var(--mono)', color: 'var(--biru-3)' }}
              suppressHydrationWarning
            >
              {tanggalIndonesiaWIB()}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="border px-3"
            style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 44 }}
          >
            Keluar
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t px-2 py-1" style={{ borderColor: 'var(--garis)' }}>
          {semua.map((tab) => {
            const aktif = pathname === tab.href;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className="flex shrink-0 items-center px-3 text-sm"
                style={{
                  minHeight: 44,
                  fontFamily: 'var(--display)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: aktif ? 'var(--kertas-2)' : 'var(--biru)',
                  background: aktif ? 'var(--biru)' : 'transparent',
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <nav className="nav-bawah" aria-label="Navigasi utama">
        {bawah.map((tab) => {
          const aktif = pathname === tab.href;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="flex flex-1 flex-col items-center justify-center text-center text-xs"
              style={{
                minHeight: 'var(--tinggi-nav-bawah)',
                fontFamily: 'var(--display)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                color: aktif ? 'var(--biru)' : 'var(--tinta)',
                background: aktif ? 'var(--kertas)' : 'transparent',
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
