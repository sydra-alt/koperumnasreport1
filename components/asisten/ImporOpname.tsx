'use client';

import { useState, type FormEvent } from 'react';
import { GalatKirimAi, useImporOpname, useOutletImpor } from '../../lib/api/asisten';

/**
 * Panel impor opname dari Excel di /asisten (29 September 2026, fase 2).
 * AI cuma MEMBACA file; pencocokan ke master bahan & bendera
 * hijau/kuning/merah dari aturan pasti di pos-fnb. Tidak ada yang tercatat
 * ke stok dari sini -- hasilnya draf yang dibuka & dikonfirmasi manusia di
 * layar opname POS.
 */
export function ImporOpname({
  habis,
  onSelesai,
  onGalat,
}: {
  habis: boolean;
  onSelesai: (hasil: { percakapanId: string; pesanUser: unknown; pesanModel: unknown }) => void;
  onGalat: (pesan: string, percakapanId: string | null) => void;
}) {
  const outlet = useOutletImpor(true);
  const impor = useImporOpname();
  const [outletId, setOutletId] = useState('');
  const [file, setFile] = useState<File | null>(null);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    if (!outletId || !file || impor.isPending) return;
    try {
      onSelesai(await impor.mutateAsync({ outletId, file }));
    } catch (err) {
      onGalat(err instanceof GalatKirimAi ? err.message : 'Terjadi kesalahan. Coba lagi.', err instanceof GalatKirimAi ? err.percakapanId : null);
    }
  }

  const gayaIsian = {
    borderColor: 'var(--garis-tegas)',
    borderRadius: 'var(--radius-kecil)',
    background: 'var(--permukaan)',
    minHeight: 44,
  } as const;

  return (
    <form
      onSubmit={kirim}
      className="flex flex-col gap-3 border p-4"
      style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)', background: 'var(--permukaan)' }}
    >
      <div className="flex flex-col gap-1">
        <h2 style={{ fontWeight: 600 }}>Impor opname dari Excel</h2>
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          Satu file untuk satu outlet. AI membaca nama, jumlah, dan satuan; pencocokan ke daftar bahan memakai aturan pasti.
          Hasilnya draf di layar opname POS, belum ada yang tercatat ke stok sampai Anda konfirmasi di sana.
        </p>
      </div>

      {outlet.isError ? (
        <p className="text-sm" role="alert" style={{ color: 'var(--merah)' }}>
          {outlet.error instanceof Error ? outlet.error.message : 'Daftar outlet tidak bisa dibaca.'}
        </p>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Outlet
          <select
            id="impor-outlet"
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            disabled={outlet.isLoading || impor.isPending}
            className="border px-3"
            style={gayaIsian}
          >
            <option value="">{outlet.isLoading ? 'Memuat outlet...' : 'Pilih outlet'}</option>
            {outlet.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        File Excel (.xlsx, maks 1 MB, maks 600 baris)
        <input
          id="impor-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={impor.isPending}
          className="border p-2"
          style={gayaIsian}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={habis || !outletId || !file || impor.isPending}
          className="px-6 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--biru)', color: 'var(--kertas-2)', borderRadius: 'var(--radius-kecil)', minHeight: 44 }}
        >
          {impor.isPending ? 'Membaca file...' : 'Baca dan cocokkan'}
        </button>
        {habis ? (
          <span className="text-sm" style={{ color: 'var(--merah)' }}>
            Batas pesan hari ini sudah habis (satu impor = satu pesan).
          </span>
        ) : (
          <span className="text-sm" style={{ color: 'var(--label)' }}>Satu impor memakai satu pesan dari jatah harian.</span>
        )}
      </div>
    </form>
  );
}
