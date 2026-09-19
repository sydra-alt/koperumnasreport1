'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import type { Field, FormSchema } from '../forms/types';
import { hariIsoDariTanggal } from '../lib/tanggal';
import { formatRupiah } from '../lib/rupiah';
import { useSignedUrl } from '../lib/api/attachment';
import type { LampiranRingkas } from '../lib/api/riwayat';

// Status warna (field `status_warna`) -- teks yang sama dengan pilihan di form (StatusWarna.tsx), tanpa emoji.
const LABEL_WARNA: Record<string, { teks: string; warna: string }> = {
  hijau: { teks: 'Aman', warna: 'var(--hijau)' },
  kuning: { teks: 'Dikawal', warna: 'var(--kuning)' },
  merah: { teks: 'Urgent', warna: 'var(--merah)' },
};

const NILAI: CSSProperties = { fontSize: 15, fontWeight: 500, color: 'var(--tinta)', lineHeight: 1.4 };
// Baris baca-saja dirapatkan (padding vertikal 8px) supaya laporan panjang tidak bertambah tinggi.
const BARIS_RAPAT: CSSProperties = { padding: '8px 16px' };
const MONO: CSSProperties = { fontFamily: 'var(--mono)', fontVariantNumeric: 'tabular-nums' };

/** Tombol lampiran: mekanisme signed URL TIDAK berubah (useSignedUrl + window.open); hanya tampilan. */
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
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => void buka(item)}
            disabled={dibuka === item.id}
            className="tombol-sekunder"
            style={{ fontSize: 14, padding: '8px 14px', minHeight: 44 }}
          >
            {dibuka === item.id ? 'Membuka…' : item.mime?.startsWith('video') ? 'Lihat video' : 'Lihat foto'}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Kosong() {
  return <span style={{ ...NILAI, fontWeight: 400, color: 'var(--kosong)' }}>—</span>;
}

function JawabanYaTidak({ ya }: { ya: boolean }) {
  return (
    <span className="status-teks" style={{ fontSize: 14, color: ya ? 'var(--hijau)' : 'var(--tinta)' }}>
      {ya ? 'Ya' : 'Tidak'}
    </span>
  );
}

/** Nilai satu field -- SEMANTIK sama dengan sebelumnya (uang/angka, centang false = "Tidak", ya_tidak belum dijawab = "—", dst.). */
function NilaiField({ field, nilai }: { field: Field; nilai: unknown }) {
  switch (field.type) {
    case 'uang':
      return typeof nilai === 'number' ? <span style={{ ...NILAI, ...MONO }}>{formatRupiah(nilai)}</span> : <Kosong />;
    case 'angka':
      return typeof nilai === 'number' ? <span style={{ ...NILAI, ...MONO }}>{nilai}</span> : <Kosong />;
    case 'centang':
      return <JawabanYaTidak ya={nilai === true} />;
    case 'ya_tidak':
      return nilai === 'ya' ? <JawabanYaTidak ya /> : nilai === 'tidak' ? <JawabanYaTidak ya={false} /> : <Kosong />;
    case 'status_warna': {
      const w = typeof nilai === 'string' ? LABEL_WARNA[nilai] : undefined;
      return w ? (
        <span className="status-teks" style={{ fontSize: 14, color: w.warna }}>{w.teks}</span>
      ) : (
        <Kosong />
      );
    }
    case 'teks_panjang':
      return typeof nilai === 'string' && nilai ? (
        <span style={{ ...NILAI, fontWeight: 400, whiteSpace: 'pre-wrap' }}>{nilai}</span>
      ) : (
        <Kosong />
      );
    case 'tabel': {
      const baris = Array.isArray(nilai) ? (nilai as Record<string, unknown>[]) : [];
      if (baris.length === 0) return <span style={{ ...NILAI, fontWeight: 400, color: 'var(--kosong)' }}>Tidak ada baris.</span>;
      return (
        <div className="flex flex-col gap-2">
          {baris.map((r, i) => (
            <div key={i} className="grid gap-x-4 gap-y-2 md:grid-cols-2" style={{ background: 'var(--kertas)', borderRadius: 12, padding: 12 }}>
              {baris.length > 1 && (
                <p className="md:col-span-2" style={{ fontSize: 12, color: 'var(--kosong)' }}>Baris {i + 1}</p>
              )}
              {(field.kolom ?? []).map((k) => {
                const v = r[k.key];
                const ada = (typeof v === 'string' && v !== '') || typeof v === 'number';
                return (
                  <div key={k.key} className="min-w-0">
                    <p style={{ fontSize: 12, color: 'var(--label)' }}>{k.label}</p>
                    <p style={{ fontSize: 14, color: ada ? 'var(--tinta)' : 'var(--kosong)', overflowWrap: 'anywhere' }}>{ada ? String(v) : '—'}</p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );
    }
    default:
      return typeof nilai === 'string' || typeof nilai === 'number'
        ? nilai === '' ? <Kosong /> : <span style={NILAI}>{String(nilai)}</span>
        : <Kosong />;
  }
}

/**
 * Penyusunan TAMPILAN saja (sama polanya dengan components/FormRenderer.tsx): field `angka`/`uang`
 * yang berurutan dan sekelompok ditata sebagai grid berpasangan. Urutan dan nilai field tidak berubah.
 */
type ButirTampil = { jenis: 'satu'; field: Field } | { jenis: 'grup'; tipe: 'angka' | 'uang'; kunci: string; fields: Field[] };

function kunciKelompok(f: Field): string {
  const i = f.label.indexOf(' -- ');
  return i >= 0 ? f.label.slice(0, i) : '';
}

function labelTanpaKunci(label: string): string {
  const i = label.indexOf(' -- ');
  const sisa = i >= 0 ? label.slice(i + 4) : label;
  return sisa.charAt(0).toUpperCase() + sisa.slice(1);
}

function susunButir(fields: Field[]): ButirTampil[] {
  const hasil: ButirTampil[] = [];
  let i = 0;
  while (i < fields.length) {
    const f = fields[i];
    if ((f.type === 'angka' || f.type === 'uang') && !f.buktiWajib) {
      const kunci = kunciKelompok(f);
      let j = i + 1;
      while (j < fields.length && fields[j].type === f.type && !fields[j].buktiWajib && kunciKelompok(fields[j]) === kunci) j++;
      const n = j - i;
      if (n >= 2 && (kunci !== '' || n <= 4)) {
        hasil.push({ jenis: 'grup', tipe: f.type, kunci, fields: fields.slice(i, j) });
        i = j;
        continue;
      }
    }
    hasil.push({ jenis: 'satu', field: f });
    i++;
  }
  return hasil;
}

interface LaporanBacaSajaProps {
  schema: FormSchema;
  data: Record<string, unknown>;
  tanggal: string;
  lampiran: LampiranRingkas[];
  /** Panel status di atas daftar bagian (kolom samping di desktop) -- dibangun halaman detail dari `warna`/`status` yang sudah dimuat. */
  ringkasan?: ReactNode;
}

/** Rendering BACA SAJA satu laporan yang sudah terkirim -- Task "Riwayat" (24 Agustus 2026). Bukan FormRenderer (itu selalu mode edit lewat react-hook-form); di sini TIDAK ADA input. */
export function LaporanBacaSaja({ schema, data, tanggal, lampiran, ringkasan }: LaporanBacaSajaProps) {
  const hariIso = hariIsoDariTanggal(tanggal);
  const blockBerlaku = schema.blocks.filter((b) => !b.hanyaHari || b.hanyaHari.includes(hariIso));

  function lompat(idBlok: string) {
    document.getElementById(`bagian-${idBlok}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,720px)_300px] lg:items-start lg:gap-x-8">
      {/* Status + lompat-ke-bagian: HP = deretan nomor; desktop = kolom samping sticky. Murni navigasi tampilan. */}
      <aside className="panel lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1" aria-label="Ringkasan laporan">
        {ringkasan}
        {blockBerlaku.length > 1 && (
          <nav
            className="panel-baris flex flex-wrap gap-2 lg:max-h-[55vh] lg:flex-col lg:flex-nowrap lg:gap-1 lg:overflow-y-auto"
            aria-label="Lompat ke bagian"
            style={{ padding: 12 }}
          >
            {blockBerlaku.map((block, i) => (
              <button
                key={block.id}
                type="button"
                onClick={() => lompat(block.id)}
                aria-label={block.judul}
                className="flex items-center justify-center gap-2 text-sm lg:justify-start lg:px-2"
                style={{ minHeight: 44, minWidth: 44, borderRadius: 10, border: '1px solid var(--garis)', background: 'var(--kertas)', color: 'var(--tinta)', fontWeight: 600 }}
              >
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{String(i + 1).padStart(2, '0')}</span>
                <span className="sr-only text-left lg:not-sr-only lg:font-medium">{block.judul}</span>
              </button>
            ))}
          </nav>
        )}
      </aside>

      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
        {blockBerlaku.map((block, bi) => (
          <section key={block.id} id={`bagian-${block.id}`} className="panel" style={{ scrollMarginTop: 12 }}>
            <div className="panel-baris flex items-baseline gap-2">
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--kosong)' }}>{String(bi + 1).padStart(2, '0')}</span>
              <h2 className="judul-seksi">{block.judul}</h2>
            </div>
            {block.catatan && (
              <div className="panel-baris" style={BARIS_RAPAT}>
                <p className="teks-penjelasan">{block.catatan}</p>
              </div>
            )}
            {susunButir(block.fields).map((butir) => {
              if (butir.jenis === 'grup') {
                const kolomMd = butir.fields.length === 2 ? 2 : butir.fields.length === 4 ? 2 : 3;
                return (
                  <div key={butir.fields[0].key} className="panel-baris flex flex-col gap-2" style={BARIS_RAPAT}>
                    {butir.kunci && (
                      <p style={{ fontFamily: 'var(--display)', fontSize: 14, fontWeight: 700, color: 'var(--biru)' }}>{butir.kunci}</p>
                    )}
                    <div
                      role="group"
                      aria-label={butir.kunci || undefined}
                      className={`grup-isian${butir.tipe === 'uang' ? ' grup-uang' : ''}`}
                      style={{ ['--kolom-md' as string]: kolomMd } as CSSProperties}
                    >
                      {butir.fields.map((f) => (
                        <div key={f.key} className="flex min-w-0 flex-col gap-1" style={{ overflowWrap: 'anywhere' }}>
                          <span style={{ fontSize: 13, color: 'var(--label)', lineHeight: 1.35 }}>{butir.kunci ? labelTanpaKunci(f.label) : f.label}</span>
                          <NilaiField field={f} nilai={data[f.key]} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              const field = butir.field;
              const lampiranField = lampiran.filter((l) => l.fieldKey === (field.buktiKunci ?? field.key));

              if (field.type === 'ya_tidak' || field.type === 'centang') {
                return (
                  <div key={field.key} className="panel-baris flex flex-wrap items-center justify-between gap-x-3 gap-y-1" style={{ ...BARIS_RAPAT, minHeight: 40 }}>
                    <span style={{ fontSize: 14, color: 'var(--tinta)', lineHeight: 1.35, flex: '1 1 170px', minWidth: 0 }}>{field.label}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <NilaiField field={field} nilai={data[field.key]} />
                      {field.buktiWajib && <LampiranField items={lampiranField} />}
                    </div>
                  </div>
                );
              }

              if (field.type === 'lampiran') {
                return (
                  <div key={field.key} className="panel-baris flex flex-col gap-1" style={BARIS_RAPAT}>
                    <span style={{ fontSize: 13, color: 'var(--label)' }}>{field.label}</span>
                    {lampiranField.length > 0 ? <LampiranField items={lampiranField} /> : <Kosong />}
                  </div>
                );
              }

              return (
                <div key={field.key} className="panel-baris flex flex-col gap-1" style={BARIS_RAPAT}>
                  <span style={{ fontSize: 13, color: 'var(--label)', lineHeight: 1.35 }}>{field.label}</span>
                  <NilaiField field={field} nilai={data[field.key]} />
                  {field.buktiWajib && <LampiranField items={lampiranField} />}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}
