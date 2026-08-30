'use client';

import { useState } from 'react';
import { tanggalWIB } from '../lib/tanggal';

/**
 * Tombol unduh Excel bulanan -- dipakai di halaman Tinjau Absensi,
 * Marketing, dan Terpusat (§4 06-RENCANA-PRESENSI-MOBILE.md). Endpoint
 * (`app/api/ekspor/*`) yang memeriksa hak akses sungguhan di server --
 * komponen ini cuma UI, TIDAK melakukan pengecekan peran apa pun (sesuai
 * instruksi: "jangan cuma menyembunyikan tombolnya" berarti keamanan
 * sungguhan ada di server, bukan berarti tombol boleh sembarangan
 * ditampilkan -- pemanggil (halaman) tetap harus membungkus ini dengan
 * kondisi peran di JSX supaya orang yang jelas tidak berhak tidak usah
 * melihat tombolnya sama sekali).
 */
export function TombolEkspor({ path, label }: { path: string; label: string }) {
  const [bulan, setBulan] = useState(tanggalWIB().slice(0, 7)); // 'YYYY-MM'

  return (
    <div className="flex flex-wrap items-center gap-2 border p-3" style={{ borderColor: 'var(--garis)' }}>
      <span style={{ fontFamily: 'var(--display)', fontWeight: 500 }}>{label}</span>
      <input
        type="month"
        value={bulan}
        onChange={(e) => setBulan(e.target.value)}
        className="border px-2"
        style={{ borderColor: 'var(--garis)' }}
      />
      <a
        href={`${path}?bulan=${bulan}`}
        className="border px-3"
        style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
      >
        Unduh Excel
      </a>
    </div>
  );
}
