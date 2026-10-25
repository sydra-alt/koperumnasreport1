
'use client';

import type { ReactNode } from 'react';

/**
 * Kerangka muat (skeleton loading) — DESIGN-MODERN.md §M5.
 * Skeleton mengikuti bentuk konten aktual agar perubahan dari loading
 * ke halaman siap terasa stabil. Shimmer diatur oleh globals.css.
 */

type BalokProps = {
  tinggi?: number;
  lebar?: number | string;
  className?: string;
};

/** Satu balok kerangka dengan ukuran tertentu. */
function Balok({
  tinggi = 16,
  lebar = '100%',
  className = '',
}: BalokProps) {
  return (
    <div
      className={`kerangka ${className}`}
      style={{ height: tinggi, width: lebar }}
      aria-hidden="true"
    />
  );
}

/** Kartu skeleton yang memakai permukaan dan radius dari design token. */
function KartuKerangka({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`neumo-kartu flex flex-col gap-2 p-4 md:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Kerangka Beranda:
 * hero, ringkasan absensi, progres tugas, tugas utama,
 * dan baris tugas lainnya.
 */
export function KerangkaBeranda() {
  return (
    <div
      className="dashboard-halaman mx-auto flex min-h-svh w-full max-w-[1120px] flex-col gap-5 px-4 py-6 md:gap-7 md:px-8 md:py-8"
      aria-busy="true"
      aria-label="Memuat beranda"
      role="status"
    >
      {/* Hero: sapaan dan ringkasan absensi */}
      <header className="dashboard-hero neumo-kartu flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:gap-6 md:p-6">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Balok tinggi={12} lebar={100} />
          <Balok tinggi={30} lebar="min(78%, 360px)" />
        </div>

        <div className="neumo-inset flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-3 md:min-w-[340px]">
          <Balok tinggi={14} lebar={48} />
          <Balok tinggi={14} lebar={82} />
          <Balok tinggi={14} lebar={84} />
        </div>
      </header>

      {/* Daftar tugas */}
      <section
        className="flex flex-col gap-3"
        aria-label="Memuat tugas hari ini"
      >
        <div className="flex flex-col gap-2">
          <Balok tinggi={24} lebar="min(72%, 320px)" />
          <Balok tinggi={4} lebar="100%" />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Balok tinggi={14} lebar={42} />
            <Balok tinggi={14} lebar="min(45%, 190px)" />
          </div>
        </div>

        {/* Kartu tugas utama */}
        <div
          className="kartu-status rail-netral flex flex-col gap-3.5 p-5 md:p-6"
          aria-hidden="true"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Balok tinggi={12} lebar={104} />
            <Balok
              tinggi={28}
              lebar={136}
              className="!rounded-full"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Balok tinggi={22} lebar="min(76%, 390px)" />
            <Balok tinggi={14} lebar="min(48%, 240px)" />
          </div>

          <Balok
            tinggi={48}
            lebar="100%"
            className="md:!w-[180px]"
          />
        </div>

        {/* Baris tugas berikutnya */}
        <div className="panel">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="panel-baris flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center"
              aria-hidden="true"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Balok tinggi={17} lebar="min(72%, 320px)" />
                <Balok tinggi={13} lebar="min(48%, 220px)" />
                <Balok tinggi={13} lebar={112} />
              </div>

              <Balok
                tinggi={44}
                lebar="100%"
                className="sm:!w-[112px]"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Kerangka generik untuk halaman daftar kartu. */
export function KerangkaDaftarKartu({
  jumlah = 3,
}: {
  jumlah?: number;
}) {
  return (
    <div
      className="flex flex-col gap-3"
      aria-busy="true"
      aria-label="Memuat daftar"
      role="status"
    >
      {Array.from({ length: Math.max(0, jumlah) }, (_, i) => (
        <KartuKerangka key={i}>
          <Balok tinggi={16} lebar="65%" />
          <Balok tinggi={13} lebar="45%" />
          <Balok tinggi={13} lebar="30%" />
        </KartuKerangka>
      ))}
    </div>
  );
}

/** Kerangka untuk Papan Kontrol. */
export function KerangkaPapan() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-busy="true"
      aria-label="Memuat papan kontrol"
      role="status"
    >
      <div className="flex flex-col gap-3">
        <div>
          <Balok tinggi={14} lebar="30%" />
          <div className="mt-1 flex items-baseline gap-2">
            <Balok tinggi={32} lebar={60} />
            <Balok tinggi={14} lebar="35%" />
          </div>
          <div className="mt-2">
            <Balok tinggi={8} lebar="100%" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((item) => (
            <KartuKerangka key={item} className="min-w-0">
              <Balok tinggi={20} lebar={40} />
              <Balok tinggi={13} lebar="60%" />
            </KartuKerangka>
          ))}
        </div>
      </div>

      {[1, 2].map((group) => (
        <div key={group} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <Balok tinggi={20} lebar="40%" />
            <Balok tinggi={14} lebar={40} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2].map((card) => (
              <KartuKerangka key={card} className="min-w-0">
                <Balok tinggi={16} lebar="60%" />
                <Balok tinggi={13} lebar="35%" />
              </KartuKerangka>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Kerangka untuk halaman form. */
export function KerangkaForm() {
  return (
    <div
      className="flex flex-col gap-5"
      aria-busy="true"
      aria-label="Memuat form"
      role="status"
    >
      <Balok tinggi={28} lebar="50%" />
      <Balok tinggi={14} lebar="30%" />

      {[1, 2].map((block) => (
        <KartuKerangka key={block}>
          <Balok tinggi={20} lebar="45%" />

          <div className="flex flex-col gap-3">
            {[1, 2].map((field) => (
              <div key={field}>
                <Balok
                  tinggi={14}
                  lebar={field === 1 ? '30%' : '25%'}
                />
                <div className="mt-1">
                  <Balok tinggi={44} lebar="100%" />
                </div>
              </div>
            ))}
          </div>
        </KartuKerangka>
      ))}
    </div>
  );
}

/** Kerangka untuk detail laporan. */
export function KerangkaDetailLaporan() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label="Memuat laporan"
      role="status"
    >
      <Balok tinggi={28} lebar="50%" />
      <Balok tinggi={14} lebar="40%" />

      {[1, 2, 3].map((item) => (
        <div key={item} className="mt-2 flex flex-col gap-2">
          <Balok tinggi={14} lebar="25%" />
          <Balok tinggi={16} lebar="60%" />
        </div>
      ))}
    </div>
  );
}

/** Kerangka untuk tabel dashboard marketing. */
export function KerangkaTabel({
  baris = 5,
  kolom = 4,
}: {
  baris?: number;
  kolom?: number;
}) {
  const jumlahKolom = Math.max(1, kolom);
  const lebarKolom = `${100 / jumlahKolom}%`;

  return (
    <div
      className="flex flex-col gap-2 overflow-hidden"
      aria-busy="true"
      aria-label="Memuat tabel"
      role="status"
    >
      <div className="flex gap-2">
        {Array.from({ length: jumlahKolom }, (_, i) => (
          <div key={i} className="min-w-0 flex-1">
            <Balok tinggi={14} lebar="100%" />
          </div>
        ))}
      </div>

      {Array.from(
        { length: Math.max(0, baris) },
        (_, row) => (
          <div key={row} className="flex gap-2">
            {Array.from({ length: jumlahKolom }, (_, col) => (
              <div key={col} className="min-w-0 flex-1">
                <Balok tinggi={16} lebar={lebarKolom} />
              </div>
            ))}
          </div>
        ),
      )}
    </div>
  );
}

/** Kerangka untuk halaman presensi/absen. */
export function KerangkaAbsen() {
  return (
    <div
      className="flex flex-col gap-4"
      aria-busy="true"
      aria-label="Memuat halaman absen"
      role="status"
    >
      <Balok tinggi={200} lebar="100%" />
      <Balok tinggi={48} lebar="100%" />

      <div className="flex flex-col gap-2">
        <Balok tinggi={16} lebar="50%" />
        <Balok tinggi={14} lebar="35%" />
      </div>
    </div>
  );
}

/** Kerangka kecil untuk daftar presensi di halaman akun. */
export function KerangkaPresensiRingkas() {
  return (
    <div
      className="flex flex-col gap-2"
      aria-busy="true"
      aria-label="Memuat presensi"
      role="status"
    >
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="neumo-kartu flex flex-col gap-1 p-3"
        >
          <Balok tinggi={16} lebar="45%" />
          <Balok tinggi={13} lebar="30%" />
          <Balok tinggi={13} lebar="55%" />
        </div>
      ))}
    </div>
  );
}

/** Kerangka generik untuk baris-baris teks. */
export function KerangkaTeks({
  baris = 3,
}: {
  baris?: number;
}) {
  const lebarPola = ['70%', '50%', '60%', '45%', '55%'];

  return (
    <div
      className="flex flex-col gap-3"
      aria-busy="true"
      aria-label="Memuat"
      role="status"
    >
      {Array.from(
        { length: Math.max(0, baris) },
        (_, i) => (
          <Balok
            key={i}
            tinggi={16}
            lebar={lebarPola[i % lebarPola.length]}
          />
        ),
      )}
    </div>
  );
}
