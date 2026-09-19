'use client';

import { use } from 'react';
import Link from 'next/link';
import { useLaporanDetail, useLampiranLaporan } from '../../../lib/api/riwayat';
import { LaporanBacaSaja } from '../../../components/LaporanBacaSaja';
import { KerangkaDetailLaporan } from '../../../components/Kerangka';
import { formRegistry } from '../../../forms';
import { tanggalIndonesiaDariYmd, jamWIB } from '../../../lib/tanggal';

const LABEL_STATUS: Record<string, { teks: string; warna: string }> = {
  terkirim: { teks: 'Terkirim', warna: 'var(--hijau)' },
  terlambat: { teks: 'Terlambat', warna: 'var(--kuning)' },
};
const LABEL_WARNA: Record<string, { teks: string; warna: string; rail: string }> = {
  hijau: { teks: 'Aman', warna: 'var(--hijau)', rail: 'status-hijau' },
  kuning: { teks: 'Perlu dikawal', warna: 'var(--kuning)', rail: 'status-kuning' },
  merah: { teks: 'Urgent', warna: 'var(--merah)', rail: 'status-merah' },
};

export default function RiwayatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: laporan, isLoading } = useLaporanDetail(id);
  const { data: lampiran } = useLampiranLaporan(laporan?.id);
  const schema = laporan ? formRegistry[laporan.formKey] : undefined;

  const statusInfo = laporan ? LABEL_STATUS[laporan.status] : undefined;
  const warnaInfo = laporan?.warna ? LABEL_WARNA[laporan.warna] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-5 md:gap-4 md:px-8 md:py-8">
      <Link href="/riwayat" className="inline-flex w-fit items-center" style={{ minHeight: 44, color: 'var(--biru-3)', fontSize: 14 }}>
        ← Kembali ke Laporan Saya
      </Link>

      {isLoading && <KerangkaDetailLaporan />}

      {!isLoading && !laporan && (
        <div className="panel">
          <div className="panel-baris">
            <p style={{ color: 'var(--kosong)' }}>Laporan tidak ditemukan, atau bukan milik Anda.</p>
          </div>
        </div>
      )}

      {laporan && schema && (
        <>
          <header className="flex flex-col gap-1">
            <h1 className="sapaan">{schema.nama}</h1>
            <p className="text-sm" style={{ color: 'var(--label)' }}>
              {tanggalIndonesiaDariYmd(laporan.tanggal)}
              {laporan.submittedAt ? ` · Dikirim ${jamWIB(new Date(laporan.submittedAt))}` : ''}
            </p>
          </header>
          <LaporanBacaSaja
            schema={schema}
            data={laporan.data}
            tanggal={laporan.tanggal}
            lampiran={lampiran ?? []}
            ringkasan={
              <div className={`panel-baris flex flex-col gap-1 ${warnaInfo?.rail ?? ''}`} style={{ padding: 16 }}>
                <p style={{ fontSize: 12, color: 'var(--label)' }}>Status laporan</p>
                <p className="status-teks" style={{ fontSize: 16, color: statusInfo?.warna ?? 'var(--tinta)' }}>
                  {statusInfo?.teks ?? laporan.status}
                </p>
                {warnaInfo && (
                  <p className="status-teks" style={{ color: warnaInfo.warna }}>
                    Kondisi: {warnaInfo.teks}
                  </p>
                )}
              </div>
            }
          />
        </>
      )}
    </main>
  );
}
