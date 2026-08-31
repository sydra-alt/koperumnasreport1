'use client';

import Link from 'next/link';
import { useRiwayatSaya } from '../../lib/api/riwayat';
import { formRegistry } from '../../forms';
import { jamWIB, tanggalIndonesiaDariYmd } from '../../lib/tanggal';

/**
 * Riwayat — DESIGN.md §15.
 * Redesign: rail kiri per item sesuai warna status, hapus emoji 🟢🟡🔴,
 * ganti dengan teks status + warna. Status langsung terlihat tanpa buka
 * satu per satu.
 */

const RAIL_WARNA: Record<string, string> = { hijau: 'rail-hijau', kuning: 'rail-kuning', merah: 'rail-merah' };
const LABEL_STATUS: Record<string, { teks: string; warna: string }> = {
  terkirim: { teks: 'Terkirim', warna: 'var(--hijau)' },
  terlambat: { teks: 'Terlambat', warna: 'var(--kuning)' },
};

export default function RiwayatPage() {
  const { data: daftar, isLoading } = useRiwayatSaya();

  return (
    <main className="flex flex-col gap-4 p-6">
      <h1 style={{ fontSize: 'var(--ukuran-angka-besar)', lineHeight: 1.2 }}>
        Laporan Saya
      </h1>
      <p className="text-sm" style={{ color: 'var(--label)' }}>
        Laporan yang sudah Anda kirim, 30 hari terakhir.
      </p>

      {isLoading && <p>Memuat…</p>}

      {!isLoading && (daftar ?? []).length === 0 && (
        <div className="kartu-status rail-netral">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--kosong)' }}>
            Belum ada laporan
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--kosong)' }}>
            Belum ada laporan yang terkirim dalam 30 hari terakhir.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {(daftar ?? []).map((r) => {
          const railClass = r.warna ? (RAIL_WARNA[r.warna] ?? 'rail-netral') : 'rail-netral';
          const statusInfo = LABEL_STATUS[r.status];
          return (
            <li key={r.id}>
              <Link
                href={`/riwayat/${r.id}`}
                className={`kartu-status ${railClass} flex flex-col gap-1`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{formRegistry[r.formKey]?.nama ?? r.formKey}</span>
                  <span className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>{tanggalIndonesiaDariYmd(r.tanggal)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {statusInfo && (
                    <span className="status-teks" style={{ color: statusInfo.warna }}>{statusInfo.teks}</span>
                  )}
                  <span className="text-sm" style={{ color: 'var(--label)' }}>
                    {r.submittedAt ? `Dikirim ${jamWIB(new Date(r.submittedAt))}` : ''}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
