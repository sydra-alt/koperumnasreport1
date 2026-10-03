#!/usr/bin/env -S npx tsx
// Uji impor belanja dari foto nota (3 Oktober 2026) -- model palsu, klien
// Supabase palsu, pos-fnb palsu. Tidak menyentuh jaringan atau database.
//
// Jalankan: npx tsx scripts/uji-impor-belanja.mts

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  INSTRUKSI_BELANJA,
  MAKS_BARIS_NOTA,
  parseBacaanBelanja,
  ringkasanBelanja,
  tabelHasilBelanja,
  tautanDrafBelanja,
  type BarisHasilBelanja,
} from '../lib/ai/imporBelanja';
import { tanganiImporBelanja, tanganiOutletBelanja } from '../lib/ai/tanganiImporBelanja';
import type { JawabanImporBelanjaPos } from '../lib/ai/jembatanPos';
import type { PanggilModelJson } from '../lib/ai/gemini';

const hasil: { nama: string; lolos: boolean; detail?: unknown }[] = [];
const cek = (nama: string, lolos: boolean, detail?: unknown) => hasil.push({ nama, lolos, detail });

const OUTLET = '0e6b7c1a-3f4d-4b5e-9a8b-1c2d3e4f5a6b';
const IMPORT_ID = '7d1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b';
const HARI_INI = '2026-10-03';

// --- 1. Parse bacaan AI ---
{
  const r = parseBacaanBelanja(
    JSON.stringify({
      baris: [
        { nomor: 1, nama: ' Gula pasir ', qty: 2, satuan: 'kg', total: 36000 },
        { nomor: 2, nama: 'Telur', qty: null, satuan: null, total: 55000 },
        { nomor: 3, nama: '', qty: 1, satuan: 'pcs', total: 1000 }, // dibuang
        'sampah',
        { nama: 'Susu', qty: 'dua', satuan: 'liter', total: '20.000' }, // angka bukan number -> null
      ],
      total_nota: 111000,
    }),
  );
  cek('parse: nama dirapikan, baris tanpa nama dibuang, nomor diisi kalau hilang', r.baris.map((b) => `${b.nomor}:${b.nama}`).join() === '1:Gula pasir,2:Telur,3:Susu', r.baris);
  cek('parse: qty/total bukan angka -> null (tidak ditebak)', r.baris[2]!.qty === null && r.baris[2]!.total === null, r.baris[2]);
  cek('parse: total nota dibawa apa adanya', r.totalNota === 111000);
  let pesan = '';
  try {
    parseBacaanBelanja('bukan json');
  } catch (e) {
    pesan = e instanceof Error ? e.message : '';
  }
  cek('parse: bukan JSON -> galat jelas', pesan.includes('JSON'), pesan);
  pesan = '';
  try {
    parseBacaanBelanja(JSON.stringify({ baris: Array.from({ length: MAKS_BARIS_NOTA + 1 }, (_, i) => ({ nomor: i + 1, nama: `B${i}`, qty: 1, satuan: 'pcs', total: 1 })), total_nota: null }));
  } catch (e) {
    pesan = e instanceof Error ? e.message : '';
  }
  cek(`parse: lebih dari ${MAKS_BARIS_NOTA} baris -> ditolak (tidak dipotong diam-diam)`, pesan.includes(`${MAKS_BARIS_NOTA + 1} baris`), pesan);
  cek('instruksi: total baris, bukan dihitung; total nota tertulis, bukan dijumlahkan', /Jangan menghitung qty x harga/.test(INSTRUKSI_BELANJA) && /Jangan menjumlahkan sendiri/.test(INSTRUKSI_BELANJA));
}

// --- 2. Tabel & ringkasan (angka dari pos-fnb) ---
const ROWS: BarisHasilBelanja[] = [
  { nomor: 1, namaFoto: 'Gula pasir', qtyFoto: '2', satuanFoto: 'kg', totalFoto: '36000', flag: 'kuning', alasan: ['dibaca dari foto -- periksa'], ingredientId: 'g', ingredientName: 'Gula Pasir', baseUnit: 'gram', qtyDasar: '2000.0000', hargaPerDasar: '18.00000000', pembanding: '17.50000000' },
  { nomor: 2, namaFoto: 'Telur', qtyFoto: null, satuanFoto: null, totalFoto: '55000', flag: 'merah', alasan: ['qty tidak terbaca'], ingredientId: 't', ingredientName: 'Telur', baseUnit: 'pcs', qtyDasar: null, hargaPerDasar: null, pembanding: null },
];
{
  const t = tabelHasilBelanja(ROWS, IMPORT_ID);
  cek('tabel: merah dulu, tidak pernah hijau', t.baris.map((b) => b.bendera).join() === 'Merah,Kuning', t.baris.map((b) => b.bendera));
  cek('tabel: tautan HANYA /purchases?import=<id> lewat handoff', t.tautan?.href === tautanDrafBelanja(IMPORT_ID) && decodeURIComponent(t.tautan.href).endsWith(`/purchases?import=${IMPORT_ID}`), t.tautan);
  const beda = ringkasanBelanja({ outletNama: 'Indokopi Jatinegara', ringkasan: { kuning: 1, merah: 1, jumlahTotalBaris: '91000', totalNota: '111000', totalBeda: true, barisTanpaTotal: 0 } });
  cek('ringkasan: total nota beda -> peringatan dengan KEDUA angka', beda.includes('total di nota Rp111.000, jumlah baris yang terbaca Rp91.000'), beda);
  cek('ringkasan: "tidak ada baris hijau" + belum tercatat ke stok', beda.includes('Tidak ada baris hijau') && beda.includes('Belum ada yang tercatat ke stok'), beda);
  const sama = ringkasanBelanja({ outletNama: 'X', ringkasan: { kuning: 2, merah: 0, jumlahTotalBaris: '91000', totalNota: '91000', totalBeda: false, barisTanpaTotal: 0 } });
  cek('ringkasan: total cocok -> tanpa peringatan', !sama.includes('PERHATIAN'), sama);
  const tanpa = ringkasanBelanja({ outletNama: 'X', ringkasan: { kuning: 2, merah: 0, jumlahTotalBaris: '91000', totalNota: null, totalBeda: false, barisTanpaTotal: 1 } });
  cek('ringkasan: tanpa total nota & baris tanpa total disebut', tanpa.includes('Total nota tidak tertulis') && tanpa.includes('1 baris tanpa total'), tanpa);
}

// --- 2b. Harga satuan, nilai turunan, centang harga (3 Oktober 2026) ---
{
  const r = parseBacaanBelanja(
    JSON.stringify({
      baris: [
        { nomor: 1, nama: 'Gula', qty: 2, satuan: 'kg', total: null, harga: 18000 },
        { nomor: 2, nama: 'Telur', qty: 10, satuan: 'butir', total: 25000, harga: 'mahal' },
      ],
      total_nota: null,
    }),
  );
  cek('parse: harga satuan angka dibawa, bukan angka -> null', r.baris[0]!.harga === 18000 && r.baris[1]!.harga === null, r.baris);
  cek('instruksi: harga satuan TERTULIS, jangan membagi total dengan qty', /harga SATUAN yang TERTULIS/.test(INSTRUKSI_BELANJA) && /jangan membagi total dengan qty/.test(INSTRUKSI_BELANJA));
  const t = tabelHasilBelanja(
    [
      { ...ROWS[0]!, hargaFoto: '18000', totalFoto: null, diturunkan: 'total', totalDipakai: '36000', hargaSatuanDipakai: '18000', qtyDipakai: '2' },
      { ...ROWS[1]!, hargaFoto: null, diturunkan: null },
    ],
    IMPORT_ID,
  );
  const gula = t.baris.find((b) => b.nomor === 1)!;
  cek('tabel: kolom harga satuan + nilai turunan bertanda "(dihitung)"', t.kolom.some((k) => k.key === 'harga_foto') && gula.total_foto === '36.000 (dihitung)' && gula.harga_foto === 18000, gula);
  const rk = ringkasanBelanja({ outletNama: 'X', ringkasan: { kuning: 2, merah: 0, jumlahTotalBaris: '91000', totalNota: null, totalBeda: false, barisTanpaTotal: 0 }, barisPerluCentang: 1 });
  cek('ringkasan: baris tanpa pembanding wajib "harga ini benar"', rk.includes('1 baris belum punya pembanding harga') && rk.includes('harga ini benar'), rk);
}

// --- 3. Handler: gerbang, isian, urutan, log ---
type Catatan = { tabel: string; baris: Record<string, unknown> }[];
function supabasePalsu(opsi: { status?: Record<string, unknown>; tolakPesan?: string } = {}) {
  const tercatat: Catatan = [];
  let n = 0;
  const status = { aktif: true, boleh: true, batas: 20, terpakai: 3, ...opsi.status };
  const klien = {
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'ceo@koperumnas.com' } } }) },
    rpc: (nama: string) => {
      const data = nama === 'ai_status' ? status : nama === 'akses_pos_saya' ? { boleh: true, peran_pos: 'manager' } : null;
      return Object.assign(Promise.resolve({ data, error: null }), { single: async () => ({ data, error: null }) });
    },
    from: (tabel: string) => ({
      insert: (baris: Record<string, unknown>) => {
        if (tabel === 'ai_pesan' && opsi.tolakPesan && baris.peran === 'user') {
          const h = { data: null, error: { message: opsi.tolakPesan } };
          return Object.assign(Promise.resolve({ error: h.error }), { select: () => ({ single: async () => h }) });
        }
        tercatat.push({ tabel, baris });
        const h = { data: { id: `${tabel}-${++n}`, ...baris, created_at: '2026-10-03T10:00:00Z' }, error: null };
        return Object.assign(Promise.resolve({ error: null }), { select: () => ({ single: async () => h }) });
      },
    }),
  };
  return { klien: klien as unknown as SupabaseClient, tercatat };
}

const OK_POS = (): JawabanImporBelanjaPos => ({
  akses: 'ok',
  status: 'ok',
  importId: IMPORT_ID,
  outletName: 'Indokopi Jatinegara',
  ringkasan: { kuning: 1, merah: 1, jumlahTotalBaris: '91000', totalNota: '91000', totalBeda: false, barisTanpaTotal: 0 },
  rows: ROWS,
});
const FOTO = { nama: 'nota.jpg', jenis: 'image/jpeg', data: new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]).buffer };

async function jalankan(
  ubah: Partial<Parameters<typeof tanganiImporBelanja>[0]> = {},
  pos: (b: Record<string, unknown>) => JawabanImporBelanjaPos = OK_POS,
  sb = supabasePalsu(),
) {
  const panggilan: Record<string, unknown>[] = [];
  const permintaanModel: Parameters<PanggilModelJson>[0][] = [];
  const r = await tanganiImporBelanja({
    supabase: sb.klien,
    terkonfigurasi: true,
    outletId: OUTLET,
    pembelanja: 'Mba Rika',
    tanggalBelanja: '2026-10-02',
    foto: FOTO,
    buatModelJson: () => async (p) => {
      permintaanModel.push(p);
      return JSON.stringify({ baris: [{ nomor: 1, nama: 'Gula pasir', qty: 2, satuan: 'kg', total: 36000 }, { nomor: 2, nama: 'Telur', qty: null, satuan: null, total: 55000 }], total_nota: 91000 });
    },
    namaModel: 'gemini-uji',
    panggilPos: async (_u, body) => {
      panggilan.push(body);
      return pos(body);
    },
    hariIni: HARI_INI,
    ...ubah,
  });
  return { r, sb, panggilan, permintaanModel };
}

{
  const { r, sb, panggilan, permintaanModel } = await jalankan();
  cek('sukses: percakapan -> pesan user -> log alat -> pesan model', sb.tercatat.map((t) => t.tabel).join() === 'ai_percakapan,ai_pesan,ai_panggilan_alat,ai_pesan', sb.tercatat.map((t) => t.tabel));
  cek('model menerima FOTO (inlineData) + skema, dipanggil sekali', permintaanModel.length === 1 && permintaanModel[0]!.gambar?.mimeType === 'image/jpeg' && Boolean(permintaanModel[0]!.gambar?.base64));
  const kirim = panggilan[0]!;
  cek(
    'ke pos-fnb: outlet, tanggal belanja, pembelanja, foto base64, bacaan mentah, baris, total nota',
    kirim.action === 'create' && kirim.outletId === OUTLET && kirim.shoppingDate === '2026-10-02' && kirim.shopper === 'Mba Rika' &&
      typeof kirim.photoBase64 === 'string' && kirim.photoMime === 'image/jpeg' && (kirim.rows as unknown[]).length === 2 && kirim.grandTotal === 91000 && kirim.aiModel === 'gemini-uji',
    Object.keys(kirim),
  );
  const log = sb.tercatat.find((t) => t.tabel === 'ai_panggilan_alat')!.baris;
  cek('log alat: impor_belanja, sumber pos, ok', log.alat === 'impor_belanja' && log.sumber === 'pos' && log.status === 'ok' && log.jumlah_baris === 2, log);
  const model = sb.tercatat.filter((t) => t.tabel === 'ai_pesan')[1]!.baris;
  cek('pesan model: balasan_untuk pesan user + tabel dengan tautan draf', r.status === 200 && model.balasan_untuk === 'ai_pesan-2' && (model.tabel as { tautan?: { href: string } }[])[0]?.tautan?.href === tautanDrafBelanja(IMPORT_ID), model);
}
{
  const { r, panggilan } = await jalankan({ tanggalBelanja: '' });
  cek('tanggal kosong -> hari ini', r.status === 200 && panggilan[0]!.shoppingDate === HARI_INI, panggilan[0]?.shoppingDate);
}
{
  const { r, sb, permintaanModel } = await jalankan({ tanggalBelanja: '2026-10-04' });
  cek('tanggal di masa depan -> 400 sebelum apa pun disimpan / AI dipanggil', r.status === 400 && sb.tercatat.length === 0 && permintaanModel.length === 0, r);
}
{
  const { r, sb } = await jalankan({ tanggalBelanja: '2026-13-40' });
  cek('tanggal tidak valid -> 400', r.status === 400 && sb.tercatat.length === 0, r);
}
{
  const { r, sb } = await jalankan({ foto: { ...FOTO, jenis: 'application/pdf' } });
  cek('bukan jpg/png/webp -> 400, tidak ada percakapan', r.status === 400 && sb.tercatat.length === 0, r);
}
{
  const { r, sb } = await jalankan({ foto: { ...FOTO, data: new ArrayBuffer(4_000_001) } });
  cek('foto terlalu besar -> 400, tidak ada percakapan', r.status === 400 && sb.tercatat.length === 0, r);
}
{
  const { r, sb } = await jalankan({ outletId: 'bukan-uuid' });
  cek('outlet bukan UUID -> 400', r.status === 400 && sb.tercatat.length === 0, r);
}
{
  const { r, panggilan, permintaanModel } = await jalankan({}, OK_POS, supabasePalsu({ status: { boleh: false } }));
  cek('tanpa punya_akses_ai -> 403, model & pos TIDAK dipanggil', r.status === 403 && panggilan.length === 0 && permintaanModel.length === 0, r);
}
{
  const { r, permintaanModel } = await jalankan({}, OK_POS, supabasePalsu({ status: { terpakai: 20 } }));
  cek('jatah habis -> 429 sebelum AI', r.status === 429 && permintaanModel.length === 0, r);
}
{
  const { r, permintaanModel } = await jalankan({}, OK_POS, supabasePalsu({ tolakPesan: 'BATAS_PESAN_AI:20' }));
  cek('trigger jatah menolak pesan user -> 429, AI tidak dipanggil', r.status === 429 && permintaanModel.length === 0, r);
}
{
  const { r, sb } = await jalankan({}, () => ({ akses: 'ok', status: 'forbidden' }));
  const log = sb.tercatat.find((t) => t.tabel === 'ai_panggilan_alat')?.baris;
  cek('peran POS tanpa stock.purchase -> 403, tetap tercatat (ditolak), tanpa pesan model', r.status === 403 && log?.status === 'ditolak' && !sb.tercatat.some((t) => t.baris.peran === 'model'), r);
}
{
  const { r } = await jalankan({}, () => ({ akses: 'ok', status: 'outlet_not_allowed' }));
  cek('outlet di luar cakupan -> 403', r.status === 403 && String(r.body.error).includes('tidak termasuk'), r);
}
{
  const { r } = await jalankan({}, () => ({ akses: 'tanpa_akses_pos' }));
  cek('tanpa akses POS -> 403 "tidak punya akses data POS"', r.status === 403 && String(r.body.error).includes('akses data POS'), r);
}
{
  const sb = supabasePalsu();
  const r = await tanganiOutletBelanja({ supabase: sb.klien, terkonfigurasi: true, panggilPos: async (_u, b) => (b.action === 'outlets' ? { akses: 'ok', status: 'ok', outlets: [{ id: OUTLET, name: 'Indokopi Jatinegara' }] } : { akses: 'galat' }) });
  cek('GET outlet: daftar dari pos-fnb, action "outlets"', r.status === 200 && (r.body.outlets as unknown[]).length === 1, r);
}

let gagal = 0;
for (const h of hasil) {
  console.log(`${h.lolos ? 'LOLOS' : 'GAGAL'}  ${h.nama}`);
  if (!h.lolos) {
    gagal++;
    console.log('       ', JSON.stringify(h.detail));
  }
}
console.log(`${hasil.length - gagal}/${hasil.length} lolos.`);
if (gagal > 0) process.exit(1);
