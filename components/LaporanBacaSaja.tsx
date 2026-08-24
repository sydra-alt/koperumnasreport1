'use client';

import { useState } from 'react';
import type { Field, FormSchema } from '../forms/types';
import { hariIsoDariTanggal } from '../lib/tanggal';
import { formatRupiah } from '../lib/rupiah';
import { useSignedUrl } from '../lib/api/attachment';
import type { LampiranRingkas } from '../lib/api/riwayat';

const IKON_WARNA: Record<string, string> = { hijau: '🟢', kuning: '🟡', merah: '🔴' };

function LampiranField({ items }: { items: LampiranRingkas[] }) {
  const signedUrl = useSignedUrl();
  const [dibuka, setDibuka] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function buka(item: LampiranRingkas) {
    setDibuka(item.id);
    try {
      const url = await signedUrl.mutateAsync({ path: item.path, umurDetik: 120 });
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setDibuka(null);
    }
  }

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => void buka(item)}
            disabled={dibuka === item.id}
            className="border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44 }}
          >
            {dibuka === item.id ? 'Membuka…' : `📎 ${item.mime?.startsWith('video') ? 'Lihat video' : 'Lihat foto'}`}
          </button>
        </li>
      ))}
    </ul>
  );
}

function NilaiField({ field, nilai }: { field: Field; nilai: unknown }) {
  switch (field.type) {
    case 'uang':
      return <span style={{ fontFamily: 'var(--mono)' }}>{typeof nilai === 'number' ? formatRupiah(nilai) : '—'}</span>;
    case 'angka':
      return <span style={{ fontFamily: 'var(--mono)' }}>{typeof nilai === 'number' ? nilai : '—'}</span>;
    case 'centang':
      return <span>{nilai === true ? '✅ Ya' : '❌ Tidak'}</span>;
    case 'ya_tidak':
      return <span>{nilai === 'ya' ? '✅ Ya' : nilai === 'tidak' ? '❌ Tidak' : '—'}</span>;
    case 'status_warna':
      return <span>{typeof nilai === 'string' && IKON_WARNA[nilai] ? `${IKON_WARNA[nilai]} ${nilai}` : '—'}</span>;
    case 'teks_panjang':
      return <span style={{ whiteSpace: 'pre-wrap' }}>{typeof nilai === 'string' && nilai ? nilai : '—'}</span>;
    case 'tabel': {
      const baris = Array.isArray(nilai) ? (nilai as Record<string, unknown>[]) : [];
      if (baris.length === 0) return <span style={{ color: 'var(--kosong)' }}>Tidak ada baris.</span>;
      return (
        <div className="flex flex-col gap-2">
          {baris.map((r, i) => (
            <div key={i} className="border p-2 text-sm" style={{ borderColor: 'var(--garis)' }}>
              {(field.kolom ?? []).map((k) => (
                <p key={k.key}>
                  <b>{k.label}:</b> {typeof r[k.key] === 'string' || typeof r[k.key] === 'number' ? String(r[k.key]) : '—'}
                </p>
              ))}
            </div>
          ))}
        </div>
      );
    }
    default:
      return <span>{typeof nilai === 'string' || typeof nilai === 'number' ? String(nilai) : '—'}</span>;
  }
}

interface LaporanBacaSajaProps {
  schema: FormSchema;
  data: Record<string, unknown>;
  tanggal: string;
  lampiran: LampiranRingkas[];
}

/** Rendering BACA SAJA satu laporan yang sudah terkirim -- Task "Riwayat" (24 Agustus 2026). Bukan FormRenderer (itu selalu mode edit lewat react-hook-form). */
export function LaporanBacaSaja({ schema, data, tanggal, lampiran }: LaporanBacaSajaProps) {
  const hariIso = hariIsoDariTanggal(tanggal);
  const blockBerlaku = schema.blocks.filter((b) => !b.hanyaHari || b.hanyaHari.includes(hariIso));

  return (
    <div className="flex flex-col gap-4">
      {blockBerlaku.map((block) => (
        <div key={block.id} className="border p-4" style={{ borderColor: 'var(--garis)' }}>
          <p className="text-lg" style={{ fontFamily: 'var(--display)' }}>
            {block.judul}
          </p>
          {block.catatan && (
            <p className="mb-2 text-sm" style={{ color: 'var(--biru-3)' }}>
              {block.catatan}
            </p>
          )}
          <div className="mt-2 flex flex-col gap-3 text-sm">
            {block.fields.map((field) => {
              const lampiranField = lampiran.filter((l) => l.fieldKey === (field.buktiKunci ?? field.key));
              if (field.type === 'lampiran') {
                return (
                  <div key={field.key}>
                    <p style={{ fontFamily: 'var(--display)' }}>{field.label}</p>
                    <LampiranField items={lampiranField} />
                  </div>
                );
              }
              return (
                <div key={field.key}>
                  <p style={{ fontFamily: 'var(--display)' }}>{field.label}</p>
                  <NilaiField field={field} nilai={data[field.key]} />
                  {field.buktiWajib && <LampiranField items={lampiranField} />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
