'use client';

import { use } from 'react';
import Link from 'next/link';
import { useLaporanDetail, useLampiranLaporan } from '../../../lib/api/riwayat';
import { LaporanBacaSaja } from '../../../components/LaporanBacaSaja';
import { formRegistry } from '../../../forms';
import { tanggalIndonesiaDariYmd, jamWIB } from '../../../lib/tanggal';

const LABEL_STATUS: Record<string, string> = { terkirim: 'Terkirim', terlambat: 'Terlambat' };

export default function RiwayatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: laporan, isLoading } = useLaporanDetail(id);
  const { data: lampiran } = useLampiranLaporan(laporan?.id);
  const schema = laporan ? formRegistry[laporan.formKey] : undefined;

  return (
    <main className="flex flex-col gap-4 p-6">
      <Link href="/riwayat" className="text-sm" style={{ color: 'var(--biru-3)' }}>
        ← Kembali ke Laporan Saya
      </Link>

      {isLoading && <p>Memuat…</p>}

      {!isLoading && !laporan && (
        <p style={{ color: 'var(--kosong)' }}>Laporan tidak ditemukan, atau bukan milik Anda.</p>
      )}

      {laporan && schema && (
        <>
          <div>
            <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
              {schema.nama}
            </h1>
            <p className="text-sm" style={{ color: 'var(--kosong)' }}>
              {tanggalIndonesiaDariYmd(laporan.tanggal)}
              {laporan.submittedAt ? ` · Dikirim ${jamWIB(new Date(laporan.submittedAt))}` : ''} ·{' '}
              {LABEL_STATUS[laporan.status] ?? laporan.status}
            </p>
          </div>
          <LaporanBacaSaja schema={schema} data={laporan.data} tanggal={laporan.tanggal} lampiran={lampiran ?? []} />
        </>
      )}
    </main>
  );
}
