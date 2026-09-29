'use client';

import { useMemo, useState } from 'react';
import {
  BARIS_TAMPIL,
  catatanTerpotong,
  keteranganSaringan,
  pilihanOutlet,
  saringTabel,
  tabelKeTsv,
  teksSel,
  type Saringan,
  type TabelAi,
} from '../../lib/ai/tabel';

/**
 * Satu tabel hasil alat di bawah jawaban asisten, dengan Cari, saring outlet
 * (kalau ada kolom outlet), urut per kolom -- semuanya di klien pada baris
 * yang sudah dikembalikan (29 September 2026) -- lalu Salin (TSV) dan Unduh
 * Excel (lewat /api/ai/ekspor, dibaca ulang dari database lewat sesi
 * pemiliknya, dengan saringan yang SAMA dan keterangannya di dalam file).
 */
export function TabelJawaban({ tabel, pesanId, urutan }: { tabel: TabelAi; pesanId: string; urutan: number }) {
  const [info, setInfo] = useState<string | null>(null);
  const [saringan, setSaringan] = useState<Saringan>({});
  const outlet = useMemo(() => pilihanOutlet(tabel), [tabel]);
  const baris = useMemo(() => saringTabel(tabel, saringan), [tabel, saringan]);
  const keterangan = keteranganSaringan(tabel, saringan);

  async function salin() {
    try {
      await navigator.clipboard.writeText(tabelKeTsv(tabel, baris));
      setInfo(`${baris.length} baris disalin.`);
    } catch {
      setInfo('Gagal menyalin. Coba unduh Excel.');
    }
  }

  function urutkan(key: string) {
    setSaringan((s) => (s.urut !== key ? { ...s, urut: key, arah: 'naik' } : s.arah === 'naik' ? { ...s, arah: 'turun' } : { ...s, urut: undefined, arah: undefined }));
  }

  const q = new URLSearchParams({ pesan: pesanId, tabel: String(urutan) });
  if (saringan.cari?.trim()) q.set('cari', saringan.cari.trim());
  if (saringan.outlet) q.set('outlet', saringan.outlet);
  if (saringan.urut) {
    q.set('urut', saringan.urut);
    q.set('arah', saringan.arah ?? 'naik');
  }

  const tombol = {
    borderColor: 'var(--biru-garis)',
    color: 'var(--biru)',
    borderRadius: 'var(--radius-kecil)',
    minHeight: 44,
  } as const;
  const isian = {
    borderColor: 'var(--garis-tegas)',
    borderRadius: 'var(--radius-kecil)',
    background: 'var(--permukaan)',
    minHeight: 44,
  } as const;
  const idDasar = `tabel-${pesanId}-${urutan}`;

  return (
    <section
      className="flex flex-col gap-2 border p-3"
      style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)', background: 'var(--permukaan)' }}
      aria-label={tabel.judul}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 style={{ fontWeight: 600, fontSize: 'var(--ukuran-label)' }}>{tabel.judul}</h3>
        <div className="flex gap-2">
          <button type="button" onClick={salin} className="border px-3 text-sm" style={tombol}>
            Salin
          </button>
          <a href={`/api/ai/ekspor?${q.toString()}`} className="inline-flex items-center border px-3 text-sm" style={tombol}>
            Unduh Excel
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`${idDasar}-cari`}>
          Cari di tabel
        </label>
        <input
          id={`${idDasar}-cari`}
          type="search"
          placeholder="Cari..."
          value={saringan.cari ?? ''}
          onChange={(e) => setSaringan((s) => ({ ...s, cari: e.target.value }))}
          className="min-w-0 flex-1 border px-3 text-sm"
          style={isian}
        />
        {outlet.length > 1 ? (
          <>
            <label className="sr-only" htmlFor={`${idDasar}-outlet`}>
              Saring outlet
            </label>
            <select
              id={`${idDasar}-outlet`}
              value={saringan.outlet ?? ''}
              onChange={(e) => setSaringan((s) => ({ ...s, outlet: e.target.value || undefined }))}
              className="border px-3 text-sm"
              style={isian}
            >
              <option value="">Semua outlet di tabel</option>
              {outlet.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {tabel.kolom.map((k) => {
                const aktif = saringan.urut === k.key;
                return (
                  <th
                    key={k.key}
                    aria-sort={aktif ? (saringan.arah === 'turun' ? 'descending' : 'ascending') : 'none'}
                    className="whitespace-nowrap border-b p-0"
                    style={{ borderColor: 'var(--garis)', color: 'var(--label)', fontWeight: 500, textAlign: k.jenis === 'teks' ? 'left' : 'right' }}
                  >
                    <button
                      type="button"
                      onClick={() => urutkan(k.key)}
                      className="w-full px-2 py-1"
                      style={{ minHeight: 44, textAlign: k.jenis === 'teks' ? 'left' : 'right', color: aktif ? 'var(--biru)' : 'inherit' }}
                      title="Urutkan"
                    >
                      {k.label}
                      {aktif ? (saringan.arah === 'turun' ? ' ↓' : ' ↑') : ''}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {baris.slice(0, BARIS_TAMPIL).map((b, i) => (
              <tr key={i}>
                {tabel.kolom.map((k) => (
                  <td
                    key={k.key}
                    className="border-b px-2 py-1"
                    style={{
                      borderColor: 'var(--garis)',
                      textAlign: k.jenis === 'teks' ? 'left' : 'right',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: k.jenis === 'teks' ? 'normal' : 'nowrap',
                    }}
                  >
                    {teksSel(b[k.key] ?? null, k.jenis)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {keterangan ? (
        <p className="text-xs" style={{ color: 'var(--label)' }} role="status">
          {baris.length} dari {tabel.baris.length} baris ({keterangan}). Salin dan Unduh Excel mengikuti saringan ini.
        </p>
      ) : null}
      {!keterangan && catatanTerpotong(tabel) ? (
        <p className="text-xs" style={{ color: 'var(--label)' }}>
          {catatanTerpotong(tabel)}
        </p>
      ) : null}
      {keterangan && baris.length > BARIS_TAMPIL ? (
        <p className="text-xs" style={{ color: 'var(--label)' }}>
          Menampilkan {BARIS_TAMPIL} baris pertama; semua {baris.length} baris tersaring ada di Unduh Excel.
        </p>
      ) : null}
      {info ? (
        <p className="text-xs" style={{ color: 'var(--label)' }} role="status">
          {info}
        </p>
      ) : null}
    </section>
  );
}
