'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth/AuthProvider';
import { formRegistry } from '../forms';
import { tabTerlihat, tabBawah, type TabNav } from '../lib/navUtama';
import { tanggalIndonesiaWIB } from '../lib/tanggal';
import { useTitikAbsenSaya } from '../lib/api/absensi';
import { NavIcon, ikonUntukTab } from './NavIcon';
import { AbsenFab } from './AbsenFab';

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
  // Tombol bundar Absen (30 Agustus 2026) cuma tampil untuk yang PUNYA
  // penugasan presensi -- "jangan tampilkan tombol yang tidak berlaku
  // untuknya" (instruksi eksplisit user). Dicek di sini (bukan cuma di
  // dalam AbsenFab) karena `tabBawah()`/`tabLuapan()` juga perlu tahu ini
  // buat menentukan 2 atau 3 slot tab biasa yang tersisa.
  const { data: titikSaya } = useTitikAbsenSaya(session?.user.id);
  const punyaTitikAbsen = (titikSaya?.length ?? 0) > 0;

  if (!session) return null;

  const semua = tabTerlihat(roles, assignments, formRegistry, profile?.divisi ?? null);
  const bawah = tabBawah(semua, punyaTitikAbsen);
  // FAB disisipkan di TENGAH -- 2 tab kiri (Beranda + 1 prioritas), 2 tab
  // kanan (1 prioritas + Akun) kalau tombolnya tampil; kalau tidak, `bawah`
  // sudah berisi 5 tab biasa (Beranda+3+Akun) dan tidak dipotong sama sekali.
  const bawahKiri = punyaTitikAbsen ? bawah.slice(0, 2) : bawah;
  const bawahKanan = punyaTitikAbsen ? bawah.slice(2) : [];

  return (
    <>
      <header className="nav-atas border-b" style={{ borderColor: 'var(--garis)', background: 'var(--kertas-2)' }}>
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
                  fontWeight: 500,
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

      {/* Ikon + label kecil (bukan cuma tulisan, keluhan user 30 Agustus 2026)
          -- hanya di sini, nav-atas (desktop) tetap teks seperti biasa.
          Tombol bundar Absen (kalau berlaku) disisipkan di TENGAH, di luar
          `.map()` biasa -- bukan tab yang sama tingginya, sengaja menonjol. */}
      <nav className="nav-bawah" aria-label="Navigasi utama">
        {bawahKiri.map((tab) => (
          <TabBawahLink key={tab.key} tab={tab} aktif={pathname === tab.href} />
        ))}
        {punyaTitikAbsen && session && <AbsenFab userId={session.user.id} />}
        {bawahKanan.map((tab) => (
          <TabBawahLink key={tab.key} tab={tab} aktif={pathname === tab.href} />
        ))}
      </nav>
    </>
  );
}

function TabBawahLink({ tab, aktif }: { tab: TabNav; aktif: boolean }) {
  return (
    <Link
      href={tab.href}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 text-center"
      style={{
        minHeight: 'var(--tinggi-nav-bawah)',
        fontFamily: 'var(--display)',
        fontWeight: 500,
        fontSize: 10,
        color: aktif ? 'var(--biru)' : 'var(--tinta)',
        background: aktif ? 'var(--kertas)' : 'transparent',
      }}
    >
      <NavIcon nama={ikonUntukTab(tab.key)} />
      {tab.label}
    </Link>
  );
}
