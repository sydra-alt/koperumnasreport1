/**
 * 'Cadangan terakhir: N hari lalu' (7 Oktober 2026) dari baris status_cadangan
 * yang ditulis job cadangan (scripts/cadangan/cadangkan.mjs). Murni --
 * dipakai Admin (app/admin) dan diuji langsung. Peringatan kalau cadangan OK
 * terakhir lebih tua dari BATAS_HARI, belum pernah ada, atau percobaan
 * terakhir gagal.
 */
export const BATAS_HARI = 8;

export type BarisStatusCadangan = {
  terakhirOk: Date | null;
  hasilTerakhir: string;
  ukuranByte: number | null;
};

export type RingkasanCadangan = { teks: string; peringatan: boolean; catatan: string | null };

const tanggalWib = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);

export function ringkasCadangan(baris: BarisStatusCadangan | null, sekarang: Date): RingkasanCadangan {
  if (!baris || !baris.terakhirOk) {
    return { teks: 'Cadangan terakhir: belum pernah tercatat', peringatan: true, catatan: 'Jalankan cadangan di laptop cadangan (lihat docs/PEMULIHAN-DATA.md).' };
  }
  const hari = Math.round((Date.parse(tanggalWib(sekarang)) - Date.parse(tanggalWib(baris.terakhirOk))) / 86_400_000);
  const teks = `Cadangan terakhir: ${hari <= 0 ? 'hari ini' : `${hari} hari lalu`}`;
  const terlalulama = sekarang.getTime() - baris.terakhirOk.getTime() > BATAS_HARI * 86_400_000;
  const gagal = baris.hasilTerakhir !== 'ok';
  const catatan = terlalulama
    ? `Lebih dari ${BATAS_HARI} hari tanpa cadangan -- nyalakan laptop cadangan atau jalankan cadangan sekarang.`
    : gagal
      ? 'Percobaan cadangan terakhir GAGAL -- lihat cadangan.log di laptop cadangan.'
      : null;
  return { teks, peringatan: terlalulama || gagal, catatan };
}
