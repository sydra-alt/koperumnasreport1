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
  /** Tautan tindak lanjut (impor opname: buka draf di pos-fnb). href SELALU path internal. */
  tautan?: { label: string; href: string };
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
export function tabelKeTsv(tabel: TabelAi, baris: Record<string, NilaiSel>[] = tabel.baris): string {
  const bersih = (v: NilaiSel) => (v === null ? '' : String(typeof v === 'boolean' ? (v ? 'Ya' : 'Tidak') : v)).replace(/[\t\n]/g, ' ');
  return [
    tabel.kolom.map((k) => k.label).join('\t'),
    ...baris.map((b) => tabel.kolom.map((k) => bersih(b[k.key] ?? null)).join('\t')),
  ].join('\n');
}

// ─── Cari / saring / urut (29 September 2026) ──────────────────────────────
// Di sisi klien pada baris yang SUDAH dikembalikan, dan fungsi yang SAMA
// dipakai /api/ai/ekspor -- Excel berisi persis yang tersaring di layar,
// dengan keterangan saringannya.

export type Saringan = { cari?: string; outlet?: string; urut?: string; arah?: 'naik' | 'turun' };

/** Kolom outlet ada -> pilihan saringan outlet (nilai unik, urut abjad). */
export function pilihanOutlet(tabel: TabelAi): string[] {
  if (!tabel.kolom.some((k) => k.key === 'outlet')) return [];
  const set = new Set<string>();
  for (const b of tabel.baris) if (typeof b.outlet === 'string' && b.outlet.trim() !== '') set.add(b.outlet);
  return [...set].sort((a, b) => a.localeCompare(b, 'id'));
}

function nilaiUrut(v: NilaiSel, jenis: JenisKolom): number | string | null {
  if (v === null || v === undefined || v === '') return null;
  if (jenis !== 'teks') {
    const n = Number(v);
    return Number.isFinite(n) ? n : String(v);
  }
  return typeof v === 'boolean' ? (v ? 'Ya' : 'Tidak') : String(v);
}

export function saringTabel(tabel: TabelAi, s: Saringan): Record<string, NilaiSel>[] {
  const cari = (s.cari ?? '').trim().toLowerCase();
  let baris = tabel.baris.filter((b) => {
    if (s.outlet && b.outlet !== s.outlet) return false;
    if (!cari) return true;
    return tabel.kolom.some((k) => teksSel(b[k.key] ?? null, k.jenis).toLowerCase().includes(cari) || String(b[k.key] ?? '').toLowerCase().includes(cari));
  });
  const kolom = s.urut ? tabel.kolom.find((k) => k.key === s.urut) : undefined;
  if (kolom) {
    const tanda = s.arah === 'turun' ? -1 : 1;
    baris = [...baris].sort((x, y) => {
      const a = nilaiUrut(x[kolom.key] ?? null, kolom.jenis);
      const b = nilaiUrut(y[kolom.key] ?? null, kolom.jenis);
      if (a === null && b === null) return 0;
      if (a === null) return 1; // kosong selalu di bawah
      if (b === null) return -1;
      if (typeof a === 'number' && typeof b === 'number') return (a - b) * tanda;
      return String(a).localeCompare(String(b), 'id', { numeric: true }) * tanda;
    });
  }
  return baris;
}

/** "cari "gula"; outlet Indokopi Jatinegara; urut Stok (turun)" -- null kalau tidak ada saringan. */
export function keteranganSaringan(tabel: TabelAi, s: Saringan): string | null {
  const bagian: string[] = [];
  if (s.cari?.trim()) bagian.push(`cari "${s.cari.trim()}"`);
  if (s.outlet) bagian.push(`outlet ${s.outlet}`);
  const kolom = s.urut ? tabel.kolom.find((k) => k.key === s.urut) : undefined;
  if (kolom) bagian.push(`urut ${kolom.label} (${s.arah === 'turun' ? 'turun' : 'naik'})`);
  return bagian.length > 0 ? bagian.join('; ') : null;
}

/** Saringan dari query string ekspor -- dibatasi, kolom harus ada di tabel. */
export function saringanDariQuery(tabel: TabelAi, q: URLSearchParams): Saringan {
  const cari = (q.get('cari') ?? '').slice(0, 100);
  const outlet = (q.get('outlet') ?? '').slice(0, 200);
  const urut = q.get('urut') ?? '';
  return {
    ...(cari ? { cari } : {}),
    ...(outlet ? { outlet } : {}),
    ...(tabel.kolom.some((k) => k.key === urut) ? { urut, arah: q.get('arah') === 'turun' ? ('turun' as const) : ('naik' as const) } : {}),
  };
}
