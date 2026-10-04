#!/usr/bin/env -S npx tsx
// Uji impor resep Excel di asisten AI (29 September 2026) -- file Excel
// sungguhan (exceljs), model palsu, klien Supabase palsu, pos-fnb palsu.
// Tidak menyentuh jaringan atau database.
//
// Jalankan: npx tsx scripts/uji-impor-resep.mts

import ExcelJS from 'exceljs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bacaGrid } from '../lib/ai/imporOpname';
import {
  parseBacaanResep,
  ringkasanImporResep,
  tabelHasilImporResep,
  tautanDrafResep,
  verifikasiBacaanResep,
  type ProdukResepHasil,
} from '../lib/ai/imporResep';
import { tanganiImporResep } from '../lib/ai/tanganiImporResep';
import type { JawabanImporResepPos } from '../lib/ai/jembatanPos';

const hasil: { nama: string; lolos: boolean; detail?: unknown }[] = [];
const cek = (nama: string, lolos: boolean, detail?: unknown) => hasil.push({ nama, lolos, detail });

async function buatXlsx(isi: (ws: ExcelJS.Worksheet) => void): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  isi(wb.addWorksheet('Resep'));
  const buf = await wb.xlsx.writeBuffer();
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf as unknown as ArrayBufferLike).slice().buffer;
}

// Tata letak berkelompok: nama produk di baris judul, bahan di bawahnya.
const contoh = await buatXlsx((ws) => {
  ws.addRow(['Resep Indokopi']); // 1
  ws.addRow(['Bahan', 'Qty', 'Satuan']); // 2
  ws.addRow(['Es Kopi Susu Aren']); // 3
  ws.addRow(['Espresso', 18, 'gram']); // 4
  ws.addRow(['Susu UHT', 0.15, 'liter']); // 5
  ws.addRow(['Gula Aren', 20, 'ml']); // 6
  ws.addRow(['Americano']); // 7
  ws.addRow(['Espresso', 18, 'gram']); // 8
});

// --- 1. Parse & verifikasi ---
{
  const grid = await bacaGrid(contoh);
  const bacaan = parseBacaanResep(
    JSON.stringify({
      baris: [
        { lembar: 1, baris: 4, produk: 'Es Kopi Susu Aren', bahan: 'Espresso', qty: 18, satuan: 'gram' },
        { lembar: 1, baris: 5, produk: 'Es Kopi Susu Aren', bahan: 'Susu UHT', qty: 0.15, satuan: 'liter' },
        { lembar: 1, baris: 8, produk: 'Americano', bahan: 'Espresso', qty: 18, satuan: 'gram' },
        { lembar: 1, baris: 4, produk: 'Kopi Karangan', bahan: 'Espresso', qty: 18, satuan: 'gram' }, // produk karangan
        { lembar: 1, baris: 4, produk: 'Es Kopi Susu Aren', bahan: 'Espresso', qty: 180, satuan: 'gram' }, // angka karangan
        { lembar: 1, baris: 4, produk: 'Americano', bahan: 'Espresso', qty: 18, satuan: 'gram' }, // produk dari BAWAH baris -> tidak sah
        { lembar: 1, baris: 4, produk: '', bahan: 'Espresso', qty: 18, satuan: null }, // dibuang
        'sampah',
      ],
    }),
    grid,
  );
  cek('parseBacaanResep: entri tidak valid dibuang', bacaan.length === 6 && bacaan[0]!.lembar === 'Resep', bacaan.length);
  const v = verifikasiBacaanResep(bacaan, grid).map((x) => x.terverifikasi);
  cek(
    'verifikasi: produk dari baris itu atau judul DI ATASNYA; bahan/qty/satuan dari baris itu; karangan -> false',
    JSON.stringify(v) === JSON.stringify([true, true, true, false, false, false]),
    v,
  );
}

// --- 1b. Template resep per produk pos-fnb (7 Oktober 2026): lembar "Daftar"
// tersembunyi tidak dibaca & tidak ikut batas 600 baris; baris bahan tanpa nama
// produk terverifikasi ke produk di atasnya.
{
  const wb = new ExcelJS.Workbook();
  const daftar = wb.addWorksheet('Daftar', { state: 'hidden' });
  for (let i = 0; i < 700; i++) daftar.addRow([`Bahan ${i}`]);
  const ws = wb.addWorksheet('IKJT Indokopi Jatinegara');
  ws.addRow(['Produk', 'Bahan', 'Takaran per porsi', 'Satuan']); // 1
  ws.addRow(['Mie Bestie', 'Mie telur', 1, 'pcs']); // 2
  ws.addRow([null, 'Kerupuk bawang', 15, 'gram']); // 3
  ws.addRow(['Es Leci Tea']); // 4 -- belum diisi
  const buf = await wb.xlsx.writeBuffer();
  const grid = await bacaGrid(new Uint8Array(buf as unknown as ArrayBufferLike).slice().buffer);
  cek('template: lembar tersembunyi dilewati (700 baris tidak memicu batas 600)', grid.length === 1 && grid[0]!.nama === 'IKJT Indokopi Jatinegara', grid.map((g) => g.nama));
  const v = verifikasiBacaanResep(
    parseBacaanResep(
      JSON.stringify({
        baris: [
          { lembar: 1, baris: 2, produk: 'Mie Bestie', bahan: 'Mie telur', qty: 1, satuan: 'pcs' },
          { lembar: 1, baris: 3, produk: 'Mie Bestie', bahan: 'Kerupuk bawang', qty: 15, satuan: 'gram' },
        ],
      }),
      grid,
    ),
    grid,
  );
  cek('template: baris bahan di bawah nama produk terverifikasi, nama lembar ber-kode ikut', v.every((b) => b.terverifikasi && b.lembar === 'IKJT Indokopi Jatinegara'), v);
}

// --- 2. Tabel & ringkasan ---
const IMPORT_ID = '0e6b7c1a-3f4d-4b5e-9a8b-1c2d3e4f5a6b';
const PRODUK: ProdukResepHasil[] = [
  {
    produkFile: 'Es Kopi Susu Aren',
    productId: 'p1',
    productName: 'Es Kopi Susu Aren',
    flag: 'hijau',
    alasan: [],
    sudahAdaResep: true,
    baris: [
      { lembar: 'Resep', baris: 4, bahanFile: 'Espresso', qtyFile: '18', satuanFile: 'gram', flag: 'hijau', alasan: [], ingredientName: 'Espresso', baseUnit: 'gram', qtyUsulan: '18.0000' },
      { lembar: 'Resep', baris: 5, bahanFile: 'Susu UHT', qtyFile: '0.15', satuanFile: 'liter', flag: 'kuning', alasan: ['dikonversi liter -> ml (x1000)'], ingredientName: 'Susu UHT', baseUnit: 'ml', qtyUsulan: '150.0000' },
      { lembar: 'Resep', baris: 6, bahanFile: 'Gula Aren', qtyFile: '20', satuanFile: 'ml', flag: 'merah', alasan: ['satuan "ml" tidak cocok dengan satuan dasar gram'], ingredientName: 'Gula Aren', baseUnit: 'gram', qtyUsulan: null },
    ],
  },
];
{
  const t = tabelHasilImporResep(PRODUK, IMPORT_ID);
  cek('tabel: merah dulu, lalu kuning, lalu hijau', t.baris.map((b) => b.bendera).join() === 'Merah,Kuning,Hijau', t.baris.map((b) => b.bendera));
  cek('tabel: produk yang sudah punya resep ditandai perlu konfirmasi timpa', t.baris.every((b) => b.resep_ada === 'Ya (perlu konfirmasi timpa)'), t.baris[0]);
  cek(
    'tabel: tautan ke draf lewat handoff (next = /recipes?import=<id>)',
    t.tautan?.href === tautanDrafResep(IMPORT_ID) && decodeURIComponent(t.tautan.href).endsWith(`/recipes?import=${IMPORT_ID}`),
    t.tautan,
  );
  const r = ringkasanImporResep({
    fileNama: 'resep.xlsx',
    ringkasan: { produk: 2, produkTidakDikenali: 1, produkSudahAdaResep: 1, baris: { hijau: 1, kuning: 1, merah: 1 } },
  });
  cek(
    'ringkasan: angka dari pos-fnb + tidak dikenali + tidak ditimpa tanpa konfirmasi + belum tersimpan',
    r.startsWith('2 produk, 3 baris bahan dibaca dari resep.xlsx -- 1 hijau, 1 kuning, 1 merah.') &&
      r.includes('1 produk tidak dikenali') &&
      r.includes('TIDAK ditimpa tanpa konfirmasi per produk') &&
      r.includes('Belum ada yang tersimpan'),
    r,
  );
}

// --- 3. Handler ---
function supabasePalsu(opsi: { status?: Record<string, unknown> } = {}) {
  const tercatat: { tabel: string; baris: Record<string, unknown> }[] = [];
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
        tercatat.push({ tabel, baris });
        const h = { data: { id: `${tabel}-${++n}`, ...baris, created_at: '2026-09-29T10:00:00Z' }, error: null };
        return Object.assign(Promise.resolve({ error: null }), { select: () => ({ single: async () => h }) });
      },
    }),
  };
  return { klien: klien as unknown as SupabaseClient, tercatat };
}
function posPalsu(jawaban: JawabanImporResepPos) {
  const panggilan: Record<string, unknown>[] = [];
  return {
    panggilan,
    panggil: async (_u: unknown, body: Record<string, unknown>) => {
      panggilan.push(body);
      return jawaban;
    },
  };
}
const BACAAN_OK = JSON.stringify({
  baris: [
    { lembar: 1, baris: 4, produk: 'Es Kopi Susu Aren', bahan: 'Espresso', qty: 18, satuan: 'gram' },
    { lembar: 1, baris: 5, produk: 'Es Kopi Susu Aren', bahan: 'Susu UHT', qty: 0.15, satuan: 'liter' },
  ],
});
const POS_OK: JawabanImporResepPos = {
  akses: 'ok',
  status: 'ok',
  importId: IMPORT_ID,
  ringkasan: { produk: 1, produkTidakDikenali: 0, produkSudahAdaResep: 1, baris: { hijau: 1, kuning: 1, merah: 1 } },
  produk: PRODUK,
};
async function jalankan(o: { sb?: ReturnType<typeof supabasePalsu>; pos?: ReturnType<typeof posPalsu>; file?: { nama: string; data: ArrayBuffer } | null }) {
  const sb = o.sb ?? supabasePalsu();
  const pos = o.pos ?? posPalsu(POS_OK);
  let modelDipanggil = 0;
  const r = await tanganiImporResep({
    supabase: sb.klien,
    terkonfigurasi: true,
    file: o.file === undefined ? { nama: 'resep.xlsx', data: contoh } : o.file,
    buatModelJson: () => async () => {
      modelDipanggil++;
      return BACAAN_OK;
    },
    namaModel: 'gemini-uji',
    panggilPos: pos.panggil,
  });
  return { r, sb, pos, modelDipanggil };
}
{
  const { r, sb, pos } = await jalankan({});
  cek('sukses: percakapan -> pesan user -> log alat -> pesan model', sb.tercatat.map((t) => t.tabel).join() === 'ai_percakapan,ai_pesan,ai_panggilan_alat,ai_pesan', sb.tercatat.map((t) => t.tabel));
  const log = sb.tercatat[2]!.baris;
  cek('log alat: impor_resep, sumber pos, status ok', log.alat === 'impor_resep' && log.sumber === 'pos' && log.status === 'ok', log);
  const kirim = pos.panggilan[0]!;
  cek('ke pos-fnb: create, tanpa outlet, baris terverifikasi', kirim.action === 'create' && !('outletId' in kirim) && (kirim.rows as unknown[]).length === 2, kirim.action);
  const model = sb.tercatat[3]!.baris;
  cek('pesan model: ringkasan + tabel dengan tautan /recipes?import', r.status === 200 && String(model.isi).includes('TIDAK ditimpa') && (model.tabel as { tautan?: { href: string } }[])[0]?.tautan?.href === tautanDrafResep(IMPORT_ID), model.isi);
}
{
  const sb = supabasePalsu({ status: { boleh: false } });
  const { r, modelDipanggil, pos } = await jalankan({ sb });
  cek('tanpa punya_akses_ai -> 403, model & pos tidak dipanggil', r.status === 403 && modelDipanggil === 0 && pos.panggilan.length === 0 && sb.tercatat.length === 0, r);
}
{
  const { r, sb } = await jalankan({ pos: posPalsu({ akses: 'ok', status: 'forbidden' }) });
  cek('peran POS tanpa izin resep -> 403 + log ditolak, tanpa pesan model', r.status === 403 && sb.tercatat.some((t) => t.tabel === 'ai_panggilan_alat' && t.baris.status === 'ditolak') && !sb.tercatat.some((t) => t.baris.peran === 'model'), r);
}
{
  const { r } = await jalankan({ file: { nama: 'resep.csv', data: contoh } });
  cek('bukan .xlsx -> 400', r.status === 400, r);
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
