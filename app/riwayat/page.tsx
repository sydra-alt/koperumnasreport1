'use client';

import Link from 'next/link';
import { useRiwayatSaya } from '../../lib/api/riwayat';
import { formRegistry } from '../../forms';
import { jamWIB, tanggalIndonesiaDariYmd } from '../../lib/tanggal';

const IKON_WARNA: Record<string, string> = { hijau: '🟢', kuning: '🟡', merah: '🔴' };
const LABEL_STATUS: Record<string, string> = { terkirim: 'Terkirim', terlambat: 'Terlambat' };

export default function RiwayatPage() {
  const { data: daftar, isLoading } = useRiwayatSaya();

  return (
    <main className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
        Laporan Saya
      </h1>
      <p className="text-sm" style={{ color: 'var(--kosong)' }}>
        Laporan yang sudah Anda kirim, 30 hari terakhir.
      </p>

      {isLoading && <p>Memuat…</p>}

      {!isLoading && (daftar ?? []).length === 0 && (
        <p style={{ color: 'var(--kosong)' }}>Belum ada laporan yang terkirim dalam 30 hari terakhir.</p>
      )}

      <ul className="flex flex-col gap-2">
        {(daftar ?? []).map((r) => (
          <li key={r.id}>
            <Link
              href={`/riwayat/${r.id}`}
              className="flex flex-col gap-1 border p-3 text-sm"
              style={{ borderColor: 'var(--garis)', minHeight: 44 }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span style={{ fontFamily: 'var(--display)' }}>{formRegistry[r.formKey]?.nama ?? r.formKey}</span>
                <span style={{ fontFamily: 'var(--mono)' }}>{r.warna ? IKON_WARNA[r.warna] : ''} {tanggalIndonesiaDariYmd(r.tanggal)}</span>
              </div>
              <span style={{ color: 'var(--biru-3)' }}>
                {r.submittedAt ? `Dikirim ${jamWIB(new Date(r.submittedAt))}` : ''} · {LABEL_STATUS[r.status] ?? r.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
