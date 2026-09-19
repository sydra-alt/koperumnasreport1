'use client';

import Link from 'next/link';
import { useRiwayatSaya, type RiwayatRow } from '../../lib/api/riwayat';
import { KerangkaDaftarKartu } from '../../components/Kerangka';
import { formRegistry } from '../../forms';
import { jamWIB, tanggalIndonesiaDariYmd } from '../../lib/tanggal';

/**
 * Riwayat — DESIGN.md §15.
 * Tampilan: dikelompokkan per tanggal (satu `.panel` per hari), baris dengan rail warna `warna`
 * laporan. Arti warna dijelaskan lewat teks ("Perlu dikawal"/"Urgent") supaya tidak hanya warna.
 * Data (useRiwayatSaya) TIDAK berubah -- hanya presentasi.
 */

const STATUS_BARIS: Record<string, string> = { hijau: 'status-hijau', kuning: 'status-kuning', merah: 'status-merah' };
const LABEL_STATUS: Record<string, { teks: string; warna: string }> = {
  terkirim: { teks: 'Terkirim', warna: 'var(--hijau)' },
  terlambat: { teks: 'Terlambat', warna: 'var(--kuning)' },
};
// Hanya kuning/merah yang perlu penjelasan teks; hijau = kondisi normal.
const LABEL_WARNA: Record<string, { teks: string; warna: string }> = {
  kuning: { teks: 'Perlu dikawal', warna: 'var(--kuning)' },
  merah: { teks: 'Urgent', warna: 'var(--merah)' },
};

function kelompokkanPerTanggal(daftar: RiwayatRow[]): { tanggal: string; baris: RiwayatRow[] }[] {
  const hasil: { tanggal: string; baris: RiwayatRow[] }[] = [];
  for (const r of daftar) {
    const terakhir = hasil[hasil.length - 1];
    if (terakhir && terakhir.tanggal === r.tanggal) terakhir.baris.push(r);
    else hasil.push({ tanggal: r.tanggal, baris: [r] });
  }
  return hasil;
}

export default function RiwayatPage() {
  const { data: daftar, isLoading } = useRiwayatSaya();
  const laporan = daftar ?? [];
  const kelompok = kelompokkanPerTanggal(laporan);

  const jumlahTerlambat = laporan.filter((r) => r.status === 'terlambat').length;
  const jumlahTerkirim = laporan.filter((r) => r.status === 'terkirim').length;
  const jumlahKuning = laporan.filter((r) => r.warna === 'kuning').length;
  const jumlahMerah = laporan.filter((r) => r.warna === 'merah').length;

  return (
    <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-5 md:gap-4 md:px-8 md:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="sapaan">Laporan Saya</h1>
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          Laporan yang sudah Anda kirim, 30 hari terakhir.
          {!isLoading && laporan.length > 0 ? ` ${laporan.length} laporan · ${jumlahTerlambat} terlambat` : ''}
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,720px)_300px] lg:items-start lg:gap-x-8">
        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
          {isLoading && <KerangkaDaftarKartu />}

          {!isLoading && laporan.length === 0 && (
            <div className="panel">
              <div className="panel-baris">
                <p className="judul-seksi">Belum ada laporan</p>
                <p className="text-sm" style={{ color: 'var(--kosong)' }}>
                  Belum ada laporan yang terkirim dalam 30 hari terakhir.
                </p>
              </div>
            </div>
          )}

          {kelompok.map((k) => (
            <section key={k.tanggal} className="panel">
              <div className="panel-baris flex items-baseline justify-between gap-3">
                <h2 className="judul-seksi">{tanggalIndonesiaDariYmd(k.tanggal)}</h2>
                <span className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>{k.baris.length}</span>
              </div>
              {k.baris.map((r) => {
                const statusInfo = LABEL_STATUS[r.status];
                const warnaInfo = r.warna ? LABEL_WARNA[r.warna] : undefined;
                return (
                  <Link
                    key={r.id}
                    href={`/riwayat/${r.id}`}
                    className={`panel-baris flex items-center justify-between gap-3 ${r.warna ? (STATUS_BARIS[r.warna] ?? '') : ''}`}
                    style={{ minHeight: 64, textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="min-w-0">
                      <p style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>
                        {formRegistry[r.formKey]?.nama ?? r.formKey}
                      </p>
                      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm" style={{ color: 'var(--label)' }}>
                        {statusInfo && (
                          <span className="status-teks" style={{ color: statusInfo.warna }}>{statusInfo.teks}</span>
                        )}
                        {r.submittedAt && <span>Dikirim {jamWIB(new Date(r.submittedAt))}</span>}
                        {warnaInfo && (
                          <span className="status-teks" style={{ color: warnaInfo.warna }}>· {warnaInfo.teks}</span>
                        )}
                      </p>
                    </div>
                    <span aria-hidden="true" style={{ color: 'var(--kosong)', flexShrink: 0 }}>›</span>
                  </Link>
                );
              })}
            </section>
          ))}
        </div>

        {/* Ringkasan (desktop): hitungan dari data yang sudah dimuat -- tanpa query baru. */}
        {!isLoading && laporan.length > 0 && (
          <aside className="panel hidden lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1 lg:block" aria-label="Ringkasan">
            <div className="panel-baris">
              <p className="judul-seksi">Ringkasan 30 hari</p>
            </div>
            {[
              { teks: 'Laporan terkirim', jumlah: jumlahTerkirim, warna: 'var(--hijau)' },
              { teks: 'Terlambat', jumlah: jumlahTerlambat, warna: 'var(--kuning)' },
              { teks: 'Perlu dikawal', jumlah: jumlahKuning, warna: 'var(--kuning)' },
              { teks: 'Urgent', jumlah: jumlahMerah, warna: 'var(--merah)' },
            ].map((s) => (
              <div key={s.teks} className="panel-baris flex items-baseline justify-between gap-3">
                <span className="text-sm" style={{ color: 'var(--label)' }}>{s.teks}</span>
                <span className="angka-kecil" style={{ color: s.warna, fontFamily: 'var(--mono)' }}>{s.jumlah}</span>
              </div>
            ))}
          </aside>
        )}
      </div>
    </main>
  );
}
