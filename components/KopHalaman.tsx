'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth/AuthProvider';
import { formRegistry } from '../forms';
import { tabLaporDinamis } from '../lib/navLapor';
import { tanggalIndonesiaWIB } from '../lib/tanggal';

interface Tab {
  label: string;
  href: string;
  peran: string | string[] | null; // null = selalu tampil untuk yang sudah login
}

const TAB_TETAP: Tab[] = [
  { label: 'Beranda', href: '/', peran: null },
  { label: 'Laporan Saya', href: '/riwayat', peran: null },
  { label: 'Lapor', href: '/lapor/personal_marketing', peran: 'karyawan' },
  { label: 'Papan Kontrol', href: '/papan', peran: ['ceo', 'pusat'] },
  { label: 'Keputusan', href: '/keputusan', peran: 'ceo' },
  { label: 'Marketing', href: '/marketing', peran: ['kontrol_marketing', 'ceo', 'pusat'] },
  { label: 'Terpusat', href: '/terpusat', peran: ['pusat', 'ceo'] },
  { label: 'Admin', href: '/admin', peran: 'ceo' },
];

export function KopHalaman() {
  const { roles, session, signOut, assignments } = useAuth();
  const pathname = usePathname();

  if (!session) return null;

  const tabTetapTerlihat = TAB_TETAP.filter(
    (tab) => tab.peran === null || (Array.isArray(tab.peran) ? tab.peran : [tab.peran]).some((p) => roles.includes(p)),
  );

  // Tab "Lapor ..." untuk form ber-scope lokasi/outlet/global dibangun dari
  // tabel `assignment` lewat `tabLaporDinamis()` (lib/navLapor.ts) -- SATU
  // SUMBER dengan Papan Kontrol nanti (Task 18), bukan daftar tetap di kode.
  // Menambah baris assignment baru (lewat admin, Task 23) langsung
  // memunculkan tab begitu sesi/assignments dimuat ulang, tanpa deploy.
  const tabTerlihat: Tab[] = [
    ...tabTetapTerlihat,
    ...tabLaporDinamis(assignments, formRegistry).map((t) => ({ ...t, peran: null })),
  ];

  return (
    <header className="border-b" style={{ borderColor: 'var(--tinta)', borderWidth: 1.5, background: 'var(--kertas-2)' }}>
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
        {tabTerlihat.map((tab) => {
          const aktif = pathname === tab.href;
          return (
            <Link
              key={tab.href}
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
  );
}
