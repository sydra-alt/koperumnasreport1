'use client';

import { useState, useRef, useEffect, useId } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth/AuthProvider';
import { formRegistry } from '../forms';
import { tabTerlihat, tabBawah, type TabNav } from '../lib/navUtama';
import { tanggalIndonesiaWIB } from '../lib/tanggal';
import { useTitikAbsenSaya } from '../lib/api/absensi';
import { NavIcon, ikonUntukTab } from './NavIcon';
import { AbsenFab } from './AbsenFab';
import { usePolicy } from '../lib/api/policy';
import { marketingAktif } from '../lib/marketing';

/**
 * Navigasi utama Koperumnas:
 * - Desktop: navigasi atas dengan dropdown Lainnya.
 * - Mobile: navigasi bawah dan tombol Absen terpisah jika penugasan berlaku.
 *
 * Hak akses, urutan prioritas tab, dan keputusan tampilan mobile tetap
 * mengikuti lib/navUtama.ts. CSS .nav-atas/.nav-bawah menentukan breakpoint.
 */
export function KopHalaman() {
  const { roles, session, signOut, assignments, profile, loading } = useAuth();
  const pathname = usePathname();
  const { data: titikSaya } = useTitikAbsenSaya(session?.user.id);
  const punyaTitikAbsen = (titikSaya?.length ?? 0) > 0;

  const [menuLainnyaTerbuka, setMenuLainnyaTerbuka] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tombolLainnyaRef = useRef<HTMLButtonElement>(null);
  const idMenuLainnya = useId();

  const { data: policy } = usePolicy();

  // Tutup dropdown saat klik di luar, tekan Escape, atau berpindah halaman.
  useEffect(() => {
    if (!menuLainnyaTerbuka) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setMenuLainnyaTerbuka(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuLainnyaTerbuka(false);
        tombolLainnyaRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuLainnyaTerbuka]);

  useEffect(() => {
    setMenuLainnyaTerbuka(false);
  }, [pathname]);

  // Halaman autentikasi berdiri sendiri tanpa kerangka aplikasi.
  if (pathname === '/masuk' || pathname === '/ganti-password') return null;
  if (loading || !session) return null;

  const semua = tabTerlihat(
    roles,
    assignments,
    formRegistry,
    profile?.divisi ?? null,
    profile?.punya_akses_ai ?? false,
    marketingAktif(policy),
  );

  const bawah = tabBawah(semua, punyaTitikAbsen);
  const bawahKiri = punyaTitikAbsen ? bawah.slice(0, 2) : bawah;
  const bawahKanan = punyaTitikAbsen ? bawah.slice(2) : [];

  // Kelompokkan navigasi desktop ketika jumlah tab banyak agar tidak berdesakan.
  const UTAMA_KEYS = [
    'beranda',
    'papan',
    'keputusan',
    'keuangan',
    'marketing',
    'terpusat',
    'riwayat',
  ];
  const perluGrouping = semua.length > 7;
  const tabUtama = perluGrouping
    ? UTAMA_KEYS
      .map((key) => semua.find((tab) => tab.key === key))
      .filter((tab): tab is TabNav => Boolean(tab))
    : semua;
  const tabLainnya = perluGrouping
    ? semua.filter((tab) => !tabUtama.some((utama) => utama.key === tab.key))
    : [];

  const tabLainnyaAktif = tabLainnya.find((tab) =>
    pathCocok(pathname, tab.href),
  );

  return (
    <>
      <header className="nav-atas border-b border-white/60 bg-[var(--halaman)]/95 backdrop-blur-md shadow-[0_4px_16px_rgba(166,180,200,0.35)]">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo-koperumnas.jpg"
              alt="Koperumnas Group"
              width={34}
              height={34}
              priority
              className="shrink-0 rounded-xl border border-white/90 shadow-[var(--bayangan-neumo-sm)]"
            />
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className="text-base font-bold tracking-tight text-[var(--biru)]"
                style={{ fontFamily: 'var(--display)' }}
              >
                Koperumnas Group
              </span>
              <span
                className="hidden items-center gap-1.5 rounded-full border border-white/80 bg-[var(--permukaan)] px-3 py-1 text-xs font-semibold text-[var(--label)] shadow-[var(--bayangan-neumo-sm)] sm:inline-flex"
                suppressHydrationWarning
              >
                {tanggalIndonesiaWIB()}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {profile?.nama && (
              <div className="hidden items-center gap-2 rounded-full border border-white/80 bg-[var(--permukaan)] px-3 py-1 shadow-[var(--bayangan-neumo-sm)] lg:flex">
                <span className="text-xs font-semibold text-[var(--tinta)]">
                  {profile.nama}
                </span>
                {profile.divisi && (
                  <span className="rounded-full border border-[var(--biru-garis)] bg-[var(--biru-lembut)] px-2 py-0.5 text-[11px] font-bold text-[var(--biru)]">
                    {profile.divisi}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full border border-white/80 bg-[var(--permukaan)] px-3 py-2 text-xs font-semibold text-[var(--label)] shadow-[var(--bayangan-neumo-sm)] transition-colors hover:bg-[var(--merah-lembut)] hover:text-[var(--merah)] active:shadow-[var(--bayangan-neumo-dalam)] sm:px-4"
            >
              Keluar
            </button>
          </div>
        </div>

        <nav
          aria-label="Navigasi utama desktop"
          className="flex items-center gap-2 overflow-visible border-t border-white/60 bg-[var(--halaman)] px-4 py-2.5 lg:px-6"
        >
          {tabUtama.map((tab) => {
            const aktif = pathCocok(pathname, tab.href);
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={aktif ? 'page' : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-3 py-2 text-xs font-semibold transition-colors lg:px-4 ${aktif ? 'nav-pil-aktif' : 'nav-pil-inaktif'
                  }`}
                style={{ fontFamily: 'var(--display)' }}
              >
                {tab.label}
              </Link>
            );
          })}

          {tabLainnya.length > 0 && (
            <div className="relative ml-1 inline-flex items-center" ref={dropdownRef}>
              <button
                ref={tombolLainnyaRef}
                type="button"
                onClick={() => setMenuLainnyaTerbuka((sebelumnya) => !sebelumnya)}
                className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-colors lg:px-4 ${tabLainnyaAktif || menuLainnyaTerbuka
                    ? 'nav-pil-aktif'
                    : 'nav-pil-inaktif'
                  }`}
                style={{ fontFamily: 'var(--display)' }}
                aria-expanded={menuLainnyaTerbuka}
                aria-controls={idMenuLainnya}
              >
                <span>
                  {tabLainnyaAktif
                    ? `Menu: ${tabLainnyaAktif.label}`
                    : 'Lainnya'}
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${menuLainnyaTerbuka ? 'rotate-180' : ''
                    }`}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {menuLainnyaTerbuka && (
                <div
                  id={idMenuLainnya}
                  className="absolute left-0 top-full z-50 mt-2 min-w-[220px] rounded-2xl border border-white/90 bg-[var(--permukaan)] p-2.5 shadow-[var(--bayangan-neumo-lg)] animate-in fade-in-50 zoom-in-95"
                >
                  <div className="mb-1 border-b border-[var(--garis)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--label)]">
                    Fitur &amp; Penugasan Lainnya
                  </div>
                  <div className="flex flex-col gap-1">
                    {tabLainnya.map((tab) => {
                      const aktif = pathCocok(pathname, tab.href);
                      return (
                        <Link
                          key={tab.key}
                          href={tab.href}
                          onClick={() => setMenuLainnyaTerbuka(false)}
                          aria-current={aktif ? 'page' : undefined}
                          className={`flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${aktif
                              ? 'nav-pil-aktif'
                              : 'text-[var(--tinta)] hover:bg-[var(--permukaan-bersih)] hover:text-[var(--biru-2)] active:shadow-[var(--bayangan-neumo-dalam)]'
                            }`}
                        >
                          <NavIcon nama={ikonUntukTab(tab.key)} size={16} />
                          <span>{tab.label}</span>
                          {aktif && (
                            <span
                              className="ml-auto size-1.5 rounded-full bg-white"
                              aria-hidden="true"
                            />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>

      {/* Nav bawah: tombol Absen tetap terpisah dan hanya muncul jika berlaku. */}
      <nav className="nav-bawah" aria-label="Navigasi utama mobile">
        {bawahKiri.map((tab) => (
          <TabBawahLink
            key={tab.key}
            tab={tab}
            aktif={pathCocok(pathname, tab.href)}
          />
        ))}
        {punyaTitikAbsen && session && (
          <AbsenFab userId={session.user.id} />
        )}
        {bawahKanan.map((tab) => (
          <TabBawahLink
            key={tab.key}
            tab={tab}
            aktif={pathCocok(pathname, tab.href)}
          />
        ))}
      </nav>
    </>
  );
}

/**
 * Cocokkan rute aktif untuk halaman induk dan subhalamannya.
 * Beranda harus persis "/" agar tidak aktif pada semua rute.
 */
function pathCocok(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function TabBawahLink({
  tab,
  aktif,
}: {
  tab: TabNav;
  aktif: boolean;
}) {
  return (
    <Link
      href={tab.href}
      aria-current={aktif ? 'page' : undefined}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-center transition-transform active:scale-95 focus-visible:relative focus-visible:z-10"
      style={{
        minHeight: 'max(44px, var(--tinggi-nav-bawah))',
        fontFamily: 'var(--display)',
      }}
    >
      <span
        className={`flex items-center justify-center rounded-full border px-3.5 py-1.5 transition-colors ${aktif
            ? 'nav-pil-aktif'
            : 'border-transparent text-[var(--label)] hover:text-[var(--biru)]'
          }`}
      >
        <NavIcon nama={ikonUntukTab(tab.key)} size={20} />
      </span>
      <span
        className={`text-[10px] tracking-tight transition-colors ${aktif
            ? 'font-bold text-[var(--biru)]'
            : 'font-medium text-[var(--label)]'
          }`}
      >
        {tab.label}
      </span>
    </Link>
  );
}

