#!/usr/bin/env -S npx tsx
// Uji loop agen + pelaksana alat asisten AI (28 September 2026) -- model
// palsu, klien Supabase palsu, fetch palsu. Tidak menyentuh jaringan atau
// database (tidak perlu .env.local).
//
// Jalankan: npx tsx scripts/uji-agen-ai.mts

import { jalankanAgen, instruksiSistem, JAWABAN_MELEBIHI_PUTARAN, MAKS_PUTARAN_ALAT } from '../lib/ai/agen';
import { jalankanPutaranAlat, BARIS_UNTUK_MODEL, DEKLARASI_ALAT } from '../lib/ai/alat';
import type { IsiGemini, PermintaanGemini } from '../lib/ai/gemini';
import type { SupabaseClient } from '@supabase/supabase-js';

const hasil: { nama: string; lolos: boolean; detail?: unknown }[] = [];
const cek = (nama: string, lolos: boolean, detail?: unknown) => hasil.push({ nama, lolos, detail });

const panggilAlat = (name: string, args: Record<string, unknown> = {}): IsiGemini => ({ role: 'model', parts: [{ functionCall: { name, args } }] });
const teks = (t: string): IsiGemini => ({ role: 'model', parts: [{ text: t }] });

function modelBerurutan(jawaban: IsiGemini[]) {
  const permintaan: PermintaanGemini[] = [];
  let i = 0;
  return {
    permintaan,
    panggil: async (p: PermintaanGemini) => {
      permintaan.push(structuredClone(p));
      return jawaban[Math.min(i++, jawaban.length - 1)]!;
    },
  };
}

const tabelContoh = { judul: 'x', kolom: [{ key: 'a', label: 'A', jenis: 'teks' as const }], baris: [{ a: '1' }], totalBaris: 1 };

// 1. Satu putaran alat lalu jawaban.
{
  const m = modelBerurutan([panggilAlat('omzet_pos_harian', { start_date: '2026-09-27', end_date: '2026-09-27' }), teks('Rp1.000 (27 Sep, semua outlet).')]);
  let dipanggil = 0;
  const r = await jalankanAgen({
    panggilModel: m.panggil,
    instruksi: 'x',
    fungsi: DEKLARASI_ALAT,
    riwayat: [],
    pertanyaan: 'omzet kemarin?',
    jalankanPutaran: async (p) => {
      dipanggil += 1;
      return p.map(() => ({ untukModel: { status: 'ok', baris: [{ a: 1 }] }, tabel: [tabelContoh] }));
    },
  });
  const terakhir = m.permintaan.at(-1)!.isi.at(-1)!;
  cek('1 putaran alat -> selesai, tabel ikut, hasil alat dikirim balik sebagai functionResponse',
    r.status === 'selesai' && r.putaranAlat === 1 && r.tabel.length === 1 && dipanggil === 1 && 'functionResponse' in terakhir.parts[0]!, r);
}

// 2. Model terus minta alat -> berhenti setelah 4 putaran, TANPA jawaban/tabel parsial.
{
  const m = modelBerurutan([panggilAlat('stok_bahan')]);
  let dipanggil = 0;
  const r = await jalankanAgen({
    panggilModel: m.panggil,
    instruksi: 'x',
    fungsi: DEKLARASI_ALAT,
    riwayat: [],
    pertanyaan: 'semua hal',
    jalankanPutaran: async (p) => {
      dipanggil += 1;
      return p.map(() => ({ untukModel: { status: 'ok' }, tabel: [tabelContoh] }));
    },
  });
  cek(`> ${MAKS_PUTARAN_ALAT} putaran -> "tidak bisa menjawab", tabel kosong, alat dijalankan tepat ${MAKS_PUTARAN_ALAT}x`,
    r.status === 'melebihi_putaran' && r.jawaban === JAWABAN_MELEBIHI_PUTARAN && r.tabel.length === 0 && dipanggil === MAKS_PUTARAN_ALAT && m.permintaan.length === MAKS_PUTARAN_ALAT + 1,
    { status: r.status, dipanggil, model: m.permintaan.length });
}

// 3. Model tidak memberi apa pun -> jawaban baku, bukan string kosong.
{
  const m = modelBerurutan([{ role: 'model', parts: [] }]);
  const r = await jalankanAgen({ panggilModel: m.panggil, instruksi: 'x', fungsi: [], riwayat: [], pertanyaan: '?', jalankanPutaran: async () => [] });
  cek('jawaban model kosong -> status kosong + kalimat baku', r.status === 'kosong' && r.jawaban.length > 0, r);
}

// 4. Instruksi sistem memuat aturan wajib.
{
  const s = instruksiSistem('2026-09-28');
  cek('instruksi sistem: tanggal hari ini + aturan angka dari alat + sebut periode/outlet + batas hak bukan data kosong',
    s.includes('2026-09-28') && /HARUS berasal dari hasil alat/.test(s) && /periode dan outlet/.test(s) &&
      ['tidak_berhak', 'kosong_dalam_hak', 'outlet_di_luar_hak', 'tanpa_akses_pos', 'batas_hak'].every((k) => s.includes(k)) &&
      /BATAS HAK BUKAN DATA KOSONG/.test(s));
}

// Klien Supabase palsu: mencatat rpc alat yang dipanggil. ai_cakupan()
// menjawab `cakupan` (bawaan: CEO, melihat semua); rpc lain menjawab `data`
// atau `galat`.
type Cakupan = { laporan_semua: boolean; presensi_semua: boolean; omzet_pos: boolean };
const CAKUPAN_CEO: Cakupan = { laporan_semua: true, presensi_semua: true, omzet_pos: true };
const CAKUPAN_MANAGER: Cakupan = { laporan_semua: false, presensi_semua: false, omzet_pos: false };
function supabasePalsu(data: unknown[] = [], cakupan: Cakupan = CAKUPAN_CEO, galat: string | null = null) {
  const rpcDipanggil: { nama: string; args: unknown }[] = [];
  const klien = {
    rpc: (nama: string, args: unknown) => {
      if (nama === 'ai_cakupan') {
        const jawab = { data: cakupan, error: null };
        return Object.assign(Promise.resolve(jawab), { single: async () => jawab });
      }
      rpcDipanggil.push({ nama, args });
      const jawab = galat ? { data: null, error: { message: galat } } : { data, error: null };
      return Object.assign(Promise.resolve(jawab), { single: async () => jawab });
    },
  } as unknown as SupabaseClient;
  return { klien, rpcDipanggil };
}
const user = { id: 'uid-uji', email: 'uji@koperumnas.local' };

// 5. Nama alat di luar daftar tidak pernah dijalankan (termasuk nama prototipe objek).
{
  const s = supabasePalsu();
  let fetchDipanggil = 0;
  globalThis.fetch = (async () => {
    fetchDipanggil += 1;
    return new Response('{}');
  }) as typeof fetch;
  const r = await jalankanPutaranAlat(s.klien, user, [
    { name: 'jalankan_sql', args: { query: 'select * from profile' } },
    { name: 'toString', args: {} },
  ]);
  cek('alat tak dikenal -> alat_tidak_ada, dicatat "ditolak", tidak ada rpc/fetch',
    r.every((h) => h.untukModel.status === 'alat_tidak_ada' && h.catatan.status === 'ditolak') && s.rpcDipanggil.length === 0 && fetchDipanggil === 0,
    r.map((h) => h.catatan));
}

// 6. Alat lokal: argumen salah tidak memanggil database; baris untuk model dipotong.
{
  const s = supabasePalsu();
  const r = await jalankanPutaranAlat(s.klien, user, [{ name: 'presensi', args: { start_date: 'kemarin', end_date: '2026-09-27' } }]);
  cek('tanggal bukan YYYY-MM-DD -> argumen_salah, rpc tidak dipanggil', r[0]!.catatan.status === 'argumen_salah' && s.rpcDipanggil.length === 0);

  const banyak = Array.from({ length: 150 }, (_, i) => ({ nama: `Orang ${i}`, hari_absen_masuk: 5 }));
  const s2 = supabasePalsu(banyak);
  const r2 = await jalankanPutaranAlat(s2.klien, user, [{ name: 'presensi', args: { start_date: '2026-09-21', end_date: '2026-09-27' } }]);
  const um = r2[0]!.untukModel as { baris: unknown[]; jumlah_baris_total: number; catatan?: string };
  cek(`150 baris -> model menerima ${BARIS_UNTUK_MODEL} + catatan "jangan menjumlahkan", tabel tetap 150, log jumlah_baris 150`,
    um.baris.length === BARIS_UNTUK_MODEL && um.jumlah_baris_total === 150 && /Jangan menyimpulkan atau menjumlahkan/.test(um.catatan ?? '') &&
      r2[0]!.tabel[0]!.baris.length === 150 && r2[0]!.catatan.jumlahBaris === 150 && s2.rpcDipanggil[0]!.nama === 'ai_presensi');

  const s3 = supabasePalsu([]);
  const r3 = await jalankanPutaranAlat(s3.klien, user, [{ name: 'omzet_pos_harian', args: { start_date: '2026-09-27', end_date: '2026-09-27' } }]);
  cek('nol baris + penanya melihat SEMUA -> tidak_ada_data, log "kosong", tanpa tabel',
    r3[0]!.untukModel.status === 'tidak_ada_data' && r3[0]!.catatan.status === 'kosong' && r3[0]!.tabel.length === 0);
}

// 6b. BATAS HAK BUKAN DATA KOSONG (alat lokal).
{
  const s = supabasePalsu([], CAKUPAN_MANAGER);
  const r = await jalankanPutaranAlat(s.klien, user, [{ name: 'omzet_pos_harian', args: { start_date: '2026-09-27', end_date: '2026-09-27' } }]);
  cek('manager_resto tanya omzet -> tidak_berhak (bukan tidak_ada_data), ai_omzet_pos TIDAK dipanggil',
    r[0]!.untukModel.status === 'tidak_berhak' && r[0]!.catatan.status === 'tidak_berhak' && s.rpcDipanggil.length === 0, r[0]!.untukModel);

  const s2 = supabasePalsu([], CAKUPAN_CEO, 'TIDAK_BERHAK');
  const r2 = await jalankanPutaranAlat(s2.klien, user, [{ name: 'omzet_pos_harian', args: { start_date: '2026-09-27', end_date: '2026-09-27' } }]);
  cek('database menolak TIDAK_BERHAK (jaring kedua) -> tidak_berhak, bukan galat/kosong', r2[0]!.untukModel.status === 'tidak_berhak', r2[0]!.untukModel);

  const s3 = supabasePalsu([], CAKUPAN_MANAGER);
  const r3 = await jalankanPutaranAlat(s3.klien, user, [
    { name: 'presensi', args: { start_date: '2026-09-21', end_date: '2026-09-27' } },
    { name: 'status_laporan', args: { start_date: '2026-09-21', end_date: '2026-09-27' } },
  ]);
  cek('nol baris + cakupan terbatas -> kosong_dalam_hak + batas_hak disebut, log "kosong_dalam_hak"',
    r3.every((h) => h.untukModel.status === 'kosong_dalam_hak' && typeof h.untukModel.batas_hak === 'string' && h.catatan.status === 'kosong_dalam_hak'),
    r3.map((h) => h.untukModel));

  const s4 = supabasePalsu([{ nama: 'AKUN UJI - Karyawan', hari_absen_masuk: 5 }], CAKUPAN_MANAGER);
  const r4 = await jalankanPutaranAlat(s4.klien, user, [{ name: 'presensi', args: { start_date: '2026-09-21', end_date: '2026-09-27' } }]);
  cek('ada baris + cakupan terbatas -> ok TAPI batas_hak tetap disebut', r4[0]!.untukModel.status === 'ok' && typeof r4[0]!.untukModel.batas_hak === 'string');
}

// 7. Alat POS: satu permintaan per putaran, token cuma email+uid, audience AI.
{
  process.env.POS_INTEGRASI_URL = 'https://pos.contoh.test';
  process.env.POS_HANDOFF_SECRET = 'rahasia-uji-minimal-32-karakter-panjangnya!!';
  const permintaan: { url: string; body: { token: string; calls: { name: string }[] } }[] = [];
  let jawabanPos: unknown = { access: 'no_pos_access', results: [] };
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    permintaan.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(jawabanPos), { status: 200 });
  }) as typeof fetch;

  const s = supabasePalsu();
  const r = await jalankanPutaranAlat(s.klien, user, [
    { name: 'stok_bahan', args: { outlet: 'Kemayoran' } },
    { name: 'status_opname', args: {} },
  ]);
  const payload = JSON.parse(Buffer.from(permintaan[0]!.body.token.split('.')[0]!, 'base64url').toString());
  cek('dua alat POS dalam satu putaran -> SATU permintaan ke /api/ai/tools dengan nama alat pos-fnb',
    permintaan.length === 1 && permintaan[0]!.url === 'https://pos.contoh.test/api/ai/tools' &&
      permintaan[0]!.body.calls.map((c) => c.name).join() === 'stock_levels,opname_status');
  cek('token jembatan: aud pos-fnb-ai-query, TANPA role/outlet (cuma aud,email,uid,nonce,iat,exp), TTL 60 detik',
    payload.aud === 'pos-fnb-ai-query' && Object.keys(payload).sort().join() === 'aud,email,exp,iat,nonce,uid' && payload.exp - payload.iat === 60, payload);
  cek('pos-fnb: no_pos_access -> tiap alat "tanpa_akses_pos", tidak ada data',
    r.every((h) => h.untukModel.status === 'tanpa_akses_pos' && h.tabel.length === 0 && h.catatan.status === 'tanpa_akses_pos'));

  jawabanPos = {
    access: 'ok',
    outletScope: 'limited',
    results: [
      { name: 'stock_levels', result: { status: 'ok', outletFilter: 'not_visible', period: null, rows: [], totalCount: 0 } },
      { name: 'opname_status', result: { status: 'forbidden' } },
      { name: 'stock_levels', result: { status: 'ok', outletFilter: 'all_visible', period: null, rows: [], totalCount: 0 } },
    ],
  };
  const r2 = await jalankanPutaranAlat(s.klien, user, [
    { name: 'stok_bahan', args: { outlet: 'Outlet Lain' } },
    { name: 'status_opname', args: {} },
    { name: 'stok_bahan', args: {} },
  ]);
  cek('outlet di luar cakupan -> outlet_di_luar_hak (bukan tidak_ada_data), nama yang diminta TIDAK dipantulkan',
    r2[0]!.untukModel.status === 'outlet_di_luar_hak' && !JSON.stringify(r2[0]!.untukModel).includes('Outlet Lain') &&
      r2[0]!.catatan.status === 'outlet_di_luar_hak', r2[0]!.untukModel);
  cek('pos-fnb menolak izin -> tidak_berhak untuk model dan log', r2[1]!.untukModel.status === 'tidak_berhak' && r2[1]!.catatan.status === 'tidak_berhak', r2[1]!.untukModel);
  cek('cakupan outlet terbatas + nol baris -> kosong_dalam_hak + batas_hak',
    r2[2]!.untukModel.status === 'kosong_dalam_hak' && typeof r2[2]!.untukModel.batas_hak === 'string', r2[2]!.untukModel);

  jawabanPos = {
    access: 'ok',
    outletScope: 'none',
    results: [{ name: 'stock_levels', result: { status: 'ok', outletFilter: 'all_visible', period: null, rows: [], totalCount: 0 } }],
  };
  const r3 = await jalankanPutaranAlat(s.klien, user, [{ name: 'stok_bahan', args: {} }]);
  cek('membership POS tanpa outlet sama sekali -> tidak_berhak, bukan "stok kosong"', r3[0]!.untukModel.status === 'tidak_berhak', r3[0]!.untukModel);

  jawabanPos = {
    access: 'ok',
    outletScope: 'all',
    results: [{ name: 'stock_levels', result: { status: 'ok', outletFilter: 'all_visible', period: null, rows: [], totalCount: 0 } }],
  };
  const r4 = await jalankanPutaranAlat(s.klien, user, [{ name: 'stok_bahan', args: {} }]);
  cek('cakupan SEMUA outlet + nol baris -> tidak_ada_data (satu-satunya jalan ke "tidak ada data")', r4[0]!.untukModel.status === 'tidak_ada_data', r4[0]!.untukModel);

  const tiapPanggil = permintaan.slice(-1)[0]!.body.token !== permintaan[0]!.body.token;
  cek('token baru untuk tiap permintaan (sekali pakai)', tiapPanggil);
}

let gagal = 0;
for (const h of hasil) {
  if (!h.lolos) gagal += 1;
  console.log(`${h.lolos ? 'LOLOS' : 'GAGAL'}  ${h.nama}${h.lolos ? '' : `\n        -> ${JSON.stringify(h.detail)}`}`);
}
console.log(`\n${hasil.length - gagal}/${hasil.length} lolos.`);
process.exit(gagal === 0 ? 0 : 1);
