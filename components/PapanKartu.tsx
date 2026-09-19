'use client';

import type { PapanRow } from '../lib/api/papan';
import { jamWIB } from '../lib/tanggal';

/**
 * Baris tugas di Papan Kontrol CEO (DESIGN.md §7.2), disusun di dalam satu
 * `.panel` per kelompok laporan (lihat app/papan/page.tsx) -- BUKAN kartu
 * per tugas, supaya 31 tugas tidak jadi 31 kartu besar.
 * - Belum lapor -> baris polos (tanpa latar berwarna) + teks "Belum lapor" + tombol Tagih.
 *   Merah TIDAK dipakai untuk semua "belum lapor": warna latar/rail hanya untuk
 *   laporan yang SUDAH masuk, sesuai `warna` dari papan_untuk_tanggal
 *   (hijau/kuning/merah), jadi baris yang benar-benar bermasalah tidak tenggelam.
 * Status teks SELALU disertakan (DESIGN.md §8.3: jangan hanya warna).
 */

const STATUS_BARIS: Record<'hijau' | 'kuning' | 'merah', string> = {
  hijau: 'status-hijau',
  kuning: 'status-kuning',
  merah: 'status-merah',
};
const TEKS_STATUS: Record<'hijau' | 'kuning' | 'merah', { label: string; color: string }> = {
  hijau: { label: 'Sudah lapor', color: 'var(--hijau)' },
  kuning: { label: 'Perlu dikawal', color: 'var(--kuning)' },
  merah: { label: 'Urgent', color: 'var(--merah)' },
};

interface PapanKartuProps {
  baris: PapanRow;
  bolehTagih: boolean;
  onTagih: () => void;
  menagih: boolean;
  /**
   * true kalau BELUM ADA SATU PUN laporan masuk hari ini di seluruh papan --
   * "belum lapor" bukan berarti tertinggal (tidak ada pembanding), jadi teks
   * status dibuat netral (instruksi eksplisit user, 31 Agustus 2026 -- lihat
   * app/papan/page.tsx).
   */
  netral?: boolean;
}

/** Tinggi minimum baris disamakan (baris ber-Tagih 44px + padding 10px x 2 = 64px) supaya grid tidak bergerigi. */
const TINGGI_BARIS = 64;

export function PapanKartu({ baris, bolehTagih, onTagih, menagih, netral }: PapanKartuProps) {
  const belumLapor = !baris.reportId;
  const warna = baris.warna ?? 'hijau';
  const statusInfo = TEKS_STATUS[warna];

  return (
    <div
      className={`panel-baris flex items-center justify-between gap-3 ${belumLapor ? '' : STATUS_BARIS[warna]}`}
      style={{ minHeight: TINGGI_BARIS, paddingBlock: 10 }}
    >
      <div className="min-w-0">
        <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, color: 'var(--tinta)' }}>{baris.scopeNama}</p>
        <p style={{ fontSize: 13, lineHeight: 1.3, color: 'var(--label)' }}>PIC: {baris.picNama}</p>
        {belumLapor && baris.nudgedAt && (
          <p style={{ fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.3, color: 'var(--biru-3)' }}>
            Sudah ditagih {jamWIB(new Date(baris.nudgedAt))}
          </p>
        )}
      </div>

      {belumLapor ? (
        <div className="flex shrink-0 items-center gap-3">
          <p className="status-teks" style={{ color: netral ? 'var(--kosong)' : 'var(--label)' }}>
            Belum lapor
          </p>
          {bolehTagih && (
            <button
              type="button"
              onClick={onTagih}
              disabled={menagih}
              className="tombol-sekunder"
              style={{ minWidth: 72, padding: '8px 14px', fontSize: 14 }}
            >
              {menagih ? 'Menagih…' : 'Tagih'}
            </button>
          )}
        </div>
      ) : (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <p className="status-teks" style={{ color: statusInfo.color }}>
            {statusInfo.label}
            {baris.status === 'terlambat' ? ' · Terlambat' : ''}
          </p>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--label)' }}>
            {baris.submittedAt ? jamWIB(new Date(baris.submittedAt)) : '—'}
          </span>
        </div>
      )}
    </div>
  );
}
