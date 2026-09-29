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

/** Baris yang digambar di layar per tabel; sisanya lewat Unduh Excel. */
export const BARIS_TAMPIL = 200;

const angka = (n: number) => n.toLocaleString('id-ID');

/**
 * Kalimat wajib kalau tabel terpotong (koreksi CEO 29 September 2026: baris
 * TIDAK PERNAH boleh hilang diam-diam). null = semua baris tampil.
 * - total > yang tampil, semua tersimpan -> Excel berisi semuanya
 * - total > yang tersimpan (sumber membatasi) -> Excel berisi N pertama, disebut
 */
export function catatanTerpotong(tabel: TabelAi): string | null {
  const tampil = Math.min(BARIS_TAMPIL, tabel.baris.length);
  if (tabel.totalBaris <= tampil) return null;
  const ekspor =
    tabel.baris.length >= tabel.totalBaris
      ? 'semua baris ada di Unduh Excel'
      : `Unduh Excel memuat ${angka(tabel.baris.length)} baris pertama`;
  return `Menampilkan ${angka(tampil)} dari ${angka(tabel.totalBaris)} baris ${tabel.judul.toLowerCase()}; ${ekspor}.`;
}

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
