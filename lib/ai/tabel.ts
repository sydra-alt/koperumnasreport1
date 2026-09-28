import { formatRupiah } from '../rupiah';

/**
 * Bentuk tabel yang ditampilkan bersama jawaban asisten AI (disimpan apa
 * adanya di ai_pesan.tabel, dipakai layar, salin, dan ekspor Excel).
 */
export type JenisKolom = 'teks' | 'angka' | 'rupiah';

export type KolomTabelAi = { key: string; label: string; jenis: JenisKolom };

export type NilaiSel = string | number | boolean | null;

export type TabelAi = {
  judul: string;
  kolom: KolomTabelAi[];
  baris: Record<string, NilaiSel>[];
  /** Jumlah baris sebenarnya di sumber -- bisa lebih besar dari baris.length kalau dipotong. */
  totalBaris: number;
};

export function teksSel(nilai: NilaiSel, jenis: JenisKolom): string {
  if (nilai === null || nilai === undefined) return '';
  if (typeof nilai === 'boolean') return nilai ? 'Ya' : 'Tidak';
  if (jenis === 'rupiah' || jenis === 'angka') {
    const n = Number(nilai);
    if (!Number.isFinite(n)) return String(nilai);
    return jenis === 'rupiah' ? formatRupiah(n) : n.toLocaleString('id-ID', { maximumFractionDigits: 4 });
  }
  return String(nilai);
}

/** TSV untuk tombol Salin -- bisa langsung ditempel ke spreadsheet. Angka mentah, bukan teks berformat. */
export function tabelKeTsv(tabel: TabelAi): string {
  const bersih = (v: NilaiSel) => (v === null ? '' : String(typeof v === 'boolean' ? (v ? 'Ya' : 'Tidak') : v)).replace(/[\t\n]/g, ' ');
  return [
    tabel.kolom.map((k) => k.label).join('\t'),
    ...tabel.baris.map((b) => tabel.kolom.map((k) => bersih(b[k.key] ?? null)).join('\t')),
  ].join('\n');
}
