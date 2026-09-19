'use client';

import Link from 'next/link';
import { useAbsenHariIni } from '../lib/api/absensi';
import { NavIcon } from './NavIcon';

/**
 * Tombol bundar Absen di tengah nav bawah (30 Agustus 2026) -- BUKAN tab
 * biasa, jadi tidak lewat `lib/navUtama.ts`. Labelnya berubah sesuai
 * status hari ini ("orang tidak perlu membuka halaman untuk tahu status
 * absennya", instruksi eksplisit user): belum absen masuk -> "Absen
 * masuk" (biru); sudah masuk belum pulang -> "Absen pulang" (biru); dua-
 * duanya sudah -> "Sudah absen" (abu, TETAP bisa diketuk untuk lihat
 * catatan -- `app/absen/page.tsx` sendiri yang menampilkan ringkasannya).
 * Selalu menuju /absen apa adanya -- halaman itu yang menentukan aksi yang
 * tepat, tombol ini cuma cermin status + jalan pintas, bukan mesin alur.
 */
export function AbsenFab({ userId }: { userId: string }) {
  const { data: absenHariIni } = useAbsenHariIni(userId);
  const sudahMasuk = (absenHariIni ?? []).some((a) => a.tipe === 'masuk');
  const sudahPulang = (absenHariIni ?? []).some((a) => a.tipe === 'pulang');

  const selesai = sudahMasuk && sudahPulang;
  const label = selesai ? 'Sudah absen' : sudahMasuk ? 'Absen pulang' : 'Absen masuk';

  return (
    <Link
      href="/absen"
      className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-center transition-transform active:scale-95"
      style={{ minHeight: 'var(--tinggi-nav-bawah)' }}
      aria-label={label}
    >
      <span
        className="flex items-center justify-center border-2 border-white transition-all"
        style={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          background: selesai ? 'var(--garis)' : 'var(--biru)',
          color: selesai ? 'var(--label)' : '#fff',
          transform: 'translateY(-6px)',
          boxShadow: '0 2px 8px rgba(14,42,78,0.18)',
        }}
      >
        <NavIcon nama="absen" size={20} />
      </span>
      <span
        className="tracking-tight transition-colors"
        style={{
          fontFamily: 'var(--display)',
          fontWeight: 600,
          fontSize: 9.5,
          color: selesai ? 'var(--label)' : 'var(--biru)',
          marginTop: -4,
        }}
      >
        {label}
      </span>
    </Link>
  );
}
