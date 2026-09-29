#!/usr/bin/env -S npx tsx
// Uji loop agen + pelaksana alat asisten AI (28 September 2026) -- model
// palsu, klien Supabase palsu, fetch palsu. Tidak menyentuh jaringan atau
// database (tidak perlu .env.local).
//
// Jalankan: npx tsx scripts/uji-agen-ai.mts

import { jalankanAgen, instruksiSistem, satuKalimat, JAWABAN_MELEBIHI_PUTARAN, MAKS_PUTARAN_ALAT } from '../lib/ai/agen';
import { rentangPeriode } from '../lib/ai/periode';
import { jalankanPutaranAlat, BARIS_UNTUK_MODEL, DEKLARASI_ALAT } from '../lib/ai/alat';
import { buatPanggilGemini, GalatPenyediaAi, type IsiGemini, type PermintaanGemini } from '../lib/ai/gemini';
import { catatanTerpotong } from '../lib/ai/tabel';
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
// Hasil akses_pos_saya() palsu -- harus sampai ke token apa adanya.
const AKSES_POS_UJI = { boleh: true, peran_pos: 'manager', semua_outlet: false, audit_semua: false, outlet_pos_ids: ['11111111-1111-4111-8111-111111111111'] };
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
      if (nama === 'akses_pos_saya') {
        const jawab = { data: AKSES_POS_UJI, error: null };
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
// Selasa 29 September 2026 -- tanggal jangkar semua uji periode di bawah.
const HARI_INI = '2026-09-29';
const jpa = (klien: SupabaseClient, panggilan: Parameters<typeof jalankanPutaranAlat>[2]) => jalankanPutaranAlat(klien, user, panggilan, HARI_INI);

// 5. Nama alat di luar daftar tidak pernah dijalankan (termasuk nama prototipe objek).
{
  const s = supabasePalsu();
  let fetchDipanggil = 0;
  globalThis.fetch = (async () => {
    fetchDipanggil += 1;
    return new Response('{}');
  }) as typeof fetch;
  const r = await jpa(s.klien, [
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
  const r = await jpa(s.klien, [{ name: 'presensi', args: { start_date: 'kemarin', end_date: '2026-09-27' } }]);
  cek('tanggal bukan YYYY-MM-DD -> argumen_salah, rpc tidak dipanggil', r[0]!.catatan.status === 'argumen_salah' && s.rpcDipanggil.length === 0);

  const banyak = Array.from({ length: 150 }, (_, i) => ({ nama: `Orang ${i}`, hari_absen_masuk: 5 }));
  const s2 = supabasePalsu(banyak);
  const r2 = await jpa(s2.klien, [{ name: 'presensi', args: { start_date: '2026-09-21', end_date: '2026-09-27' } }]);
  const um = r2[0]!.untukModel as { baris: unknown[]; jumlah_baris_total: number; catatan?: string };
  cek(`150 baris -> model menerima ${BARIS_UNTUK_MODEL} + catatan "jangan menjumlahkan", tabel tetap 150, log jumlah_baris 150`,
    um.baris.length === BARIS_UNTUK_MODEL && um.jumlah_baris_total === 150 && /Jangan menyimpulkan atau menjumlahkan/.test(um.catatan ?? '') &&
      r2[0]!.tabel[0]!.baris.length === 150 && r2[0]!.catatan.jumlahBaris === 150 && s2.rpcDipanggil[0]!.nama === 'ai_presensi');

  const s3 = supabasePalsu([]);
  const r3 = await jpa(s3.klien, [{ name: 'omzet_pos_harian', args: { start_date: '2026-09-27', end_date: '2026-09-27' } }]);
  cek('nol baris + penanya melihat SEMUA -> tidak_ada_data, log "kosong", tanpa tabel',
    r3[0]!.untukModel.status === 'tidak_ada_data' && r3[0]!.catatan.status === 'kosong' && r3[0]!.tabel.length === 0);
}

// 6b. BATAS HAK BUKAN DATA KOSONG (alat lokal).
{
  const s = supabasePalsu([], CAKUPAN_MANAGER);
  const r = await jpa(s.klien, [{ name: 'omzet_pos_harian', args: { start_date: '2026-09-27', end_date: '2026-09-27' } }]);
  cek('manager_resto tanya omzet -> tidak_berhak (bukan tidak_ada_data), ai_omzet_pos TIDAK dipanggil',
    r[0]!.untukModel.status === 'tidak_berhak' && r[0]!.catatan.status === 'tidak_berhak' && s.rpcDipanggil.length === 0, r[0]!.untukModel);

  const s2 = supabasePalsu([], CAKUPAN_CEO, 'TIDAK_BERHAK');
  const r2 = await jpa(s2.klien, [{ name: 'omzet_pos_harian', args: { start_date: '2026-09-27', end_date: '2026-09-27' } }]);
  cek('database menolak TIDAK_BERHAK (jaring kedua) -> tidak_berhak, bukan galat/kosong', r2[0]!.untukModel.status === 'tidak_berhak', r2[0]!.untukModel);

  const s3 = supabasePalsu([], CAKUPAN_MANAGER);
  const r3 = await jpa(s3.klien, [
    { name: 'presensi', args: { start_date: '2026-09-21', end_date: '2026-09-27' } },
    { name: 'status_laporan', args: { start_date: '2026-09-21', end_date: '2026-09-27' } },
  ]);
  cek('nol baris + cakupan terbatas -> kosong_dalam_hak + batas_hak disebut, log "kosong_dalam_hak"',
    r3.every((h) => h.untukModel.status === 'kosong_dalam_hak' && typeof h.untukModel.batas_hak === 'string' && h.catatan.status === 'kosong_dalam_hak'),
    r3.map((h) => h.untukModel));

  const s4 = supabasePalsu([{ nama: 'AKUN UJI - Karyawan', hari_absen_masuk: 5 }], CAKUPAN_MANAGER);
  const r4 = await jpa(s4.klien, [{ name: 'presensi', args: { start_date: '2026-09-21', end_date: '2026-09-27' } }]);
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
  const r = await jpa(s.klien, [
    { name: 'stok_bahan', args: { outlet: 'Kemayoran' } },
    { name: 'status_opname', args: {} },
  ]);
  const payload = JSON.parse(Buffer.from(permintaan[0]!.body.token.split('.')[0]!, 'base64url').toString());
  cek('dua alat POS dalam satu putaran -> SATU permintaan ke /api/ai/tools dengan nama alat pos-fnb',
    permintaan.length === 1 && permintaan[0]!.url === 'https://pos.contoh.test/api/ai/tools' &&
      permintaan[0]!.body.calls.map((c) => c.name).join() === 'stock_levels,opname_status');
  cek('token jembatan: aud pos-fnb-ai-query, TTL 60 detik, akses = PERSIS hasil akses_pos_saya() penanya sendiri (tidak ada field lain)',
    payload.aud === 'pos-fnb-ai-query' && Object.keys(payload).sort().join() === 'akses,aud,email,exp,iat,nama,nonce,uid' &&
      payload.exp - payload.iat === 60 && JSON.stringify(payload.akses) === JSON.stringify(AKSES_POS_UJI) && payload.email === user.email, payload);
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
  const r2 = await jpa(s.klien, [
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
  const r3 = await jpa(s.klien, [{ name: 'stok_bahan', args: {} }]);
  cek('membership POS tanpa outlet sama sekali -> tidak_berhak, bukan "stok kosong"', r3[0]!.untukModel.status === 'tidak_berhak', r3[0]!.untukModel);

  jawabanPos = {
    access: 'ok',
    outletScope: 'all',
    results: [{ name: 'stock_levels', result: { status: 'ok', outletFilter: 'all_visible', period: null, rows: [], totalCount: 0 } }],
  };
  const r4 = await jpa(s.klien, [{ name: 'stok_bahan', args: {} }]);
  cek('cakupan SEMUA outlet + nol baris -> tidak_ada_data (satu-satunya jalan ke "tidak ada data")', r4[0]!.untukModel.status === 'tidak_ada_data', r4[0]!.untukModel);

  const tiapPanggil = permintaan.slice(-1)[0]!.body.token !== permintaan[0]!.body.token;
  cek('token baru untuk tiap permintaan (sekali pakai)', tiapPanggil);
}

// 8. PERIODE RELATIF = periode KALENDER, bukan jendela bergulir (koreksi CEO).
{
  const sama = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  cek('hari_ini (Selasa 29 Sep) = 29 Sep saja', sama(rentangPeriode(HARI_INI, 'hari_ini'), { dari: '2026-09-29', sampai: '2026-09-29' }));
  cek('minggu_ini = Senin 28 Sep s/d Selasa 29 Sep (BUKAN 22-29 Sep)', sama(rentangPeriode(HARI_INI, 'minggu_ini'), { dari: '2026-09-28', sampai: '2026-09-29' }));
  cek('minggu_lalu = Senin 21 s/d Minggu 27 Sep', sama(rentangPeriode(HARI_INI, 'minggu_lalu'), { dari: '2026-09-21', sampai: '2026-09-27' }));
  cek('bulan_ini = 1 s/d 29 Sep', sama(rentangPeriode(HARI_INI, 'bulan_ini'), { dari: '2026-09-01', sampai: '2026-09-29' }));
  cek('kemarin = 28 Sep; bulan_lalu = 1-31 Agu', sama(rentangPeriode(HARI_INI, 'kemarin'), { dari: '2026-09-28', sampai: '2026-09-28' }) &&
    sama(rentangPeriode(HARI_INI, 'bulan_lalu'), { dari: '2026-08-01', sampai: '2026-08-31' }));
  cek('tepi: Senin -> minggu_ini hari itu saja; Minggu -> Senin s/d Minggu; lintas tahun',
    sama(rentangPeriode('2026-09-28', 'minggu_ini'), { dari: '2026-09-28', sampai: '2026-09-28' }) &&
      sama(rentangPeriode('2026-10-04', 'minggu_ini'), { dari: '2026-09-28', sampai: '2026-10-04' }) &&
      sama(rentangPeriode('2027-01-01', 'minggu_lalu'), { dari: '2026-12-21', sampai: '2026-12-27' }));

  const s1 = supabasePalsu([{ pic_nama: 'A', hari_belum: 2 }]);
  await jpa(s1.klien, [
    { name: 'status_laporan', args: { periode: 'minggu_ini' } },
    { name: 'presensi', args: { periode: 'minggu_lalu' } },
    { name: 'status_laporan', args: { periode: 'bulan_ini' } },
    { name: 'presensi', args: { periode: 'hari_ini' } },
  ]);
  const args = s1.rpcDipanggil.map((r) => r.args);
  cek('argumen `periode` dari model -> rpc menerima tanggal hitungan SERVER (minggu_ini/minggu_lalu/bulan_ini/hari_ini)',
    sama(args, [
      { p_dari: '2026-09-28', p_sampai: '2026-09-29' },
      { p_dari: '2026-09-21', p_sampai: '2026-09-27' },
      { p_dari: '2026-09-01', p_sampai: '2026-09-29' },
      { p_dari: '2026-09-29', p_sampai: '2026-09-29' },
    ]), args);
  const s2 = supabasePalsu();
  const r2 = await jpa(s2.klien, [{ name: 'presensi', args: { periode: '7_hari_terakhir' } }]);
  cek('periode di luar daftar -> argumen_salah, database tidak disentuh', r2[0]!.catatan.status === 'argumen_salah' && s2.rpcDipanggil.length === 0);
  const deklarasi = DEKLARASI_ALAT.filter((d) => 'start_date' in ((d.parameters.properties ?? {}) as object));
  cek('semua alat rentang tanggal menawarkan `periode` enum dan tidak mewajibkan start/end_date',
    deklarasi.length === 5 && deklarasi.every((d) => {
      const pr = d.parameters as { properties: Record<string, { enum?: string[] }>; required?: string[] };
      return pr.properties.periode?.enum?.includes('minggu_ini') && !(pr.required ?? []).includes('start_date');
    }));
}

// 9. JANGAN BILANG DUA KALI: ada tabel -> prosa satu kalimat; angka utama dari alat.
{
  cek('satuKalimat: daftar berpoin -> baris pertama saja, tanpa penanda',
    satuKalimat('18 dari 31 orang belum lapor untuk 28-29 Sep.\n\n* **Ahmad** (Kebersihan)\n* Cuko') === '18 dari 31 orang belum lapor untuk 28-29 Sep.');
  const m = modelBerurutan([
    panggilAlat('status_laporan', { periode: 'minggu_ini' }),
    teks('2 dari 3 orang belum mengirim laporan untuk 28-29 Sep 2026.\n\n* Ahmad\n* Cuko'),
  ]);
  const r = await jalankanAgen({
    panggilModel: m.panggil,
    instruksi: 'x',
    fungsi: DEKLARASI_ALAT,
    riwayat: [],
    pertanyaan: 'siapa belum lapor minggu ini?',
    jalankanPutaran: async (p) => p.map(() => ({ untukModel: { status: 'ok' }, tabel: [tabelContoh] })),
  });
  cek('ada tabel -> jawaban dipangkas jadi satu kalimat', r.jawaban === '2 dari 3 orang belum mengirim laporan untuk 28-29 Sep 2026.', r.jawaban);
  const m2 = modelBerurutan([teks('Baris satu.\nBaris dua.')]);
  const r3 = await jalankanAgen({ panggilModel: m2.panggil, instruksi: 'x', fungsi: [], riwayat: [], pertanyaan: '?', jalankanPutaran: async () => [] });
  cek('tanpa tabel -> jawaban tidak dipangkas', r3.jawaban === 'Baris satu.\nBaris dua.', r3.jawaban);

  const s3 = supabasePalsu([
    { pic_nama: 'A', form_key: 'x', hari_belum: 2 },
    { pic_nama: 'A', form_key: 'y', hari_belum: 0 },
    { pic_nama: 'B', form_key: 'x', hari_belum: 0 },
    { pic_nama: 'C', form_key: 'x', hari_belum: 1 },
  ]);
  const r4 = await jpa(s3.klien, [{ name: 'status_laporan', args: { periode: 'minggu_ini' } }]);
  const ringkas = (r4[0]!.untukModel as { ringkasan?: Record<string, number> }).ringkasan;
  cek('ringkasan status_laporan dihitung server: 2 dari 3 ORANG belum lapor (bukan 4 baris penugasan)',
    ringkas?.orang_belum_lapor === 2 && ringkas?.orang_total === 3 && ringkas?.penugasan_total === 4, ringkas);
  cek('instruksi sistem: satu kalimat kalau ada tabel + periode relatif lewat argumen',
    /HANYA SATU KALIMAT/.test(instruksiSistem(HARI_INI)) && /isi argumen `periode`/.test(instruksiSistem(HARI_INI)));
}

// 10. Gemini 503 dicoba ulang (maks 2x); status lain tidak.
{
  process.env.GEMINI_API_KEY = 'kunci-uji-palsu';
  const jalankan = async (urutanStatus: number[]) => {
    let panggil = 0;
    globalThis.fetch = (async () => {
      const st = urutanStatus[Math.min(panggil++, urutanStatus.length - 1)]!;
      return st === 200
        ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 })
        : new Response(JSON.stringify({ error: { status: st === 503 ? 'UNAVAILABLE' : 'RESOURCE_EXHAUSTED', message: 'The model is overloaded.' } }), { status: st });
    }) as typeof fetch;
    const model = buatPanggilGemini(async () => {}); // tanpa jeda sungguhan di uji
    try {
      const r = await model({ instruksiSistem: 'x', isi: [], fungsi: [] });
      return { ok: true, panggil, teks: (r.parts[0] as { text: string }).text, galat: null as GalatPenyediaAi | null };
    } catch (e) {
      return { ok: false, panggil, teks: '', galat: e as GalatPenyediaAi };
    }
  };
  const a = await jalankan([503, 503, 200]);
  cek('503, 503, lalu 200 -> berhasil pada percobaan ke-3', a.ok && a.panggil === 3 && a.teks === 'ok', a);
  const b = await jalankan([503, 503, 503, 200]);
  cek('503 tiga kali -> berhenti (maks 2 ulang), galat membawa status + alasan Google',
    !b.ok && b.panggil === 3 && b.galat?.status === 503 && /UNAVAILABLE/.test(b.galat?.alasan ?? ''), { panggil: b.panggil, alasan: b.galat?.alasan });
  const c = await jalankan([429, 200]);
  cek('429 (kuota) TIDAK dicoba ulang', !c.ok && c.panggil === 1 && c.galat?.status === 429, { panggil: c.panggil });

  const s = supabasePalsu([{ pic_nama: 'A', hari_belum: 1 }]);
  const r = await jpa(s.klien, [{ name: 'status_laporan', args: { periode: 'minggu_ini' } }]);
  const per = (r[0]!.untukModel as { periode?: { nama?: string } }).periode;
  cek('periode relatif membawa nama bahasa biasa ("minggu ini"), bukan kode', per?.nama === 'minggu ini', per);
  cek('instruksi sistem melarang menulis kode periode', /JANGAN PERNAH menulis kode seperti minggu_ini/.test(instruksiSistem(HARI_INI)));
  const aturanSapaan = instruksiSistem(HARI_INI).split('\n').filter((b) => b.startsWith('-') || b.startsWith('  -'));
  cek('sapaan "Anda": aturan eksplisit, dan tidak ada "kamu"/"-mu" di aturan yang ditiru model',
    /Sapa penanya dengan "Anda"/.test(instruksiSistem(HARI_INI)) && aturanSapaan.filter((b) => !/JANGAN PERNAH memakai/.test(b)).every((b) => !/\bkamu\b|\w+mu\b(?!\w)/i.test(b.replace(/\bmu(?=lai)/g, ''))),
    aturanSapaan.filter((b) => /\bkamu\b/i.test(b)));
}

// 11. TIDAK PERNAH membuang baris diam-diam + coba ulang sekali (koreksi CEO 29 Sep).
{
  const baris = (n: number) => Array.from({ length: n }, (_, i) => ({ a: String(i) }));
  const t250 = { judul: 'Stok bahan', kolom: [{ key: 'a', label: 'A', jenis: 'teks' as const }], baris: baris(250), totalBaris: 250 };
  const t6000 = { ...t250, baris: baris(5000), totalBaris: 6000 };
  const t150 = { ...t250, baris: baris(150), totalBaris: 150 };
  cek('250 baris -> "Menampilkan 200 dari 250 baris ...; semua baris ada di Unduh Excel"',
    catatanTerpotong(t250) === 'Menampilkan 200 dari 250 baris stok bahan; semua baris ada di Unduh Excel.', catatanTerpotong(t250));
  cek('sumber 6000, tersimpan 5000 -> catatan menyebut Excel memuat 5.000 baris pertama',
    /dari 6\.000 baris.*Unduh Excel memuat 5\.000 baris pertama/.test(catatanTerpotong(t6000) ?? ''), catatanTerpotong(t6000));
  cek('150 baris -> tidak ada catatan (semua tampil)', catatanTerpotong(t150) === null);
  const m = modelBerurutan([panggilAlat('stok_bahan'), teks('Ada 250 bahan di semua outlet.')]);
  const r = await jalankanAgen({
    panggilModel: m.panggil, instruksi: 'x', fungsi: DEKLARASI_ALAT, riwayat: [], pertanyaan: 'stok?',
    jalankanPutaran: async (p) => p.map(() => ({ untukModel: { status: 'ok' }, tabel: [t250] })),
  });
  cek('jawaban dengan tabel terpotong WAJIB menyebut "Menampilkan 200 dari 250 baris" (ditambahkan server)',
    r.jawaban === 'Ada 250 bahan di semua outlet. Menampilkan 200 dari 250 baris stok bahan; semua baris ada di Unduh Excel.', r.jawaban);

  // POS: jembatan galat sekali -> dicoba ulang, jawaban kedua dipakai.
  process.env.POS_INTEGRASI_URL = 'https://pos.contoh.test';
  process.env.POS_HANDOFF_SECRET = 'rahasia-uji-minimal-32-karakter-panjangnya!!';
  const ok = { access: 'ok', outletScope: 'all', results: [{ name: 'stock_levels', result: { status: 'ok', outletFilter: 'all_visible', period: null, rows: [{ outlet: 'A', bahan: 'susu' }], totalCount: 1 } }] };
  const galatAlat = { access: 'ok', outletScope: 'all', results: [{ name: 'stock_levels', result: { status: 'error' } }] };
  const jalankanDengan = async (urutan: (number | object)[]) => {
    let n = 0;
    globalThis.fetch = (async () => {
      const x = urutan[Math.min(n++, urutan.length - 1)]!;
      return typeof x === 'number' ? new Response('<html>500</html>', { status: x }) : new Response(JSON.stringify(x), { status: 200 });
    }) as typeof fetch;
    const hasil = await jpa(supabasePalsu().klien, [{ name: 'stok_bahan', args: {} }]);
    return { n, status: hasil[0]!.untukModel.status };
  };
  const a = await jalankanDengan([500, ok]);
  cek('POS HTTP 500 lalu ok -> dicoba ulang SEKALI, hasil ok (bukan "tidak bisa diambil")', a.n === 2 && a.status === 'ok', a);
  const b = await jalankanDengan([galatAlat, ok]);
  cek('POS alat galat lalu ok -> dicoba ulang, hasil ok', b.n === 2 && b.status === 'ok', b);
  const c = await jalankanDengan([500, 500, ok]);
  cek('POS gagal dua kali -> berhenti sesudah SATU coba ulang (2 permintaan), status galat', c.n === 2 && c.status === 'galat', c);

  // Lokal: galat sesaat -> dicoba ulang sekali.
  let panggilRpc = 0;
  const kliensesaat = {
    rpc: (nama: string) => {
      const jawab = nama === 'ai_cakupan'
        ? { data: { laporan_semua: true, presensi_semua: true, omzet_pos: true }, error: null }
        : ++panggilRpc === 1 ? { data: null, error: { message: 'canceling statement due to statement timeout' } } : { data: [{ nama: 'A' }], error: null };
      return Object.assign(Promise.resolve(jawab), { single: async () => jawab });
    },
  } as unknown as SupabaseClient;
  const l = await jpa(kliensesaat, [{ name: 'presensi', args: { periode: 'minggu_ini' } }]);
  cek('alat lokal: galat sesaat -> dicoba ulang sekali, hasil ok', panggilRpc === 2 && l[0]!.untukModel.status === 'ok', { panggilRpc, status: l[0]!.untukModel.status });
  const s2 = supabasePalsu([], CAKUPAN_CEO, 'TIDAK_BERHAK');
  await jpa(s2.klien, [{ name: 'omzet_pos_harian', args: { periode: 'kemarin' } }]);
  cek('alat lokal: TIDAK_BERHAK tidak dicoba ulang (batas hak, bukan galat)', s2.rpcDipanggil.length === 1);
}

// 12. Kejujuran stok & cakupan resep (koreksi CEO 29 Sep): catatan wajib server.
{
  process.env.POS_INTEGRASI_URL = 'https://pos.contoh.test';
  process.env.POS_HANDOFF_SECRET = 'rahasia-uji-minimal-32-karakter-panjangnya!!';
  const pos = (result: object) => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ access: 'ok', outletScope: 'all', results: [{ name: 'x', result }] }), { status: 200 })) as typeof fetch;
  };
  pos({
    status: 'ok', outletFilter: 'all_visible', period: null, totalCount: 65,
    rows: [{ outlet: 'Indokopi Jatinegara', bahan: 'susu', satuan: 'ml', stok: '10', minimum: '0', di_bawah_minimum: false }],
    extra: { stockCoverage: { outletsWithoutStock: ['Indokopi Lite Kemayoran', 'Indosteak Cempaka Putih', 'Indosteak Pekansari'], withoutMinimum: 65, stockRows: 65 } },
  });
  const [stok] = await jpa(supabasePalsu().klien, [{ name: 'stok_bahan', args: {} }]);
  cek('stok: catatan wajib menyebut 3 outlet tanpa catatan stok + 65 dari 65 tanpa minimum',
    (stok!.catatanWajib ?? []).some((c) => c.includes('Indokopi Lite Kemayoran, Indosteak Cempaka Putih, Indosteak Pekansari')) &&
      (stok!.catatanWajib ?? []).some((c) => c.startsWith('65 dari 65 catatan stok belum punya stok minimum')), stok!.catatanWajib);
  const m = modelBerurutan([panggilAlat('stok_bahan'), teks('Tidak ada bahan di bawah minimum untuk semua outlet.')]);
  const r = await jalankanAgen({
    panggilModel: m.panggil, instruksi: 'x', fungsi: DEKLARASI_ALAT, riwayat: [], pertanyaan: 'stok di bawah minimum?',
    jalankanPutaran: async () => [stok!],
  });
  cek('jawaban akhir SELALU memuat outlet tanpa data & tanpa minimum (ditambahkan server, apa pun kata model)',
    r.jawaban.includes('Outlet tanpa catatan stok sama sekali: Indokopi Lite Kemayoran') && r.jawaban.includes('belum punya stok minimum'), r.jawaban);
  cek('instruksi melarang "semua outlet" kalau ada outlet tanpa catatan stok', /JANGAN PERNAH menulis "semua outlet"/.test(instruksiSistem(HARI_INI)));

  pos({
    status: 'ok', outletFilter: 'all_visible', period: null, totalCount: 2,
    rows: [{ outlet: 'Indokopi Jatinegara', bahan: 'Gula Aren', satuan: 'g', stok: '500' }, { outlet: 'Indokopi Jatinegara', bahan: 'Es Batu', satuan: 'g', stok: '0' }],
    extra: { recipeCoverage: {
      perOutlet: [
        { outletName: 'Indokopi Jatinegara', ingredientsWithoutRecipe: 2, productsWithoutRecipe: 3, stockRows: 65 },
        { outletName: 'Indosteak Pekansari', ingredientsWithoutRecipe: 0, productsWithoutRecipe: 7, stockRows: 0 },
      ],
      products: [{ outlet: 'Indosteak Pekansari', produk: 'Sirloin', kategori: 'Steak' }],
      productTotal: 10, masterIngredientsWithoutRecipe: 40, masterIngredients: 225,
    } },
  });
  const [resep] = await jpa(supabasePalsu().klien, [{ name: 'cakupan_resep', args: {} }]);
  cek('cakupan resep: hitungan per outlet + outlet tanpa catatan stok + master bahan, dua tabel (bahan & produk)',
    (resep!.catatanWajib ?? []).some((c) => c.includes('Indokopi Jatinegara 2 bahan / 3 produk; Indosteak Pekansari 0 bahan / 7 produk')) &&
      (resep!.catatanWajib ?? []).some((c) => c.includes('belum bisa dihitung): Indosteak Pekansari')) &&
      (resep!.catatanWajib ?? []).some((c) => c.includes('40 dari 225 bahan')) &&
      resep!.tabel.map((t) => t.judul).join() === 'Bahan tanpa resep,Produk tanpa resep', { catatan: resep!.catatanWajib, tabel: resep!.tabel.map((t) => t.judul) });
  const dek = DEKLARASI_ALAT.find((d) => d.name === 'cakupan_resep');
  cek('deklarasi cakupan_resep membedakan "tidak masuk resep" dari "tidak terjual bulan ini"', Boolean(dek && /BUKAN soal bahan yang tidak terjual/.test(dek.description)));
}

let gagal = 0;
for (const h of hasil) {
  if (!h.lolos) gagal += 1;
  console.log(`${h.lolos ? 'LOLOS' : 'GAGAL'}  ${h.nama}${h.lolos ? '' : `\n        -> ${JSON.stringify(h.detail)}`}`);
}
console.log(`\n${hasil.length - gagal}/${hasil.length} lolos.`);
process.exit(gagal === 0 ? 0 : 1);
