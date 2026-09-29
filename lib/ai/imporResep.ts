import type { TabelAi } from './tabel';
import { GalatFileImpor, type Lembar } from './imporOpname';

/**
 * Impor resep dari Excel (asisten AI, 29 September 2026) -- pola SAMA dengan
 * impor opname (lib/ai/imporOpname.ts): AI hanya MEMBACA baris (produk,
 * bahan, qty per porsi, satuan apa adanya), sistem laporan MEMVERIFIKASI
 * bacaan itu terhadap sel file, dan pos-fnb mencocokkan ke master produk &
 * bahan dengan aturan pasti (src/lib/recipe-import/match.ts). Tidak ada yang
 * tersimpan sampai manusia mengonfirmasi per produk di editor resep POS.
 */

export const INSTRUKSI_BACA_RESEP = [
  'Anda membaca file resep (komposisi bahan per porsi) dari sebuah restoran.',
  'Setiap baris diawali nomor baris file, sel dipisah " | ".',
  'Kembalikan SATU entri untuk setiap bahan dalam resep sebuah produk.',
  '- produk: salin PERSIS nama produk/menu pemilik bahan itu. Kalau file dikelompokkan (nama produk di baris judul, bahan di baris-baris bawahnya), pakai nama produk dari baris judul terakhir di atasnya.',
  '- bahan: salin PERSIS isi sel nama bahan. Jangan diterjemahkan, dirapikan, disingkat, atau digabung.',
  '- qty: angka jumlah bahan PER PORSI PERSIS dari sel. Jangan dikonversi, dibulatkan, atau dihitung. null kalau sel kosong.',
  '- satuan: salin PERSIS satuan yang tertulis untuk baris itu (di sel baris itu, atau di judul kolom). null kalau tidak tertulis. Jangan menebak.',
  '- lembar: nomor lembar; baris: nomor baris file tempat BAHAN itu berada.',
  'Lewati judul, catatan, harga, total, dan baris tanpa bahan. Jangan menambah produk atau bahan yang tidak ada di file.',
].join('\n');

export const SKEMA_BACA_RESEP = {
  type: 'OBJECT',
  properties: {
    baris: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          lembar: { type: 'INTEGER' },
          baris: { type: 'INTEGER' },
          produk: { type: 'STRING' },
          bahan: { type: 'STRING' },
          qty: { type: 'NUMBER', nullable: true },
          satuan: { type: 'STRING', nullable: true },
        },
        required: ['lembar', 'baris', 'produk', 'bahan', 'qty', 'satuan'],
      },
    },
  },
  required: ['baris'],
} as const;

export type BacaanResep = { lembar: string; baris: number; produk: string; bahan: string; qty: number | null; satuan: string | null };

export function parseBacaanResep(teks: string, grid: Lembar[]): BacaanResep[] {
  let data: unknown;
  try {
    data = JSON.parse(teks);
  } catch {
    throw new GalatFileImpor('Bacaan AI tidak valid (bukan JSON). Coba unggah ulang.');
  }
  const baris = (data as { baris?: unknown }).baris;
  if (!Array.isArray(baris)) throw new GalatFileImpor('Bacaan AI tidak valid. Coba unggah ulang.');
  const hasil: BacaanResep[] = [];
  for (const b of baris) {
    if (typeof b !== 'object' || b === null) continue;
    const o = b as Record<string, unknown>;
    const idx = typeof o.lembar === 'number' ? o.lembar - 1 : -1;
    const lembar = grid[idx]?.nama ?? `#${String(o.lembar)}`;
    if (typeof o.baris !== 'number' || typeof o.produk !== 'string' || typeof o.bahan !== 'string') continue;
    if (o.produk.trim() === '' || o.bahan.trim() === '') continue;
    hasil.push({
      lembar,
      baris: o.baris,
      produk: o.produk,
      bahan: o.bahan,
      qty: typeof o.qty === 'number' && Number.isFinite(o.qty) ? o.qty : null,
      satuan: typeof o.satuan === 'string' && o.satuan.trim() !== '' ? o.satuan.trim() : null,
    });
  }
  return hasil;
}

const normTeks = (s: string) => s.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
const token = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

export type BarisSumberResep = BacaanResep & { terverifikasi: boolean };

/**
 * Bacaan AI dianggap benar HANYA kalau, di lembar + baris yang ia sebut:
 * - ada sel teks yang sama persis dengan `bahan`;
 * - `produk` sama persis dengan sel teks di baris itu ATAU di baris di atasnya
 *   pada lembar yang sama (file yang dikelompokkan per produk);
 * - ada sel angka yang sama dengan `qty` (kalau tidak null);
 * - `satuan` (kalau ada) muncul sebagai kata di baris itu atau di atasnya.
 * Selain itu `terverifikasi: false` -> pos-fnb menandai MERAH.
 */
export function verifikasiBacaanResep(bacaan: BacaanResep[], grid: Lembar[]): BarisSumberResep[] {
  return bacaan.map((b) => {
    const lembar = grid.find((l) => l.nama === b.lembar);
    const idx = lembar ? lembar.baris.findIndex((r) => r.nomor === b.baris) : -1;
    if (!lembar || idx < 0) return { ...b, terverifikasi: false };
    const sel = lembar.baris[idx]!.sel;
    const diAtas = lembar.baris.slice(0, idx + 1);
    const bahanOk = sel.some((s) => typeof s === 'string' && normTeks(s) === normTeks(b.bahan));
    const produkOk = diAtas.some((r) => r.sel.some((s) => typeof s === 'string' && normTeks(s) === normTeks(b.produk)));
    const qtyOk =
      b.qty === null ||
      sel.some((s) => (typeof s === 'number' ? Math.abs(s - b.qty!) < 1e-9 : typeof s === 'string' && /^-?\d+(\.\d+)?$/.test(s.trim()) && Number(s) === b.qty));
    let satuanOk = true;
    if (b.satuan !== null) {
      const cari = b.satuan.toLowerCase().replace(/[.\s]/g, '');
      satuanOk = diAtas.some((r) => r.sel.some((s) => s !== null && token(String(s)).includes(cari)));
    }
    return { ...b, terverifikasi: bahanOk && produkOk && qtyOk && satuanOk };
  });
}

// --- Hasil dari pos-fnb (src/lib/recipe-import/match.ts) ---

export type Bendera = 'hijau' | 'kuning' | 'merah';

export type BarisResepHasil = {
  lembar: string;
  baris: number;
  bahanFile: string;
  qtyFile: string | null;
  satuanFile: string | null;
  flag: Bendera;
  alasan: string[];
  ingredientName: string | null;
  baseUnit: string | null;
  qtyUsulan: string | null;
};

export type ProdukResepHasil = {
  produkFile: string;
  productId: string | null;
  productName: string | null;
  flag: Bendera;
  alasan: string[];
  sudahAdaResep: boolean;
  baris: BarisResepHasil[];
};

export type RingkasanResep = {
  produk: number;
  produkTidakDikenali: number;
  produkSudahAdaResep: number;
  baris: { hijau: number; kuning: number; merah: number };
};

const URUT = { merah: 0, kuning: 1, hijau: 2 } as const;
const LABEL = { merah: 'Merah', kuning: 'Kuning', hijau: 'Hijau' } as const;

export function tautanDrafResep(importId: string): string {
  return `/api/pos-handoff?next=${encodeURIComponent(`/recipes?import=${importId}`)}`;
}

export function tabelHasilImporResep(produk: ProdukResepHasil[], importId: string): TabelAi {
  const baris = produk
    .flatMap((p) =>
      p.baris.map((r) => ({
        urut: Math.min(URUT[r.flag], URUT[p.flag]),
        bendera: LABEL[URUT[r.flag] < URUT[p.flag] ? r.flag : p.flag],
        produk_file: p.produkFile,
        produk: p.productName,
        resep_ada: p.sudahAdaResep ? 'Ya (perlu konfirmasi timpa)' : 'Belum',
        lokasi: `${r.lembar}!${r.baris}`,
        bahan_file: r.bahanFile,
        qty_file: r.qtyFile,
        satuan_file: r.satuanFile,
        bahan: r.ingredientName,
        qty_usulan: r.qtyUsulan === null ? null : Number(r.qtyUsulan),
        satuan_dasar: r.baseUnit,
        alasan: [...p.alasan, ...r.alasan].join('; '),
      })),
    )
    .sort((a, b) => a.urut - b.urut)
    .map(({ urut: _urut, ...r }) => r);
  return {
    judul: 'Hasil impor resep',
    kolom: [
      { key: 'bendera', label: 'Bendera', jenis: 'teks' },
      { key: 'produk_file', label: 'Produk di file', jenis: 'teks' },
      { key: 'produk', label: 'Produk master', jenis: 'teks' },
      { key: 'resep_ada', label: 'Sudah ada resep', jenis: 'teks' },
      { key: 'lokasi', label: 'Baris file', jenis: 'teks' },
      { key: 'bahan_file', label: 'Bahan di file', jenis: 'teks' },
      { key: 'qty_file', label: 'Qty file', jenis: 'teks' },
      { key: 'satuan_file', label: 'Satuan file', jenis: 'teks' },
      { key: 'bahan', label: 'Bahan master', jenis: 'teks' },
      { key: 'qty_usulan', label: 'Qty per porsi (usulan)', jenis: 'angka' },
      { key: 'satuan_dasar', label: 'Satuan dasar', jenis: 'teks' },
      { key: 'alasan', label: 'Alasan', jenis: 'teks' },
    ],
    baris,
    totalBaris: baris.length,
    tautan: { label: 'Buka draf di editor resep POS', href: tautanDrafResep(importId) },
  };
}

/** Kalimat utama impor resep -- semua angka dari hitungan pos-fnb, bukan dari AI. */
export function ringkasanImporResep(p: { fileNama: string; ringkasan: RingkasanResep }): string {
  const r = p.ringkasan;
  const n = r.baris.hijau + r.baris.kuning + r.baris.merah;
  const bagian = [
    `${r.produk} produk, ${n} baris bahan dibaca dari ${p.fileNama} -- ${r.baris.hijau} hijau, ${r.baris.kuning} kuning, ${r.baris.merah} merah.`,
  ];
  if (r.produkTidakDikenali > 0) bagian.push(`${r.produkTidakDikenali} produk tidak dikenali di master produk (tidak bisa dibuka).`);
  if (r.produkSudahAdaResep > 0) bagian.push(`${r.produkSudahAdaResep} produk sudah punya resep dan TIDAK ditimpa tanpa konfirmasi per produk.`);
  bagian.push('Belum ada yang tersimpan. Buka draf di editor resep POS: hijau dan kuning sudah terisi (periksa yang kuning), merah tidak diisi, lalu simpan per produk.');
  return bagian.join(' ');
}
