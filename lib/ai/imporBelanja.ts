import type { TabelAi } from './tabel';

/**
 * Impor belanja dari foto nota kertas (asisten AI, 3 Oktober 2026) -- bagian
 * sistem laporan: Gemini MEMBACA foto (nama barang, qty, satuan, total baris,
 * total nota kalau tertulis) menjadi DRAF. Tidak ada pencocokan di sini.
 *
 * Bacaan dari foto TIDAK BISA diverifikasi terhadap sel seperti Excel, jadi
 * pos-fnb (src/lib/purchase-import/match.ts) tidak pernah memberi HIJAU:
 * setiap baris paling baik KUNING dan wajib dilihat manusia. Bendera, harga
 * per satuan, dan selisih total nota dihitung pos-fnb dengan aturan pasti;
 * stok baru berubah saat manusia mengonfirmasi di layar Pembelian POS.
 */

export const MAKS_BYTE_FOTO_ASLI = 5_000_000; // batas pilihan file di layar
export const MAKS_BYTE_FOTO = 4_000_000; // sesudah dikecilkan di browser (batas badan permintaan Vercel 4,5 MB)
export const MAKS_BARIS_NOTA = 100;
export const JENIS_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;

export class GalatFotoBelanja extends Error {}

export const INSTRUKSI_BELANJA = [
  'Anda membaca FOTO nota belanja bahan restoran (bisa tulisan tangan atau struk cetak).',
  'Kembalikan SATU entri untuk setiap baris barang yang dibeli, urut dari atas ke bawah.',
  '- nomor: urutan baris di nota (1, 2, 3, ...).',
  '- nama: salin nama barang PERSIS seperti tertulis. Jangan diterjemahkan, dirapikan, atau ditebak kalau tidak terbaca -- tulis apa yang terlihat.',
  '- qty: jumlah yang dibeli sebagai angka (1,5 kg -> 1.5). null kalau tidak tertulis atau tidak terbaca.',
  '- satuan: satuan PERSIS seperti tertulis (kg, gr, liter, pcs, pack, dus, ikat, ...). null kalau tidak tertulis. Jangan menebak.',
  '- total: total rupiah BARIS ITU sebagai angka bulat (titik pemisah ribuan dibuang: "15.000" -> 15000, "15rb" -> 15000). Kalau baris hanya menulis harga satuan, isi total = null. Jangan menghitung qty x harga.',
  '- harga: harga SATUAN yang TERTULIS di baris itu (mis. "@12.000", "12rb/kg", kolom harga), angka bulat rupiah per satuan yang tertulis. null kalau tidak tertulis. Jangan menghitung (jangan membagi total dengan qty).',
  '- total_nota: total keseluruhan yang TERTULIS di nota (angka bulat rupiah), null kalau tidak ada. Jangan menjumlahkan sendiri.',
  'Lewati judul toko, tanggal, subtotal, diskon, dan baris tanpa barang. Jangan menambah barang yang tidak ada di foto.',
].join('\n');

export const SKEMA_BELANJA = {
  type: 'OBJECT',
  properties: {
    baris: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nomor: { type: 'INTEGER' },
          nama: { type: 'STRING' },
          qty: { type: 'NUMBER', nullable: true },
          satuan: { type: 'STRING', nullable: true },
          total: { type: 'NUMBER', nullable: true },
          harga: { type: 'NUMBER', nullable: true },
        },
        required: ['nomor', 'nama', 'qty', 'satuan', 'total'],
      },
    },
    total_nota: { type: 'NUMBER', nullable: true },
  },
  required: ['baris', 'total_nota'],
} as const;

/** Satu baris bacaan AI (dikirim ke pos-fnb apa adanya; disimpan sebagai bacaan mentah). */
export type BarisBacaanBelanja = { nomor: number; nama: string; qty: number | null; satuan: string | null; total: number | null; harga: number | null };

const angka = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parseBacaanBelanja(teks: string): { baris: BarisBacaanBelanja[]; totalNota: number | null; mentah: unknown } {
  let data: unknown;
  try {
    data = JSON.parse(teks);
  } catch {
    throw new GalatFotoBelanja('Bacaan AI tidak valid (bukan JSON). Coba unggah ulang.');
  }
  const o = (data ?? {}) as { baris?: unknown; total_nota?: unknown };
  if (!Array.isArray(o.baris)) throw new GalatFotoBelanja('Bacaan AI tidak valid. Coba unggah ulang.');
  const baris: BarisBacaanBelanja[] = [];
  for (const b of o.baris) {
    if (typeof b !== 'object' || b === null) continue;
    const r = b as Record<string, unknown>;
    if (typeof r.nama !== 'string' || r.nama.trim() === '') continue;
    baris.push({
      nomor: typeof r.nomor === 'number' && Number.isInteger(r.nomor) ? r.nomor : baris.length + 1,
      nama: r.nama.trim().slice(0, 200),
      qty: angka(r.qty),
      satuan: typeof r.satuan === 'string' && r.satuan.trim() !== '' ? r.satuan.trim().slice(0, 40) : null,
      total: angka(r.total),
      harga: angka(r.harga),
    });
  }
  if (baris.length > MAKS_BARIS_NOTA) {
    throw new GalatFotoBelanja(`Nota berisi ${baris.length} baris; maksimal ${MAKS_BARIS_NOTA}. Foto per halaman.`);
  }
  return { baris, totalNota: angka(o.total_nota), mentah: data };
}

// --- Hasil dari pos-fnb (PurchaseRowResult di src/lib/purchase-import/match.ts) ---

export type BarisHasilBelanja = {
  nomor: number;
  namaFoto: string;
  qtyFoto: string | null;
  satuanFoto: string | null;
  totalFoto: string | null;
  flag: 'kuning' | 'merah';
  alasan: string[];
  ingredientId: string | null;
  ingredientName: string | null;
  baseUnit: string | null;
  qtyDasar: string | null;
  hargaPerDasar: string | null;
  pembanding: string | null;
  // 3 Oktober 2026 -- tidak ada di jawaban pos-fnb lama.
  hargaFoto?: string | null;
  diturunkan?: 'qty' | 'harga' | 'total' | null;
  qtyDipakai?: string | null;
  hargaSatuanDipakai?: string | null;
  totalDipakai?: string | null;
  perluKonfirmasiHarga?: boolean;
  satuanTakDikenal?: string | null;
};

export type RingkasanBelanjaPos = {
  kuning: number;
  merah: number;
  /** Jumlah total baris yang terbaca (dihitung pos-fnb). */
  jumlahTotalBaris: string;
  /** Total nota yang tertulis (null = tidak ada). */
  totalNota: string | null;
  /** true kalau total nota tertulis dan beda dari jumlah total baris. */
  totalBeda: boolean;
  barisTanpaTotal: number;
};

export function tautanDrafBelanja(importId: string): string {
  return `/api/pos-handoff?next=${encodeURIComponent(`/purchases?import=${importId}`)}`;
}

const URUT = { merah: 0, kuning: 1 } as const;

export function tabelHasilBelanja(rows: BarisHasilBelanja[], importId: string): TabelAi {
  const urut = [...rows].sort((a, b) => URUT[a.flag] - URUT[b.flag] || a.nomor - b.nomor);
  const n = (v: string | null) => (v === null ? null : Number(v));
  return {
    judul: 'Hasil baca nota belanja',
    kolom: [
      { key: 'bendera', label: 'Bendera', jenis: 'teks' },
      { key: 'nomor', label: 'Baris nota', jenis: 'angka' },
      { key: 'nama_foto', label: 'Tertulis di nota', jenis: 'teks' },
      { key: 'qty_foto', label: 'Qty', jenis: 'teks' },
      { key: 'satuan_foto', label: 'Satuan', jenis: 'teks' },
      { key: 'harga_foto', label: 'Harga satuan', jenis: 'rupiah' },
      { key: 'total_foto', label: 'Total baris', jenis: 'rupiah' },
      { key: 'bahan', label: 'Bahan master', jenis: 'teks' },
      { key: 'harga_dasar', label: 'Harga (Rp/satuan dasar)', jenis: 'angka' },
      { key: 'satuan_dasar', label: 'Satuan dasar', jenis: 'teks' },
      { key: 'alasan', label: 'Alasan', jenis: 'teks' },
    ],
    // Nilai yang DITURUNKAN pos-fnb dari dua angka lain ditampilkan dengan tanda "(dihitung)".
    baris: urut.map((r) => ({
      bendera: r.flag === 'merah' ? 'Merah' : 'Kuning',
      nomor: r.nomor,
      nama_foto: r.namaFoto,
      qty_foto: r.diturunkan === 'qty' && r.qtyDipakai ? `${r.qtyDipakai} (dihitung)` : r.qtyFoto,
      satuan_foto: r.satuanFoto,
      harga_foto: r.diturunkan === 'harga' && r.hargaSatuanDipakai ? `${Number(r.hargaSatuanDipakai).toLocaleString('id-ID', { maximumFractionDigits: 0 })} (dihitung)` : n(r.hargaFoto ?? null),
      total_foto: r.diturunkan === 'total' && r.totalDipakai ? `${Number(r.totalDipakai).toLocaleString('id-ID', { maximumFractionDigits: 0 })} (dihitung)` : n(r.totalFoto),
      bahan: r.ingredientName,
      harga_dasar: n(r.hargaPerDasar),
      satuan_dasar: r.baseUnit,
      alasan: r.alasan.join('; '),
    })),
    totalBaris: urut.length,
    tautan: { label: 'Buka draf di layar Pembelian POS', href: tautanDrafBelanja(importId) },
  };
}

const rupiah = (s: string) => `Rp${Number(s).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;

/** Kalimat utama -- semua angka dari pos-fnb. */
export function ringkasanBelanja(p: { outletNama: string; ringkasan: RingkasanBelanjaPos; barisPerluCentang?: number }): string {
  const r = p.ringkasan;
  const n = r.kuning + r.merah;
  const bagian = [`${p.outletNama}: ${n} baris dibaca dari foto nota -- ${r.kuning} kuning, ${r.merah} merah. Tidak ada baris hijau: bacaan foto selalu diperiksa manusia.`];
  if (r.totalBeda && r.totalNota !== null) {
    bagian.push(`PERHATIAN: total di nota ${rupiah(r.totalNota)}, jumlah baris yang terbaca ${rupiah(r.jumlahTotalBaris)} -- ada baris yang terlewat atau salah baca.`);
  } else if (r.totalNota === null) {
    bagian.push(`Total nota tidak tertulis/terbaca; jumlah baris yang terbaca ${rupiah(r.jumlahTotalBaris)}.`);
  }
  if (r.barisTanpaTotal > 0) bagian.push(`${r.barisTanpaTotal} baris tanpa total terbaca.`);
  if ((p.barisPerluCentang ?? 0) > 0) {
    bagian.push(`${p.barisPerluCentang} baris belum punya pembanding harga -- harganya akan menetapkan harga rata-rata/terakhir dan wajib dicentang "harga ini benar" di POS.`);
  }
  bagian.push('Belum ada yang tercatat ke stok. Buka draf di layar Pembelian POS, periksa tiap baris, lalu konfirmasi di sana.');
  return bagian.join(' ');
}
