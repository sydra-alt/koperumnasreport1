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
    <div className="neumo-kartu flex flex-wrap items-center justify-between gap-3 p-4">
      <span className="text-sm font-bold text-[var(--biru)]" style={{ fontFamily: 'var(--display)' }}>{label}</span>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="month"
          value={bulan}
          onChange={(e) => setBulan(e.target.value)}
          className="text-sm font-semibold px-3 py-1.5"
          style={{ minHeight: 40, fontFamily: 'var(--mono)' }}
        />
        <a
          href={`${path}?bulan=${bulan}`}
          className="tombol-sekunder !py-2 !px-4 text-xs font-bold"
          style={{ minHeight: 40 }}
        >
          Unduh Excel ↗
        </a>
      </div>
    </div>
  );
}
