'use client';

import { GalatKirimAi, useTinjauanUkuran } from '../../lib/api/asisten';

/**
 * Tinjauan jenis ukuran bahan (29 September 2026): AI mengusulkan volume /
 * berat / hitungan untuk tiap bahan yang belum ditentukan; manusia
 * mengonfirmasi atau mengubah tiap usulan di POS. Tidak ada yang tersimpan
 * dari sini.
 */
export function TinjauUkuran({
  habis,
  onSelesai,
  onGalat,
}: {
  habis: boolean;
  onSelesai: (hasil: { percakapanId: string; pesanUser: unknown; pesanModel: unknown }) => void;
  onGalat: (pesan: string, percakapanId: string | null) => void;
}) {
  const tinjau = useTinjauanUkuran();

  async function mulai() {
    if (tinjau.isPending) return;
    try {
      onSelesai(await tinjau.mutateAsync());
    } catch (err) {
      onGalat(err instanceof GalatKirimAi ? err.message : 'Terjadi kesalahan. Coba lagi.', err instanceof GalatKirimAi ? err.percakapanId : null);
    }
  }

  return (
    <section
      className="flex flex-col gap-3 border p-4"
      style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)', background: 'var(--permukaan)' }}
    >
      <div className="flex flex-col gap-1">
        <h2 style={{ fontWeight: 600 }}>Tinjau jenis ukuran bahan</h2>
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          AI mengusulkan apakah tiap bahan diukur dengan volume (ml, liter), berat (gram, kg), atau hitungan (pcs, porsi) -- dari namanya.
          Tidak ada yang tersimpan sampai Anda mengonfirmasi atau mengubah tiap bahan di POS (Bahan &gt; Tinjauan jenis ukuran). Cek anomali
          satuan hanya berlaku untuk bahan yang sudah dikonfirmasi.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={mulai}
          disabled={habis || tinjau.isPending}
          className="px-6 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--biru)', color: 'var(--kertas-2)', borderRadius: 'var(--radius-kecil)', minHeight: 44 }}
        >
          {tinjau.isPending ? 'Menyusun usulan...' : 'Minta usulan AI'}
        </button>
        <span className="text-sm" style={{ color: habis ? 'var(--merah)' : 'var(--label)' }}>
          {habis ? 'Batas pesan hari ini sudah habis.' : 'Memakai satu pesan dari jatah harian.'}
        </span>
      </div>
    </section>
  );
}
