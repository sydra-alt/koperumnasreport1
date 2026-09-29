import type { TabelAi } from './tabel';

/**
 * Tinjauan jenis ukuran bahan (29 September 2026) -- bagian sistem laporan:
 * AI MENGUSULKAN jenis ukuran (volume / berat / hitungan) tiap bahan dari
 * nama & satuannya. Usulan disimpan pos-fnb sebagai riwayat; TIDAK ADA yang
 * terisi sampai manusia mengonfirmasi di POS (Bahan > Tinjauan jenis ukuran).
 */

export type BahanTinjauan = { id: string; name: string; baseUnit: string; purchaseUnit: string };
export type UsulanAi = { ingredientId: string; usulan: 'volume' | 'berat' | 'hitungan'; alasan: string };

export const INSTRUKSI_UKURAN = [
  'Anda mengusulkan JENIS UKURAN fisik tiap bahan restoran dari namanya.',
  'Jenis: "volume" (cairan: minyak, sirup, susu, kecap, saus cair, air), "berat" (padatan yang ditimbang: gula, tepung, daging, beras, bubuk, kopi biji), "hitungan" (dihitung per buah/kemasan: telur, cup, sedotan, roti per potong, botol minuman jadi).',
  'Nilai dari SIFAT BAHANNYA, bukan dari satuan yang tercatat (satuan tercatat bisa salah -- itu yang sedang dicek).',
  'Setiap baris: id, nama, satuan dasar, satuan beli. Kembalikan satu entri per id yang diberikan: id PERSIS sama, jenis, dan alasan singkat (maks 10 kata).',
  'Jangan menambah id yang tidak ada. Kalau ragu, pilih yang paling masuk akal dan sebut keraguannya di alasan.',
].join('\n');

export const SKEMA_UKURAN = {
  type: 'OBJECT',
  properties: {
    usulan: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          jenis: { type: 'STRING', enum: ['volume', 'berat', 'hitungan'] },
          alasan: { type: 'STRING' },
        },
        required: ['id', 'jenis', 'alasan'],
      },
    },
  },
  required: ['usulan'],
} as const;

export function daftarUntukModel(bahan: BahanTinjauan[]): string {
  return bahan.map((b) => `${b.id} | ${b.name} | dasar: ${b.baseUnit} | beli: ${b.purchaseUnit}`).join('\n');
}

/** Hanya id yang diberikan dan jenis yang sah; duplikat diambil yang pertama. */
export function parseUsulan(teks: string, bahan: BahanTinjauan[]): { usulan: UsulanAi[]; mentah: unknown[] } {
  let data: unknown;
  try {
    data = JSON.parse(teks);
  } catch {
    throw new Error('Usulan AI tidak valid (bukan JSON). Coba lagi.');
  }
  const mentah = (data as { usulan?: unknown }).usulan;
  if (!Array.isArray(mentah)) throw new Error('Usulan AI tidak valid. Coba lagi.');
  const ids = new Set(bahan.map((b) => b.id));
  const sudah = new Set<string>();
  const usulan: UsulanAi[] = [];
  for (const u of mentah) {
    if (typeof u !== 'object' || u === null) continue;
    const o = u as Record<string, unknown>;
    if (typeof o.id !== 'string' || !ids.has(o.id) || sudah.has(o.id)) continue;
    if (o.jenis !== 'volume' && o.jenis !== 'berat' && o.jenis !== 'hitungan') continue;
    sudah.add(o.id);
    usulan.push({ ingredientId: o.id, usulan: o.jenis, alasan: typeof o.alasan === 'string' ? o.alasan.slice(0, 200) : '' });
  }
  return { usulan, mentah };
}

export type UsulanTersimpan = { ingredientId: string; name: string; baseUnit: string; purchaseUnit: string; usulan: string; alasan: string };

const LABEL = { volume: 'Volume', berat: 'Berat', hitungan: 'Hitungan' } as Record<string, string>;

export function tabelUsulanUkuran(usulan: UsulanTersimpan[]): TabelAi {
  return {
    judul: 'Usulan jenis ukuran',
    kolom: [
      { key: 'bahan', label: 'Bahan', jenis: 'teks' },
      { key: 'satuan_dasar', label: 'Satuan dasar', jenis: 'teks' },
      { key: 'satuan_beli', label: 'Satuan beli', jenis: 'teks' },
      { key: 'usulan', label: 'Usulan AI', jenis: 'teks' },
      { key: 'alasan', label: 'Alasan', jenis: 'teks' },
    ],
    baris: usulan.map((u) => ({ bahan: u.name, satuan_dasar: u.baseUnit, satuan_beli: u.purchaseUnit, usulan: LABEL[u.usulan] ?? u.usulan, alasan: u.alasan })),
    totalBaris: usulan.length,
  };
}

/** Kalimat utama -- semua angka dari hitungan pos-fnb. */
export function ringkasanTinjauan(p: { jumlah: number; tidakDiusulkan: number; bentrok: number }): string {
  const bagian = [`AI mengusulkan jenis ukuran untuk ${p.jumlah} bahan.`];
  if (p.tidakDiusulkan > 0) bagian.push(`${p.tidakDiusulkan} bahan tidak mendapat usulan yang sah dan tetap "belum ditentukan".`);
  if (p.bentrok > 0) bagian.push(`${p.bentrok} usulan tidak sesuai satuan dasar yang tercatat -- periksa baik-baik.`);
  bagian.push('Belum ada yang tersimpan. Konfirmasi atau ubah tiap bahan di POS: Bahan > Tinjauan jenis ukuran.');
  return bagian.join(' ');
}
