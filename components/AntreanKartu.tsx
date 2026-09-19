'use client';

import { useState } from 'react';
import type { KeputusanRow } from '../lib/api/decision';
import { formatRupiah } from '../lib/rupiah';
import { formRegistry } from '../forms';
import { jamWIB, tanggalIndonesiaDariYmd, tanggalIndonesiaWIB } from '../lib/tanggal';

/**
 * Baris keputusan (DESIGN.md §13) -- sekarang BARIS di dalam `.panel` (dikelompokkan per urgensi oleh
 * app/keputusan/page.tsx), bukan kartu terpisah. Tampilan saja: props, kondisi tampil (siapa yang boleh
 * memutuskan, kapan textarea/tombol muncul), dan pemanggilan `onPutuskan` TIDAK berubah.
 * Tombol hierarki: Setujui = primary blue, Cicil = amber outlined,
 * Tunda = neutral outlined, Tolak = merah outlined (bukan solid).
 * Emoji diganti teks status (DESIGN.md §8.3).
 */

const STATUS_URGENSI: Record<number, string> = { 1: 'status-merah', 2: 'status-kuning', 3: 'status-biru' };
export const LABEL_URGENSI: Record<number, { teks: string; warna: string }> = {
  1: { teks: 'Urgent', warna: 'var(--merah)' },
  2: { teks: 'Perlu dikawal', warna: 'var(--kuning)' },
  3: { teks: 'Biasa', warna: 'var(--biru-3)' },
};

export const LABEL_STATUS: Record<string, { teks: string; warna: string }> = {
  menunggu: { teks: 'Menunggu', warna: 'var(--kuning)' },
  disetujui: { teks: 'Disetujui', warna: 'var(--hijau)' },
  dicicil: { teks: 'Dicicil', warna: 'var(--kuning)' },
  ditunda: { teks: 'Ditunda', warna: 'var(--kosong)' },
  ditolak: { teks: 'Ditolak', warna: 'var(--merah)' },
};

// Riwayat: warna/rail utama mengikuti HASIL keputusan, bukan urgensi awal.
const STATUS_HASIL: Record<string, string> = { disetujui: 'status-hijau', ditolak: 'status-merah', dicicil: 'status-kuning' };

interface AntreanKartuProps {
  baris: KeputusanRow;
  bolehMemutuskan: boolean;
  onPutuskan: (status: 'disetujui' | 'dicicil' | 'ditunda' | 'ditolak', catatan: string | null) => void;
  memutuskan: boolean;
}

export function AntreanKartu({ baris, bolehMemutuskan, onPutuskan, memutuskan }: AntreanKartuProps) {
  const [catatan, setCatatan] = useState('');
  const formNama = baris.formKey ? (formRegistry[baris.formKey]?.nama ?? baris.formKey) : '—';
  const urgensiInfo = LABEL_URGENSI[baris.urgensi];
  const menunggu = baris.status === 'menunggu';
  const statusInfo = LABEL_STATUS[baris.status];
  const railClass = menunggu ? (STATUS_URGENSI[baris.urgensi] ?? '') : (STATUS_HASIL[baris.status] ?? '');
  const waktuKeputusan = baris.decidedAt ? `${tanggalIndonesiaWIB(new Date(baris.decidedAt))} · ${jamWIB(new Date(baris.decidedAt))}` : '—';

  return (
    <div className={`panel-baris ${railClass} flex flex-col gap-2`} style={{ padding: '14px 16px' }}>
      <div className="flex items-start justify-between gap-3">
        <p className="judul-seksi" style={{ fontSize: 16, lineHeight: 1.35 }}>
          {baris.judul}
        </p>
        {menunggu
          ? urgensiInfo && (
              <span className="status-teks" style={{ color: urgensiInfo.warna, flexShrink: 0 }}>
                {urgensiInfo.teks}
              </span>
            )
          : statusInfo && (
              <span className="status-teks" style={{ color: statusInfo.warna, flexShrink: 0, fontSize: 14 }}>
                {statusInfo.teks}
              </span>
            )}
      </div>

      {(baris.nominal > 0 || baris.deadline) && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {baris.nominal > 0 && (
            <span className="angka-kecil" style={{ fontFamily: 'var(--mono)' }}>
              {formatRupiah(baris.nominal)}
            </span>
          )}
          {baris.deadline && (
            <span className="text-sm" style={{ color: 'var(--label)' }}>
              Tenggat: {tanggalIndonesiaDariYmd(baris.deadline)}
            </span>
          )}
        </div>
      )}

      <p className="text-sm" style={{ color: 'var(--label)' }}>
        {!menunggu && urgensiInfo && (
          <span className="status-teks" style={{ color: urgensiInfo.warna }}>
            {urgensiInfo.teks} ·{' '}
          </span>
        )}
        Dari {formNama}
        {baris.tanggalLaporan ? ` · ${tanggalIndonesiaDariYmd(baris.tanggalLaporan)}` : ''}
        {baris.authorNama ? ` · ${baris.authorNama}` : ''}
      </p>

      {baris.masalah && <p className="text-sm">Masalah: {baris.masalah}</p>}
      {baris.dampak && <p className="text-sm">Dampak: {baris.dampak}</p>}

      {menunggu ? (
        bolehMemutuskan && (
          <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: 'var(--garis)' }}>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan keputusan (opsional)"
              className="border p-2 text-sm"
              style={{ borderColor: 'var(--garis)', resize: 'vertical' }}
              rows={1}
            />
            {/* Hierarki tombol (DESIGN.md §13):
                Setujui = primary blue, Cicil = amber outlined,
                Tunda = neutral outlined, Tolak = merah outlined (bukan solid).
                HP: grid 2x2 lebar sama; md+: satu baris. */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('disetujui', catatan || null)}
                className="tombol-utama"
                style={{ fontSize: 14, padding: '8px 12px', minHeight: 44 }}
              >
                Setujui
              </button>
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('dicicil', catatan || null)}
                className="tombol-sekunder"
                style={{ borderColor: 'var(--kuning)', color: 'var(--kuning)', fontSize: 14, padding: '8px 12px', minHeight: 44 }}
              >
                Cicil
              </button>
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('ditunda', catatan || null)}
                className="tombol-sekunder"
                style={{ borderColor: 'var(--garis)', color: 'var(--tinta)', fontSize: 14, padding: '8px 12px', minHeight: 44 }}
              >
                Tunda
              </button>
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('ditolak', catatan || null)}
                className="tombol-sekunder"
                style={{ borderColor: 'var(--merah)', color: 'var(--merah)', fontSize: 14, padding: '8px 12px', minHeight: 44 }}
              >
                Tolak
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="border-t pt-2" style={{ borderColor: 'var(--garis)' }}>
          <p className="text-sm" style={{ color: 'var(--label)' }}>
            {baris.decidedByNama ?? '—'} · {waktuKeputusan}
          </p>
          {baris.keputusanCatatan && <p className="text-sm mt-1">Catatan: {baris.keputusanCatatan}</p>}
        </div>
      )}
    </div>
  );
}
