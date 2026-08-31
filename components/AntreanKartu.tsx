'use client';

import { useState } from 'react';
import type { KeputusanRow } from '../lib/api/decision';
import { formatRupiah } from '../lib/rupiah';
import { formRegistry } from '../forms';

/**
 * Kartu keputusan (DESIGN.md §13).
 * Redesign: rail kiri warna urgensi + soft background, bukan border-2 penuh.
 * Tombol hierarki: Setujui = primary blue, Cicil = amber outlined,
 * Tunda = neutral outlined, Tolak = merah outlined (bukan solid).
 * Emoji diganti teks status (DESIGN.md §8.3).
 */

const RAIL_URGENSI: Record<number, string> = { 1: 'rail-merah', 2: 'rail-kuning', 3: 'rail-biru' };
const LABEL_URGENSI: Record<number, { teks: string; warna: string }> = {
  1: { teks: 'Urgent', warna: 'var(--merah)' },
  2: { teks: 'Perlu dikawal', warna: 'var(--kuning)' },
  3: { teks: 'Biasa', warna: 'var(--biru-3)' },
};

const LABEL_STATUS: Record<string, { teks: string; warna: string }> = {
  menunggu: { teks: 'Menunggu', warna: 'var(--kuning)' },
  disetujui: { teks: 'Disetujui', warna: 'var(--hijau)' },
  dicicil: { teks: 'Dicicil', warna: 'var(--kuning)' },
  ditunda: { teks: 'Ditunda', warna: 'var(--kosong)' },
  ditolak: { teks: 'Ditolak', warna: 'var(--merah)' },
};

interface AntreanKartuProps {
  baris: KeputusanRow;
  bolehMemutuskan: boolean;
  onPutuskan: (status: 'disetujui' | 'dicicil' | 'ditunda' | 'ditolak', catatan: string | null) => void;
  memutuskan: boolean;
}

export function AntreanKartu({ baris, bolehMemutuskan, onPutuskan, memutuskan }: AntreanKartuProps) {
  const [catatan, setCatatan] = useState('');
  const formNama = baris.formKey ? (formRegistry[baris.formKey]?.nama ?? baris.formKey) : '—';
  const railClass = RAIL_URGENSI[baris.urgensi] ?? 'rail-netral';
  const urgensiInfo = LABEL_URGENSI[baris.urgensi];

  return (
    <div className={`kartu-status ${railClass} flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <p className="judul-bagian" style={{ fontSize: 18 }}>
          {baris.judul}
        </p>
        {urgensiInfo && (
          <span className="status-teks" style={{ color: urgensiInfo.warna, flexShrink: 0 }}>
            {urgensiInfo.teks}
          </span>
        )}
      </div>
      <p className="text-sm" style={{ color: 'var(--label)' }}>
        Dari {formNama}
        {baris.tanggalLaporan ? ` · ${baris.tanggalLaporan}` : ''}
        {baris.authorNama ? ` · ${baris.authorNama}` : ''}
      </p>
      {baris.masalah && <p className="text-sm">Masalah: {baris.masalah}</p>}
      {baris.dampak && <p className="text-sm">Dampak: {baris.dampak}</p>}
      {(baris.nominal > 0 || baris.deadline) && (
        <div className="flex flex-wrap items-baseline gap-3">
          {baris.nominal > 0 && (
            <span className="angka-kecil" style={{ fontFamily: 'var(--mono)' }}>
              {formatRupiah(baris.nominal)}
            </span>
          )}
          {baris.deadline && (
            <span className="text-sm" style={{ color: 'var(--label)' }}>
              Tenggat: {baris.deadline}
            </span>
          )}
        </div>
      )}

      {baris.status === 'menunggu' ? (
        bolehMemutuskan && (
          <div className="flex flex-col gap-3 border-t pt-3" style={{ borderColor: 'var(--garis)' }}>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan keputusan (opsional)"
              className="border p-2 text-sm"
              style={{ borderColor: 'var(--garis)' }}
              rows={2}
            />
            {/* Hierarki tombol (DESIGN.md §13):
                Setujui = primary blue, Cicil = amber outlined,
                Tunda = neutral outlined, Tolak = merah outlined (bukan solid) */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('disetujui', catatan || null)}
                className="tombol-utama"
                style={{ fontSize: 14, padding: '8px 16px', minHeight: 44 }}
              >
                Setujui
              </button>
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('dicicil', catatan || null)}
                className="tombol-sekunder"
                style={{ borderColor: 'var(--kuning)', color: 'var(--kuning)', fontSize: 14, padding: '8px 16px', minHeight: 44 }}
              >
                Cicil
              </button>
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('ditunda', catatan || null)}
                className="tombol-sekunder"
                style={{ borderColor: 'var(--garis)', color: 'var(--tinta)', fontSize: 14, padding: '8px 16px', minHeight: 44 }}
              >
                Tunda
              </button>
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('ditolak', catatan || null)}
                className="tombol-sekunder"
                style={{ borderColor: 'var(--merah)', color: 'var(--merah)', fontSize: 14, padding: '8px 16px', minHeight: 44 }}
              >
                Tolak
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="border-t pt-3" style={{ borderColor: 'var(--garis)' }}>
          <p className="status-teks" style={{ color: LABEL_STATUS[baris.status]?.warna ?? 'var(--label)' }}>
            {LABEL_STATUS[baris.status]?.teks ?? baris.status}
          </p>
          <p className="text-sm" style={{ color: 'var(--label)' }}>
            {baris.decidedByNama ?? '—'} · {baris.decidedAt ? new Date(baris.decidedAt).toLocaleString('id-ID') : '—'}
          </p>
          {baris.keputusanCatatan && <p className="text-sm mt-1">Catatan: {baris.keputusanCatatan}</p>}
        </div>
      )}
    </div>
  );
}
