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
      className="flex flex-1 flex-col items-center justify-end gap-0.5"
      style={{ minHeight: 'var(--tinggi-nav-bawah)' }}
      aria-label={label}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: selesai ? 'var(--kosong)' : 'var(--biru)',
          color: '#fff',
          transform: 'translateY(-14px)',
          boxShadow: '0 2px 6px rgba(16,32,46,0.25)',
        }}
      >
        <NavIcon nama="absen" size={26} />
      </span>
      <span style={{ fontFamily: 'var(--display)', fontWeight: 500, fontSize: 10, color: 'var(--tinta)', marginTop: -10 }}>
        {label}
      </span>
    </Link>
  );
}
