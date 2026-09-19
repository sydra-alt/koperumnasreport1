'use client';

import { useState, useRef, useEffect } from 'react';
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

/**
 * Nav atas (layar lebar) dan nav bawah (layar sempit, §2
 * 06-RENCANA-PRESENSI-MOBILE.md) SATU komponen -- keduanya butuh sesi/peran
 * yang sama, dan CSS (`.nav-atas`/`.nav-bawah`, `app/globals.css`) yang
 * menentukan mana yang benar-benar terlihat lewat media query, bukan JS.
 * Ini menghindari dua kali `useAuth()`/dua kali pengecekan sesi kosong.
 */
export function KopHalaman() {
  const { roles, session, signOut, assignments, profile, loading } = useAuth();
  const pathname = usePathname();
  // Tombol bundar Absen (30 Agustus 2026) cuma tampil untuk yang PUNYA
  // penugasan presensi -- "jangan tampilkan tombol yang tidak berlaku
  // untuknya" (instruksi eksplisit user). Dicek di sini (bukan cuma di
  // dalam AbsenFab) karena `tabBawah()`/`tabLuapan()` juga perlu tahu ini
  // buat menentukan 2 atau 3 slot tab biasa yang tersisa.
  const { data: titikSaya } = useTitikAbsenSaya(session?.user.id);
  const punyaTitikAbsen = (titikSaya?.length ?? 0) > 0;

  const [menuLainnyaTerbuka, setMenuLainnyaTerbuka] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuLainnyaTerbuka(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuLainnyaTerbuka(false);
      }
    }
    if (menuLainnyaTerbuka) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuLainnyaTerbuka]);

  // /masuk dan /ganti-password BERDIRI SENDIRI, tanpa kerangka aplikasi
  // (instruksi eksplisit user, 30 Agustus 2026 -- bug: nav akun lama masih
  // terlihat di /masuk setelah logout). Dicek lebih dulu, sebelum `loading`/
  // `!session`, supaya dua halaman ini TIDAK PERNAH menampilkan nav apa pun
  // apa pun status sesinya. `loading`/`!session` di bawah menutup sisanya --
  // "lebih baik kosong sesaat daripada menampilkan menu yang salah".
  if (pathname === '/masuk' || pathname === '/ganti-password') return null;
  if (loading || !session) return null;

  const semua = tabTerlihat(roles, assignments, formRegistry, profile?.divisi ?? null);
  const bawah = tabBawah(semua, punyaTitikAbsen);
  // FAB disisipkan di TENGAH -- 2 tab kiri (Beranda + 1 prioritas), 2 tab
  // kanan (1 prioritas + Akun) kalau tombolnya tampil; kalau tidak, `bawah`
  // sudah berisi 5 tab biasa (Beranda+3+Akun) dan tidak dipotong sama sekali.
  const bawahKiri = punyaTitikAbsen ? bawah.slice(0, 2) : bawah;
  const bawahKanan = punyaTitikAbsen ? bawah.slice(2) : [];

  // Grouping TopNav Desktop jika tab > 7 agar navbar rapi dan tidak berdesakan
  const UTAMA_KEYS = ['beranda', 'papan', 'keputusan', 'keuangan', 'marketing', 'terpusat', 'riwayat'];
  const perluGrouping = semua.length > 7;
  const tabUtama = perluGrouping
    ? UTAMA_KEYS.map((k) => semua.find((t) => t.key === k)).filter((t): t is TabNav => Boolean(t))
    : semua;
  const tabLainnya = perluGrouping
    ? semua.filter((t) => !tabUtama.some((u) => u.key === t.key))
    : [];

  // Deteksi jika route saat ini ada di dalam tab sekunder (Lainnya)
  const tabLainnyaAktif = tabLainnya.find((t) => pathname === t.href || pathname.startsWith(t.href + '/'));

  return (
    <>
      <header className="nav-atas border-b border-[var(--garis)] bg-white/95 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-koperumnas.jpg"
              alt=""
              width={32}
              height={32}
              className="rounded-lg border border-[var(--garis)] shadow-2xs"
            />
            <div className="flex items-center gap-3">
              <span className="text-base font-bold tracking-tight text-[var(--biru)]" style={{ fontFamily: 'var(--display)' }}>
                Koperumnas Group
              </span>
              <span
                className="hidden items-center gap-1.5 rounded-full border border-[var(--garis)] bg-[var(--halaman)] px-3 py-0.5 text-xs font-medium text-[var(--label)] sm:inline-flex"
                suppressHydrationWarning
              >
                {tanggalIndonesiaWIB()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {profile?.nama && (
              <div className="hidden items-center gap-2 lg:flex">
                <span className="text-xs font-semibold text-[var(--tinta)]">
                  {profile.nama}
                </span>
                {profile.divisi && (
                  <span className="rounded-full border border-[var(--biru-garis)] bg-[var(--biru-lembut)] px-2 py-0.5 text-[11px] font-medium text-[var(--biru)]">
                    {profile.divisi}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex cursor-pointer items-center justify-center rounded-full border border-[var(--garis)] px-3.5 py-1.5 text-xs font-medium text-[var(--label)] transition-all hover:border-[var(--merah-garis)] hover:bg-[var(--merah-lembut)] hover:text-[var(--merah)]"
            >
              Keluar
            </button>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 overflow-visible border-t border-[var(--garis)] bg-[var(--permukaan)] px-6 py-2">
          {tabUtama.map((tab) => {
            const aktif = pathname === tab.href;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  aktif
                    ? 'bg-[var(--biru)] text-white shadow-xs'
                    : 'text-[var(--label)] hover:bg-[var(--biru-lembut)] hover:text-[var(--biru)]'
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
                type="button"
                onClick={() => setMenuLainnyaTerbuka((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  tabLainnyaAktif
                    ? 'bg-[var(--biru-lembut)] text-[var(--biru)] border border-[var(--biru-garis)]'
                    : 'text-[var(--label)] hover:bg-[var(--biru-lembut)] hover:text-[var(--biru)]'
                }`}
                style={{ fontFamily: 'var(--display)' }}
                aria-expanded={menuLainnyaTerbuka}
                aria-haspopup="true"
              >
                <span>{tabLainnyaAktif ? `Menu: ${tabLainnyaAktif.label}` : 'Lainnya'}</span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-200 ${menuLainnyaTerbuka ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {menuLainnyaTerbuka && (
                <div className="absolute top-full left-0 mt-2 z-50 min-w-[220px] rounded-2xl border border-[var(--garis)] bg-white p-2 shadow-lg ring-1 ring-black/5 animate-in fade-in-50 zoom-in-95">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--label)] border-b border-[var(--garis)] mb-1">
                    Fitur &amp; Penugasan Lainnya
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {tabLainnya.map((tab) => {
                      const aktif = pathname === tab.href;
                      return (
                        <Link
                          key={tab.key}
                          href={tab.href}
                          onClick={() => setMenuLainnyaTerbuka(false)}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                            aktif
                              ? 'bg-[var(--biru-lembut)] font-semibold text-[var(--biru)]'
                              : 'text-[var(--tinta)] hover:bg-[var(--halaman)] hover:text-[var(--biru)]'
                          }`}
                        >
                          <NavIcon nama={ikonUntukTab(tab.key)} size={16} />
                          <span>{tab.label}</span>
                          {aktif && <span className="ml-auto size-1.5 rounded-full bg-[var(--biru)]" />}
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
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-center transition-transform active:scale-95"
      style={{
        minHeight: 'var(--tinggi-nav-bawah)',
        fontFamily: 'var(--display)',
      }}
    >
      <span
        className={`flex items-center justify-center rounded-full px-3 py-1 transition-all ${
          aktif ? 'bg-[var(--biru-lembut)] text-[var(--biru)]' : 'text-[var(--label)]'
        }`}
      >
        <NavIcon nama={ikonUntukTab(tab.key)} size={20} />
      </span>
      <span
        className={`text-[10px] tracking-tight transition-colors ${
          aktif ? 'font-semibold text-[var(--biru)]' : 'font-medium text-[var(--label)]'
        }`}
      >
        {tab.label}
      </span>
    </Link>
  );
}
