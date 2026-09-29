import ExcelJS from 'exceljs';
import type { TabelAi } from './tabel';

/**
 * Impor opname dari Excel (asisten AI, 29 September 2026, fase 2) -- bagian
 * sistem laporan: membaca file, meminta Gemini MEMBACA baris (nama, qty,
 * satuan apa adanya), lalu MEMVERIFIKASI bacaan itu terhadap sel file.
 *
 * AI tidak pernah mencocokkan ke master bahan dan tidak pernah memberi
 * bendera -- itu aturan pasti di pos-fnb (src/lib/opname-import/match.ts).
 * Di sini cuma satu keputusan: apakah yang "dibaca" AI benar-benar ada di
 * baris file itu (`terverifikasi`). Kalau tidak, pos-fnb menandainya MERAH.
 */

export type Sel = string | number | null;
export type BarisGrid = { nomor: number; sel: Sel[] };
export type Lembar = { nama: string; baris: BarisGrid[] };

export const MAKS_BYTE_FILE = 1_000_000;
export const MAKS_BARIS_FILE = 600;
export const MAKS_KOLOM = 20;

export class GalatFileImpor extends Error {}

type NilaiExcel = ExcelJS.CellValue;

function keSel(v: NilaiExcel): Sel {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
  if (typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('richText' in v && Array.isArray(v.richText)) return keSel(v.richText.map((r) => r.text).join(''));
    if ('formula' in v || 'sharedFormula' in v) return keSel((v as { result?: NilaiExcel }).result ?? null);
    if ('text' in v && typeof (v as { text?: unknown }).text === 'string') return keSel((v as { text: string }).text);
    if ('error' in v) return null;
  }
  return null;
}

/** Semua lembar, baris yang tidak kosong saja. Menolak file di luar batas (bukan memotong diam-diam). */
export async function bacaGrid(data: ArrayBuffer): Promise<Lembar[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    throw new GalatFileImpor('File tidak bisa dibaca. Pastikan formatnya .xlsx (Excel), bukan .xls/.csv.');
  }
  const hasil: Lembar[] = [];
  let total = 0;
  wb.eachSheet((ws) => {
    const baris: BarisGrid[] = [];
    ws.eachRow({ includeEmpty: false }, (row, nomor) => {
      const sel: Sel[] = [];
      for (let k = 1; k <= Math.min(row.cellCount, MAKS_KOLOM); k++) sel.push(keSel(row.getCell(k).value));
      while (sel.length > 0 && sel[sel.length - 1] === null) sel.pop();
      if (sel.some((s) => s !== null)) baris.push({ nomor, sel });
    });
    total += baris.length;
    if (baris.length > 0) hasil.push({ nama: ws.name, baris });
  });
  if (total === 0) throw new GalatFileImpor('File kosong: tidak ada baris berisi.');
  if (total > MAKS_BARIS_FILE) {
    throw new GalatFileImpor(`File berisi ${total} baris; maksimal ${MAKS_BARIS_FILE}. Pecah per outlet atau hapus baris yang tidak perlu.`);
  }
  return hasil;
}

/** Teks untuk model: nomor lembar, nomor baris file, sel dipisah " | ". */
export function gridUntukModel(grid: Lembar[]): string {
  return grid
    .map((l, i) =>
      [`### Lembar ${i + 1}: ${l.nama}`, ...l.baris.map((b) => `${b.nomor} | ${b.sel.map((s) => (s === null ? '' : String(s))).join(' | ')}`)].join('\n'),
    )
    .join('\n\n');
}

export const INSTRUKSI_BACA = [
  'Anda membaca file stok opname (hitung fisik bahan) dari sebuah restoran.',
  'Setiap baris diawali nomor baris file, sel dipisah " | ".',
  'Kembalikan SATU entri untuk setiap baris yang berisi SATU bahan dengan jumlah hasil hitung fisiknya.',
  '- nama: salin PERSIS isi sel nama bahan (huruf, spasi, tanda baca apa adanya). Jangan diterjemahkan, dirapikan, disingkat, atau digabung.',
  '- qty: angka jumlah fisik PERSIS dari sel. Jangan dikonversi, dibulatkan, atau dihitung. Kalau ada beberapa kolom angka (stok awal, masuk, keluar, stok akhir), pakai kolom hasil hitung fisik / stok akhir. null kalau sel kosong.',
  '- satuan: salin PERSIS satuan yang tertulis untuk baris itu (di sel baris itu, atau di judul kolom). null kalau tidak tertulis. Jangan menebak.',
  '- lembar: nomor lembar; baris: nomor baris file (angka di awal baris).',
  'Lewati judul, subtotal, total, dan baris tanpa bahan. Jangan menambah bahan yang tidak ada di file.',
].join('\n');

export const SKEMA_BACA = {
  type: 'OBJECT',
  properties: {
    baris: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          lembar: { type: 'INTEGER' },
          baris: { type: 'INTEGER' },
          nama: { type: 'STRING' },
          qty: { type: 'NUMBER', nullable: true },
          satuan: { type: 'STRING', nullable: true },
        },
        required: ['lembar', 'baris', 'nama', 'qty', 'satuan'],
      },
    },
  },
  required: ['baris'],
} as const;

/** Bacaan mentah AI (disimpan apa adanya di riwayat pos-fnb). */
export type BacaanAi = { lembar: string; baris: number; nama: string; qty: number | null; satuan: string | null };

export function parseBacaan(teks: string, grid: Lembar[]): BacaanAi[] {
  let data: unknown;
  try {
    data = JSON.parse(teks);
  } catch {
    throw new GalatFileImpor('Bacaan AI tidak valid (bukan JSON). Coba unggah ulang.');
  }
  const baris = (data as { baris?: unknown }).baris;
  if (!Array.isArray(baris)) throw new GalatFileImpor('Bacaan AI tidak valid. Coba unggah ulang.');
  const hasil: BacaanAi[] = [];
  for (const b of baris) {
    if (typeof b !== 'object' || b === null) continue;
    const o = b as Record<string, unknown>;
    const idx = typeof o.lembar === 'number' ? o.lembar - 1 : -1;
    const lembar = grid[idx]?.nama ?? `#${String(o.lembar)}`;
    if (typeof o.baris !== 'number' || typeof o.nama !== 'string' || o.nama.trim() === '') continue;
    hasil.push({
      lembar,
      baris: o.baris,
      nama: o.nama,
      qty: typeof o.qty === 'number' && Number.isFinite(o.qty) ? o.qty : null,
      satuan: typeof o.satuan === 'string' && o.satuan.trim() !== '' ? o.satuan.trim() : null,
    });
  }
  return hasil;
}

const normTeks = (s: string) => s.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
const token = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export type BarisSumber = BacaanAi & { terverifikasi: boolean };

/**
 * Bacaan AI dianggap benar HANYA kalau, di lembar + baris yang ia sebut:
 * - ada sel teks yang sama persis dengan `nama` (huruf besar/kecil & spasi ganda diabaikan);
 * - ada sel angka yang sama dengan `qty` (kalau qty tidak null);
 * - `satuan` (kalau ada) muncul sebagai kata di baris itu atau di baris di atasnya (judul kolom).
 * Selain itu `terverifikasi: false` -> pos-fnb menandai MERAH, tidak diisi otomatis.
 */
export function verifikasiBacaan(bacaan: BacaanAi[], grid: Lembar[]): BarisSumber[] {
  return bacaan.map((b) => {
    const lembar = grid.find((l) => l.nama === b.lembar);
    const idx = lembar ? lembar.baris.findIndex((r) => r.nomor === b.baris) : -1;
    if (!lembar || idx < 0) return { ...b, terverifikasi: false };
    const sel = lembar.baris[idx]!.sel;
    const namaOk = sel.some((s) => typeof s === 'string' && normTeks(s) === normTeks(b.nama));
    const qtyOk =
      b.qty === null ||
      sel.some((s) => (typeof s === 'number' ? Math.abs(s - b.qty!) < 1e-9 : typeof s === 'string' && /^-?\d+(\.\d+)?$/.test(s.trim()) && Number(s) === b.qty));
    let satuanOk = true;
    if (b.satuan !== null) {
      const cari = b.satuan.toLowerCase().replace(/[.\s]/g, '');
      satuanOk = lembar.baris
        .slice(0, idx + 1)
        .some((r) => r.sel.some((s) => s !== null && token(String(s)).includes(cari)));
    }
    return { ...b, terverifikasi: namaOk && qtyOk && satuanOk };
  });
}

// --- Hasil dari pos-fnb (ImportRowResult di src/lib/opname-import/match.ts) ---

export type BarisHasilImpor = {
  lembar: string;
  baris: number;
  namaFile: string;
  qtyFile: string | null;
  satuanFile: string | null;
  flag: 'hijau' | 'kuning' | 'merah';
  alasan: string[];
  ingredientId: string | null;
  ingredientName: string | null;
  baseUnit: string | null;
  qtyUsulan: string | null;
  stokBerjalan: string | null;
  kandidat: string[];
};

const URUT_BENDERA = { merah: 0, kuning: 1, hijau: 2 } as const;
const LABEL_BENDERA = { merah: 'Merah', kuning: 'Kuning', hijau: 'Hijau' } as const;

export function tautanDrafOpname(importId: string): string {
  return `/api/pos-handoff?next=${encodeURIComponent(`/stock-opnames?import=${importId}`)}`;
}

export function tabelHasilImpor(rows: BarisHasilImpor[], importId: string): TabelAi {
  const urut = [...rows].sort((a, b) => URUT_BENDERA[a.flag] - URUT_BENDERA[b.flag]);
  return {
    judul: 'Hasil impor opname',
    kolom: [
      { key: 'bendera', label: 'Bendera', jenis: 'teks' },
      { key: 'lokasi', label: 'Baris file', jenis: 'teks' },
      { key: 'nama_file', label: 'Nama di file', jenis: 'teks' },
      { key: 'qty_file', label: 'Qty file', jenis: 'teks' },
      { key: 'satuan_file', label: 'Satuan file', jenis: 'teks' },
      { key: 'bahan', label: 'Bahan master', jenis: 'teks' },
      { key: 'qty_usulan', label: 'Qty usulan', jenis: 'angka' },
      { key: 'satuan_dasar', label: 'Satuan dasar', jenis: 'teks' },
      { key: 'alasan', label: 'Alasan', jenis: 'teks' },
    ],
    baris: urut.map((r) => ({
      bendera: LABEL_BENDERA[r.flag],
      lokasi: `${r.lembar}!${r.baris}`,
      nama_file: r.namaFile,
      qty_file: r.qtyFile,
      satuan_file: r.satuanFile,
      bahan: r.ingredientName,
      qty_usulan: r.qtyUsulan === null ? null : Number(r.qtyUsulan),
      satuan_dasar: r.baseUnit,
      alasan: r.alasan.join('; '),
    })),
    totalBaris: urut.length,
    tautan: { label: 'Buka draf di layar opname POS', href: tautanDrafOpname(importId) },
  };
}

export function ringkasanImpor(p: {
  outletNama: string;
  fileNama: string;
  counts: { hijau: number; kuning: number; merah: number };
}): string {
  const n = p.counts.hijau + p.counts.kuning + p.counts.merah;
  return (
    `${p.outletNama}: ${n} baris dibaca dari ${p.fileNama} -- ${p.counts.hijau} hijau, ${p.counts.kuning} kuning, ${p.counts.merah} merah. ` +
    'Belum ada yang tercatat ke stok. Buka draf di layar opname POS: hijau dan kuning sudah terisi (periksa yang kuning), merah tidak diisi, lalu konfirmasi di sana.'
  );
}
