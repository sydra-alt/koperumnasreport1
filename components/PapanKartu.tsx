'use client';

import type { PapanRow } from '../lib/api/papan';
import { jamWIB } from '../lib/tanggal';

/**
 * Kartu individu di Papan Kontrol CEO (DESIGN.md §7.2).
 * Redesign: rail kiri warna status + soft background (bukan emoji lingkaran).
 * - Belum lapor → rail merah + latar merah-lembut + teks "BELUM LAPOR" + tombol Tagih
 * - Sudah lapor → rail warna status + latar soft sesuai warna + teks status
 * Status teks SELALU disertakan (DESIGN.md §8.3: jangan hanya warna).
 */

const RAIL_WARNA: Record<'hijau' | 'kuning' | 'merah', string> = {
  hijau: 'rail-hijau',
  kuning: 'rail-kuning',
  merah: 'rail-merah',
};
const TEKS_STATUS: Record<'hijau' | 'kuning' | 'merah', { label: string; color: string }> = {
  hijau: { label: 'Sudah lapor', color: 'var(--hijau)' },
  kuning: { label: 'Perlu dikawal', color: 'var(--kuning)' },
  merah: { label: 'Urgent', color: 'var(--merah)' },
};

interface PapanKartuProps {
  baris: PapanRow;
  formNama: string;
  bolehTagih: boolean;
  onTagih: () => void;
  menagih: boolean;
  /**
   * true kalau BELUM ADA SATU PUN laporan masuk hari ini di seluruh papan --
   * dalam keadaan itu "belum lapor" bukan berarti tertinggal (tidak ada
   * pembanding, semua orang memang belum mulai), jadi kartu netral, BUKAN
   * merah (instruksi eksplisit user, 31 Agustus 2026 -- lihat
   * app/papan/page.tsx). Merah tetap dipakai begitu SEBAGIAN sudah lapor.
   */
  netral?: boolean;
}

export function PapanKartu({ baris, formNama, bolehTagih, onTagih, menagih, netral }: PapanKartuProps) {
  const belumLapor = !baris.reportId;

  if (belumLapor) {
    return (
      <div className={`kartu-status ${netral ? 'rail-netral' : 'rail-merah'} flex flex-col gap-2`}>
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{formNama}</p>
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          {baris.scopeNama} · PIC: {baris.picNama}
        </p>
        <p className="status-teks" style={{ color: netral ? 'var(--kosong)' : 'var(--merah)' }}>
          Belum lapor
        </p>
        {baris.nudgedAt && (
          <p className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--biru-3)' }}>
            Sudah ditagih {jamWIB(new Date(baris.nudgedAt))}
          </p>
        )}
        {bolehTagih && (
          <button
            type="button"
            onClick={onTagih}
            disabled={menagih}
            className="tombol-utama"
            style={{ fontSize: 14, padding: '8px 16px', minHeight: 44, alignSelf: 'flex-start' }}
          >
            {menagih ? 'Menagih…' : 'Tagih'}
          </button>
        )}
      </div>
    );
  }

  const warna = baris.warna ?? 'hijau';
  const statusInfo = TEKS_STATUS[warna];
  return (
    <div className={`kartu-status ${RAIL_WARNA[warna]} flex flex-col gap-2`}>
      <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{formNama}</p>
      <p className="text-sm" style={{ color: 'var(--label)' }}>
        {baris.scopeNama} · PIC: {baris.picNama}
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className="status-teks" style={{ color: statusInfo.color }}>
          {statusInfo.label}
          {baris.status === 'terlambat' ? ' · Terlambat' : ''}
        </p>
        <span className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>
          {baris.submittedAt ? jamWIB(new Date(baris.submittedAt)) : '—'}
        </span>
      </div>
    </div>
  );
}
