'use client';

import { useState, type FormEvent } from 'react';
import { GalatKirimAi, useImporResep } from '../../lib/api/asisten';

/**
 * Panel impor resep dari Excel di /asisten (29 September 2026). AI cuma
 * MEMBACA file; pencocokan ke master produk & bahan dan bendera dari aturan
 * pasti di pos-fnb. Tidak ada resep yang tersimpan dari sini -- hasilnya draf
 * di editor resep POS, disimpan manusia per produk. Resep berlaku untuk
 * seluruh bisnis, jadi tidak ada pilihan outlet.
 */
export function ImporResep({
  habis,
  onSelesai,
  onGalat,
}: {
  habis: boolean;
  onSelesai: (hasil: { percakapanId: string; pesanUser: unknown; pesanModel: unknown }) => void;
  onGalat: (pesan: string, percakapanId: string | null) => void;
}) {
  const impor = useImporResep();
  const [file, setFile] = useState<File | null>(null);

  async function kirim(e: FormEvent) {
    e.preventDefault();
    if (!file || impor.isPending) return;
    try {
      onSelesai(await impor.mutateAsync({ file }));
    } catch (err) {
      onGalat(err instanceof GalatKirimAi ? err.message : 'Terjadi kesalahan. Coba lagi.', err instanceof GalatKirimAi ? err.percakapanId : null);
    }
  }

  return (
    <form
      onSubmit={kirim}
      className="flex flex-col gap-3 border p-4"
      style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)', background: 'var(--permukaan)' }}
    >
      <div className="flex flex-col gap-1">
        <h2 style={{ fontWeight: 600 }}>Impor resep dari Excel</h2>
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          Isi file: produk, bahan, jumlah per porsi, dan satuan. AI hanya membaca; pencocokan ke daftar produk dan bahan memakai aturan
          pasti. Hasilnya draf di editor resep POS -- tidak ada resep yang tersimpan sampai Anda menyimpannya per produk di sana, dan
          resep yang sudah ada tidak ditimpa tanpa konfirmasi.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        File Excel (.xlsx, maks 1 MB, maks 600 baris)
        <input
          id="impor-resep-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={impor.isPending}
          className="border p-2"
          style={{ borderColor: 'var(--garis-tegas)', borderRadius: 'var(--radius-kecil)', background: 'var(--permukaan)', minHeight: 44 }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={habis || !file || impor.isPending}
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
