'use client';

import { useState } from 'react';
import type { KeputusanRow } from '../lib/api/decision';
import { formatRupiah } from '../lib/rupiah';
import { formRegistry } from '../forms';

const WARNA_URGENSI: Record<number, string> = { 1: 'var(--merah)', 2: 'var(--kuning)', 3: 'var(--biru-3)' };
const LABEL_STATUS: Record<string, string> = {
  menunggu: 'Menunggu',
  disetujui: '✅ Disetujui',
  dicicil: '🟡 Dicicil',
  ditunda: '⏸ Ditunda',
  ditolak: '❌ Ditolak',
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

  return (
    <div className="flex flex-col gap-2 border-2 p-4" style={{ borderColor: WARNA_URGENSI[baris.urgensi] ?? 'var(--garis)' }}>
      <div className="flex items-center justify-between">
        <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
          {baris.judul}
        </p>
        <span
          className="border px-2 py-1 text-sm"
          style={{ borderColor: WARNA_URGENSI[baris.urgensi], fontFamily: 'var(--mono)' }}
        >
          Urgensi {baris.urgensi}
        </span>
      </div>
      <p className="text-sm" style={{ color: 'var(--biru-3)' }}>
        Dari {formNama}
        {baris.tanggalLaporan ? ` · ${baris.tanggalLaporan}` : ''}
        {baris.authorNama ? ` · ${baris.authorNama}` : ''}
      </p>
      {baris.masalah && <p className="text-sm">Masalah: {baris.masalah}</p>}
      {baris.dampak && <p className="text-sm">Dampak: {baris.dampak}</p>}
      <p className="text-sm" style={{ fontFamily: 'var(--mono)' }}>
        {baris.nominal > 0 ? formatRupiah(baris.nominal) : '—'}
        {baris.deadline ? ` · deadline ${baris.deadline}` : ''}
      </p>

      {baris.status === 'menunggu' ? (
        bolehMemutuskan && (
          <div className="flex flex-col gap-2">
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan keputusan (opsional)"
              className="border p-2 text-sm"
              style={{ borderColor: 'var(--garis)' }}
              rows={2}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('disetujui', catatan || null)}
                className="border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--hijau)', color: 'var(--hijau)', minHeight: 44 }}
              >
                Setujui
              </button>
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('dicicil', catatan || null)}
                className="border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--kuning)', color: 'var(--kuning)', minHeight: 44 }}
              >
                Cicil
              </button>
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('ditunda', catatan || null)}
                className="border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--biru-3)', color: 'var(--biru-3)', minHeight: 44 }}
              >
                Tunda
              </button>
              <button
                type="button"
                disabled={memutuskan}
                onClick={() => onPutuskan('ditolak', catatan || null)}
                className="border px-3 py-2 text-sm"
                style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 44 }}
              >
                Tolak
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="border-t pt-2 text-sm" style={{ borderColor: 'var(--garis)' }}>
          <p>{LABEL_STATUS[baris.status] ?? baris.status}</p>
          <p style={{ color: 'var(--biru-3)' }}>
            {baris.decidedByNama ?? '—'} · {baris.decidedAt ? new Date(baris.decidedAt).toLocaleString('id-ID') : '—'}
          </p>
          {baris.keputusanCatatan && <p>Catatan: {baris.keputusanCatatan}</p>}
        </div>
      )}
    </div>
  );
}
