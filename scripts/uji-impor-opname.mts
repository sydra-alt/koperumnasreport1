#!/usr/bin/env -S npx tsx
// Uji impor opname Excel di asisten AI (29 September 2026, fase 2) -- file
// Excel sungguhan (exceljs), model palsu, klien Supabase palsu, pos-fnb
// palsu. Tidak menyentuh jaringan atau database.
//
// Jalankan: npx tsx scripts/uji-impor-opname.mts

import ExcelJS from 'exceljs';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  bacaGrid,
  GalatFileImpor,
  gridUntukModel,
  MAKS_BARIS_FILE,
  parseBacaan,
  ringkasanImpor,
  tabelHasilImpor,
  tautanDrafOpname,
  verifikasiBacaan,
  type BarisHasilImpor,
} from '../lib/ai/imporOpname';
import { tanganiImporOpname, tanganiOutletImpor } from '../lib/ai/tanganiImporOpname';
import type { JawabanImporPos } from '../lib/ai/jembatanPos';

const hasil: { nama: string; lolos: boolean; detail?: unknown }[] = [];
const cek = (nama: string, lolos: boolean, detail?: unknown) => hasil.push({ nama, lolos, detail });

async function buatXlsx(isi: (ws: ExcelJS.Worksheet) => void, lembar = 'Opname'): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  isi(wb.addWorksheet(lembar));
  const buf = await wb.xlsx.writeBuffer();
  return buf instanceof ArrayBuffer ? buf : new Uint8Array(buf as unknown as ArrayBufferLike).slice().buffer;
}

const contoh = await buatXlsx((ws) => {
  ws.addRow(['Stok Opname Jatinegara']);
  ws.addRow([]);
  ws.addRow(['Nama Bahan', 'Qty (gram)', 'Satuan']);
  ws.addRow(['Gula Aren', 450, 'gram']);
  ws.addRow([{ richText: [{ text: 'Telur ' }, { text: '/ pcs' }] }, { formula: '10*3', result: 30 }, 'pcs']);
  ws.addRow(['Susu UHT', 2, 'liter']);
  ws.addRow(['TOTAL', 482]);
});

// --- 1. Baca grid ---
{
  const grid = await bacaGrid(contoh);
  const b = grid[0]!.baris;
  cek('bacaGrid: baris kosong dilewati, nomor baris file dipertahankan', b.map((r) => r.nomor).join() === '1,3,4,5,6,7', b.map((r) => r.nomor));
  cek('bacaGrid: richText digabung, rumus -> hasilnya', JSON.stringify(b[3]!.sel) === JSON.stringify(['Telur / pcs', 30, 'pcs']), b[3]!.sel);
  const teks = gridUntukModel(grid);
  cek('gridUntukModel: nomor lembar + nomor baris + sel', teks.includes('### Lembar 1: Opname') && teks.includes('4 | Gula Aren | 450 | gram'), teks);

  let pesan = '';
  try {
    await bacaGrid(new TextEncoder().encode('bukan,excel\n1,2').buffer as ArrayBuffer);
  } catch (e) {
    pesan = e instanceof GalatFileImpor ? e.message : 'bukan GalatFileImpor';
  }
  cek('bukan .xlsx -> ditolak dengan pesan jelas', pesan.includes('.xlsx'), pesan);

  const besar = await buatXlsx((ws) => {
    for (let i = 0; i < MAKS_BARIS_FILE + 1; i++) ws.addRow([`Bahan ${i}`, i]);
  });
  pesan = '';
  try {
    await bacaGrid(besar);
  } catch (e) {
    pesan = e instanceof GalatFileImpor ? e.message : '';
  }
  cek(`lebih dari ${MAKS_BARIS_FILE} baris -> DITOLAK (tidak dipotong diam-diam)`, pesan.includes(`${MAKS_BARIS_FILE + 1} baris`), pesan);
}

// --- 2. Parse & verifikasi bacaan AI ---
{
  const grid = await bacaGrid(contoh);
  const bacaan = parseBacaan(
    JSON.stringify({
      baris: [
        { lembar: 1, baris: 4, nama: 'Gula Aren', qty: 450, satuan: 'gram' },
        { lembar: 1, baris: 5, nama: 'Telur / pcs', qty: 30, satuan: 'pcs' },
        { lembar: 1, baris: 6, nama: 'susu  uht', qty: 2, satuan: 'liter' },
        { lembar: 1, baris: 4, nama: 'Gula Pasir', qty: 450, satuan: 'gram' }, // nama karangan
        { lembar: 1, baris: 4, nama: 'Gula Aren', qty: 4500, satuan: 'gram' }, // angka karangan
        { lembar: 1, baris: 4, nama: 'Gula Aren', qty: 450, satuan: 'kg' }, // satuan karangan
        { lembar: 1, baris: 99, nama: 'Gula Aren', qty: 450, satuan: 'gram' }, // baris tidak ada
        { lembar: 1, baris: 4, nama: '', qty: 1, satuan: null }, // dibuang
        'sampah',
      ],
    }),
    grid,
  );
  cek('parseBacaan: nomor lembar -> nama lembar, entri tidak valid dibuang', bacaan.length === 7 && bacaan[0]!.lembar === 'Opname', bacaan);
  const v = verifikasiBacaan(bacaan, grid).map((x) => x.terverifikasi);
  cek(
    'verifikasi: nama/qty/satuan harus ada di baris itu (satuan boleh dari judul kolom); karangan -> false',
    JSON.stringify(v) === JSON.stringify([true, true, true, false, false, false, false]),
    v,
  );
  let pesan = '';
  try {
    parseBacaan('bukan json', grid);
  } catch (e) {
    pesan = e instanceof GalatFileImpor ? e.message : '';
  }
  cek('parseBacaan: bukan JSON -> galat jelas', pesan.includes('JSON'), pesan);
}

// --- 3. Tabel & ringkasan ---
const ROWS: BarisHasilImpor[] = [
  { lembar: 'Opname', baris: 4, namaFile: 'Gula Aren', qtyFile: '450', satuanFile: 'gram', flag: 'hijau', alasan: [], ingredientId: 'g', ingredientName: 'Gula Aren', baseUnit: 'gram', qtyUsulan: '450.0000', stokBerjalan: '500', kandidat: [] },
  { lembar: 'Opname', baris: 6, namaFile: 'Susu UHT', qtyFile: '2', satuanFile: 'liter', flag: 'kuning', alasan: ['dikonversi liter -> ml (x1000)'], ingredientId: 's', ingredientName: 'Susu UHT', baseUnit: 'ml', qtyUsulan: '2000.0000', stokBerjalan: null, kandidat: [] },
  { lembar: 'Opname', baris: 7, namaFile: 'Minyak', qtyFile: '5', satuanFile: 'liter', flag: 'merah', alasan: ['tidak ada di master bahan'], ingredientId: null, ingredientName: null, baseUnit: null, qtyUsulan: null, stokBerjalan: null, kandidat: [] },
];
const IMPORT_ID = '0e6b7c1a-3f4d-4b5e-9a8b-1c2d3e4f5a6b';
{
  const t = tabelHasilImpor(ROWS, IMPORT_ID);
  cek('tabel: merah dulu, lalu kuning, lalu hijau', t.baris.map((b) => b.bendera).join() === 'Merah,Kuning,Hijau', t.baris.map((b) => b.bendera));
  cek(
    'tabel: tautan ke draf lewat handoff (next = /stock-opnames?import=<id>)',
    t.tautan?.href === tautanDrafOpname(IMPORT_ID) && decodeURIComponent(t.tautan.href).endsWith(`/stock-opnames?import=${IMPORT_ID}`),
    t.tautan,
  );
  const r = ringkasanImpor({ outletNama: 'Indokopi Jatinegara', fileNama: 'opname.xlsx', counts: { hijau: 1, kuning: 1, merah: 1 } });
  cek('ringkasan: hitungan + "belum ada yang tercatat ke stok"', r.startsWith('Indokopi Jatinegara: 3 baris dibaca dari opname.xlsx -- 1 hijau, 1 kuning, 1 merah.') && r.includes('Belum ada yang tercatat ke stok'), r);
}

// --- 4. Handler: gerbang, jatah, urutan, log ---
type Catatan = { tabel: string; baris: Record<string, unknown> }[];
function supabasePalsu(opsi: { status?: Record<string, unknown>; tolakPesanUser?: string } = {}) {
  const tercatat: Catatan = [];
  let n = 0;
  const status = { aktif: true, boleh: true, batas: 20, terpakai: 3, ...opsi.status };
  const klien = {
    auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'ceo@koperumnas.com' } } }) },
    rpc: (nama: string) => {
      const data = nama === 'ai_status' ? status : nama === 'akses_pos_saya' ? { boleh: true, peran_pos: 'manager' } : null;
      const p = Promise.resolve({ data, error: null });
      return Object.assign(p, { single: async () => ({ data, error: null }) });
    },
    from: (tabel: string) => ({
      insert: (baris: Record<string, unknown>) => {
        const tolak = tabel === 'ai_pesan' && baris.peran === 'user' && opsi.tolakPesanUser;
        if (!tolak) tercatat.push({ tabel, baris });
        const hasilInsert = tolak
          ? { data: null, error: { message: opsi.tolakPesanUser } }
          : { data: { id: `${tabel}-${++n}`, ...baris, created_at: '2026-09-29T10:00:00Z' }, error: null };
        const p = Promise.resolve({ error: hasilInsert.error });
        return Object.assign(p, { select: () => ({ single: async () => hasilInsert }) });
      },
    }),
  };
  return { klien: klien as unknown as SupabaseClient, tercatat };
}

function posPalsu(jawaban: JawabanImporPos) {
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
    { lembar: 1, baris: 4, nama: 'Gula Aren', qty: 450, satuan: 'gram' },
    { lembar: 1, baris: 5, nama: 'Telur / pcs', qty: 30, satuan: 'pcs' },
    { lembar: 1, baris: 4, nama: 'Gula Karangan', qty: 1, satuan: null },
  ],
});
const OUTLET = '4150168b-0000-4000-8000-000000000001';
const POS_OK: JawabanImporPos = { akses: 'ok', status: 'ok', importId: IMPORT_ID, outletName: 'Indokopi Jatinegara', counts: { hijau: 1, kuning: 1, merah: 1 }, rows: ROWS };

async function jalankan(o: {
  sb?: ReturnType<typeof supabasePalsu>;
  pos?: ReturnType<typeof posPalsu>;
  model?: () => Promise<string>;
  file?: { nama: string; data: ArrayBuffer } | null;
  outletId?: unknown;
}) {
  const sb = o.sb ?? supabasePalsu();
  const pos = o.pos ?? posPalsu(POS_OK);
  let modelDipanggil = 0;
  const r = await tanganiImporOpname({
    supabase: sb.klien,
    terkonfigurasi: true,
    outletId: o.outletId ?? OUTLET,
    file: o.file === undefined ? { nama: 'opname-jatinegara.xlsx', data: contoh } : o.file,
    buatModelJson: () => async () => {
      modelDipanggil++;
      return o.model ? o.model() : BACAAN_OK;
    },
    namaModel: 'gemini-uji',
    panggilPos: pos.panggil,
  });
  return { r, sb, pos, modelDipanggil };
}

{
  const { r, sb, pos, modelDipanggil } = await jalankan({});
  const tabelTercatat = sb.tercatat.map((t) => t.tabel);
  cek('sukses: percakapan -> pesan user -> log alat -> pesan model (urutan)', tabelTercatat.join() === 'ai_percakapan,ai_pesan,ai_panggilan_alat,ai_pesan', tabelTercatat);
  const model = sb.tercatat[3]!.baris;
  cek('sukses: pesan model menautkan balasan_untuk (jatah dihitung hanya kalau terjawab)', model.balasan_untuk === 'ai_pesan-2', model);
  const tabel = (model.tabel as { tautan?: { href: string } }[])[0];
  cek('sukses: tabel hasil + tautan buka draf', r.status === 200 && tabel?.tautan?.href === tautanDrafOpname(IMPORT_ID), tabel?.tautan);
  const log = sb.tercatat[2]!.baris;
  cek('log alat: impor_opname, sumber pos, status ok, jumlah baris dibaca', log.alat === 'impor_opname' && log.sumber === 'pos' && log.status === 'ok' && log.jumlah_baris === 3, log);
  const kirim = pos.panggilan[0]!;
  const rows = kirim.rows as { nama: string; terverifikasi: boolean }[];
  cek(
    'ke pos-fnb: bacaan mentah + baris terverifikasi (karangan = false) + file base64 + nama model',
    kirim.action === 'create' &&
      (kirim.rawRead as unknown[]).length === 3 &&
      JSON.stringify(rows.map((x) => x.terverifikasi)) === '[true,true,false]' &&
      typeof kirim.fileBase64 === 'string' &&
      kirim.aiModel === 'gemini-uji',
    { rows, aiModel: kirim.aiModel },
  );
  cek('model dipanggil tepat sekali', modelDipanggil === 1, modelDipanggil);
}

{
  const sb = supabasePalsu({ status: { boleh: false } });
  const { r, pos, modelDipanggil } = await jalankan({ sb });
  cek('tanpa punya_akses_ai -> 403, model & pos TIDAK dipanggil, tidak ada yang tersimpan', r.status === 403 && modelDipanggil === 0 && pos.panggilan.length === 0 && sb.tercatat.length === 0, r);
}
{
  const sb = supabasePalsu({ status: { terpakai: 20 } });
  const { r, modelDipanggil } = await jalankan({ sb });
  cek('jatah habis -> 429 sebelum apa pun disimpan', r.status === 429 && modelDipanggil === 0 && sb.tercatat.length === 0, r);
}
{
  const sb = supabasePalsu();
  const { r, modelDipanggil } = await jalankan({ sb, file: { nama: 'opname.xls', data: contoh } });
  cek('bukan .xlsx -> 400, tidak ada percakapan', r.status === 400 && modelDipanggil === 0 && sb.tercatat.length === 0, r);
}
{
  const sb = supabasePalsu();
  const { r } = await jalankan({ sb, outletId: 'bukan-uuid' });
  cek('outlet bukan UUID -> 400', r.status === 400 && sb.tercatat.length === 0, r);
}
{
  const sb = supabasePalsu({ tolakPesanUser: 'BATAS_PESAN_AI:20' });
  const { r, modelDipanggil } = await jalankan({ sb });
  cek('trigger jatah menolak pesan user -> 429, model tidak dipanggil', r.status === 429 && modelDipanggil === 0, r);
}
{
  const { r, pos, sb } = await jalankan({ model: async () => 'bukan json' });
  cek('bacaan AI rusak -> 502, pos-fnb TIDAK dipanggil, tidak ada pesan model', r.status === 502 && pos.panggilan.length === 0 && !sb.tercatat.some((t) => t.baris.peran === 'model'), r);
}
{
  const { r, sb } = await jalankan({ pos: posPalsu({ akses: 'ok', status: 'outlet_not_allowed' }) });
  cek(
    'outlet di luar hak (pos-fnb) -> 403 + log "ditolak", tanpa pesan model (tidak memakai jatah)',
    r.status === 403 && sb.tercatat.some((t) => t.tabel === 'ai_panggilan_alat' && t.baris.status === 'ditolak') && !sb.tercatat.some((t) => t.baris.peran === 'model'),
    r,
  );
}
{
  const { r } = await jalankan({ pos: posPalsu({ akses: 'tanpa_akses_pos' }) });
  cek('tanpa akses POS -> 403 "tidak punya akses data POS"', r.status === 403 && String(r.body.error).includes('akses data POS'), r);
}
{
  const sb = supabasePalsu();
  const pos = posPalsu({ akses: 'ok', status: 'ok', outlets: [{ id: OUTLET, name: 'Indokopi Jatinegara' }] });
  const r = await tanganiOutletImpor({ supabase: sb.klien, terkonfigurasi: true, panggilPos: pos.panggil });
  cek('GET outlet: daftar dari pos-fnb, action "outlets"', r.status === 200 && pos.panggilan[0]!.action === 'outlets' && (r.body.outlets as unknown[]).length === 1, r);
  const r2 = await tanganiOutletImpor({ supabase: supabasePalsu({ status: { boleh: false } }).klien, terkonfigurasi: true, panggilPos: pos.panggil });
  cek('GET outlet tanpa punya_akses_ai -> 403', r2.status === 403, r2);
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
