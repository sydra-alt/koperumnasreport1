'use client';

import { useState } from 'react';
import { BARIS_TAMPIL, catatanTerpotong, tabelKeTsv, teksSel, type TabelAi } from '../../lib/ai/tabel';

/**
 * Satu tabel hasil alat di bawah jawaban asisten, dengan Salin (TSV, bisa
 * ditempel ke spreadsheet) dan Unduh Excel (lewat /api/ai/ekspor, dibaca
 * ulang dari database lewat sesi pemiliknya).
 */
export function TabelJawaban({ tabel, pesanId, urutan }: { tabel: TabelAi; pesanId: string; urutan: number }) {
  const [info, setInfo] = useState<string | null>(null);

  async function salin() {
    try {
      await navigator.clipboard.writeText(tabelKeTsv(tabel));
      setInfo(`${tabel.baris.length} baris disalin.`);
    } catch {
      setInfo('Gagal menyalin. Coba unduh Excel.');
    }
  }

  const tombol = {
    borderColor: 'var(--biru-garis)',
    color: 'var(--biru)',
    borderRadius: 'var(--radius-kecil)',
    minHeight: 44,
  } as const;

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
          <a
            href={`/api/ai/ekspor?pesan=${pesanId}&tabel=${urutan}`}
            className="inline-flex items-center border px-3 text-sm"
            style={tombol}
          >
            Unduh Excel
          </a>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {tabel.kolom.map((k) => (
                <th
                  key={k.key}
                  className="whitespace-nowrap border-b px-2 py-1"
                  style={{ borderColor: 'var(--garis)', color: 'var(--label)', fontWeight: 500, textAlign: k.jenis === 'teks' ? 'left' : 'right' }}
                >
                  {k.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabel.baris.slice(0, BARIS_TAMPIL).map((b, i) => (
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
      {catatanTerpotong(tabel) ? (
        <p className="text-xs" style={{ color: 'var(--label)' }}>
          {catatanTerpotong(tabel)}
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
