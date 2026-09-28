#!/usr/bin/env node
// Uji migrasi 0064 (asisten AI) -- TRANSAKSIONAL: satu transaksi yang SELALU
// di-ROLLBACK. Migrasi dijalankan di dalam transaksi ini kalau belum
// terpasang, jadi skrip ini dipakai SEBELUM migrasi diterapkan permanen.
// Menyamar lewat set_config(request.jwt.claims), pola uji-omzet-pos.mjs.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
const hasil = [];
const q = (sql, params) => client.query(sql, params);
let nomor = 0;
function cek(skenario, lolos, mentah = '') {
  nomor += 1;
  hasil.push({ nomor, skenario, mentah: typeof mentah === 'string' ? mentah : JSON.stringify(mentah), lolos });
}

async function sebagaiOwner() {
  await q('reset role');
  await q(`select set_config('request.jwt.claims', '', true)`);
}
async function sebagai(uid) {
  await q('reset role');
  await q(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, true)`, [uid]);
  await q(`select set_config('role', 'authenticated', true)`);
}
async function sebagaiAnon() {
  await q('reset role');
  await q(`select set_config('request.jwt.claims', json_build_object('role','anon')::text, true)`);
  await q(`select set_config('role', 'anon', true)`);
}
async function coba(sql, params) {
  await q('savepoint s');
  try {
    const r = await q(sql, params);
    await q('release savepoint s');
    return { ok: true, rows: r.rows, rowCount: r.rowCount };
  } catch (e) {
    await q('rollback to s');
    return { ok: false, err: e.message };
  }
}
const uid = async (email) => (await q(`select id from auth.users where email = $1`, [email])).rows[0]?.id;

try {
  await client.connect();
  await q('begin;');

  const sudahTerpasang = (await q(`select to_regclass('public.ai_pesan') is not null as ada`)).rows[0].ada;
  if (!sudahTerpasang) {
    const sqlMigrasi = readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0064_asisten_ai.sql'), 'utf8')
      .replace(/^\s*begin;\s*$/im, '')
      .replace(/^\s*commit;\s*$/im, '');
    await q(sqlMigrasi);
  }

  // HANYA akun uji (scripts/buat-akun-uji.mjs) -- tidak ada akun orang
  // sungguhan. Peran accounting/pusat diberikan ke uji5 (tanpa peran) DI
  // DALAM transaksi ini saja, ikut di-ROLLBACK.
  const ceo = await uid('uji-ceo@koperumnas.local');
  const manager = await uid('uji1@koperumnas.local'); // manager_resto
  const karyawan = await uid('uji2@koperumnas.local');
  const admin = await uid('uji6@koperumnas.local'); // admin
  const tanpaPeran = await uid('uji5@koperumnas.local');
  for (const [nama, v] of Object.entries({ ceo, manager, karyawan, admin, tanpaPeran })) if (!v) throw new Error(`akun uji ${nama} tidak ditemukan`);
  const peranUji = async (u, peran) => {
    await sebagaiOwner();
    await q('delete from public.role where user_id = $1', [u]);
    for (const r of peran) await q('insert into public.role (user_id, role) values ($1, $2)', [u, r]);
  };

  // ─── Gerbang peran dari policy ───────────────────────────────────────
  const boleh = async (u) => { await sebagai(u); return (await q('select public.boleh_pakai_ai() as b')).rows[0].b; };
  cek('CEO boleh memakai asisten (peran di policy ai_peran_boleh)', (await boleh(ceo)) === true);
  cek('manager_resto boleh memakai asisten', (await boleh(manager)) === true);
  cek('karyawan TIDAK boleh', (await boleh(karyawan)) === false);
  cek('admin TIDAK boleh', (await boleh(admin)) === false);
  await peranUji(tanpaPeran, ['accounting']);
  cek('accounting TIDAK boleh (bukan "manajer ke atas")', (await boleh(tanpaPeran)) === false);
  await peranUji(tanpaPeran, ['pusat']);
  cek('pusat TIDAK boleh', (await boleh(tanpaPeran)) === false);
  await peranUji(tanpaPeran, []);

  await sebagaiOwner();
  await q(`update public.policy set value = '["ceo","kadiv","manager_resto","karyawan"]' where key = 'ai_peran_boleh'`);
  cek('daftar peran diubah di policy -> karyawan langsung boleh, tanpa ubah kode', (await boleh(karyawan)) === true);
  await sebagaiOwner();
  await q(`update public.policy set value = '["ceo","kadiv","manager_resto"]' where key = 'ai_peran_boleh'`);

  await sebagai(karyawan);
  const insKaryawan = await coba(`insert into public.ai_percakapan (judul) values ('coba') returning id`);
  cek('karyawan tidak bisa membuat percakapan (RLS insert)', !insKaryawan.ok, insKaryawan.err ?? insKaryawan.rows);

  // ─── Privasi percakapan ──────────────────────────────────────────────
  await sebagai(ceo);
  const pCeo = (await q(`insert into public.ai_percakapan (judul) values ('omzet kemarin') returning id`)).rows[0].id;
  await q(`insert into public.ai_pesan (percakapan_id, peran, isi) values ($1, 'user', 'omzet kemarin berapa?')`, [pCeo]);
  await q(`insert into public.ai_panggilan_alat (percakapan_id, alat, argumen, sumber, status, jumlah_baris)
           values ($1, 'omzet_pos_harian', '{"start_date":"2026-09-27"}', 'lokal', 'ok', 3)`, [pCeo]);

  await sebagai(manager);
  const pMgr = (await q(`insert into public.ai_percakapan (judul) values ('stok susu') returning id`)).rows[0].id;
  await q(`insert into public.ai_pesan (percakapan_id, peran, isi) values ($1, 'user', 'stok susu?')`, [pMgr]);
  await q(`insert into public.ai_panggilan_alat (percakapan_id, alat, argumen, sumber, status, jumlah_baris)
           values ($1, 'stok_bahan', '{"ingredient":"susu"}', 'pos', 'ok', 2)`, [pMgr]);

  const mgrLihatCeo = (await q(`select count(*)::int n from public.ai_percakapan where id = $1`, [pCeo])).rows[0].n
    + (await q(`select count(*)::int n from public.ai_pesan where percakapan_id = $1`, [pCeo])).rows[0].n;
  cek('manager TIDAK melihat percakapan/pesan milik CEO', mgrLihatCeo === 0, mgrLihatCeo);

  const mgrTulisKeCeo = await coba(`insert into public.ai_pesan (percakapan_id, peran, isi) values ($1, 'user', 'nyusup')`, [pCeo]);
  cek('manager tidak bisa menulis pesan ke percakapan CEO', !mgrTulisKeCeo.ok, mgrTulisKeCeo.err ?? '');

  const mgrLog = (await q(`select alat from public.ai_panggilan_alat`)).rows.map((r) => r.alat);
  cek('manager cuma melihat log alat miliknya sendiri', JSON.stringify(mgrLog) === JSON.stringify(['stok_bahan']), mgrLog);

  await sebagai(ceo);
  const ceoLihatMgr = (await q(`select count(*)::int n from public.ai_pesan where percakapan_id = $1`, [pMgr])).rows[0].n;
  cek('CEO pun TIDAK membaca isi chat manager (percakapan pribadi)', ceoLihatMgr === 0, ceoLihatMgr);
  const ceoLog = (await q(`select alat from public.ai_panggilan_alat where percakapan_id in ($1, $2) order by alat`, [pCeo, pMgr])).rows.map((r) => r.alat);
  cek('CEO BISA membaca log alat semua orang (biaya & penyalahgunaan)', JSON.stringify(ceoLog) === JSON.stringify(['omzet_pos_harian', 'stok_bahan']), ceoLog);

  const ubah = await coba(`update public.ai_pesan set isi = 'diubah' where percakapan_id = $1`, [pCeo]);
  const hapus = await coba(`delete from public.ai_pesan where percakapan_id = $1`, [pCeo]);
  cek('pesan append-only: update & delete ditolak/0 baris',
    (!ubah.ok || ubah.rowCount === 0) && (!hapus.ok || hapus.rowCount === 0), { ubah: ubah.err ?? ubah.rowCount, hapus: hapus.err ?? hapus.rowCount });

  const hapusLog = await coba(`delete from public.ai_panggilan_alat where percakapan_id = $1`, [pCeo]);
  cek('log alat append-only: delete ditolak/0 baris', !hapusLog.ok || hapusLog.rowCount === 0, hapusLog.err ?? hapusLog.rowCount);

  // ─── Batas pesan harian dari policy ──────────────────────────────────
  await sebagaiOwner();
  await q(`update public.policy set value = '2' where key = 'ai_batas_pesan_harian'`);
  await sebagai(ceo);
  const kedua = await coba(`insert into public.ai_pesan (percakapan_id, peran, isi) values ($1, 'user', 'pertanyaan 2')`, [pCeo]);
  const ketiga = await coba(`insert into public.ai_pesan (percakapan_id, peran, isi) values ($1, 'user', 'pertanyaan 3')`, [pCeo]);
  cek('batas 2: pesan ke-2 lolos, ke-3 ditolak BATAS_PESAN_AI:2', kedua.ok && !ketiga.ok && /BATAS_PESAN_AI:2/.test(ketiga.err ?? ''), ketiga.err ?? '');
  const jawaban = await coba(`insert into public.ai_pesan (percakapan_id, peran, isi) values ($1, 'model', 'jawaban')`, [pCeo]);
  cek('jawaban model tidak dihitung ke batas', jawaban.ok, jawaban.err ?? '');
  const sisa = (await q('select * from public.ai_status()')).rows[0];
  cek('ai_status() = aktif, boleh, (2, 2) -- jatah habis TAPI tetap "aktif"',
    sisa.aktif === true && sisa.boleh === true && sisa.batas === 2 && sisa.terpakai === 2, sisa);

  // Batas 0 / kunci hilang = BELUM DIAKTIFKAN, bukan "jatah habis".
  const statusTidakAktif = async (u) => { await sebagai(u); return (await q('select * from public.ai_status()')).rows[0]; };
  await sebagaiOwner();
  await q(`update public.policy set value = '0' where key = 'ai_batas_pesan_harian'`);
  const nol = await statusTidakAktif(manager);
  cek('batas 0 -> ai_status().aktif = false', nol.aktif === false, nol);
  await sebagai(manager);
  const batasNol = await coba(`insert into public.ai_pesan (percakapan_id, peran, isi) values ($1, 'user', 'x')`, [pMgr]);
  cek('batas 0 -> trigger menolak dengan AI_TIDAK_AKTIF, BUKAN BATAS_PESAN_AI', !batasNol.ok && /AI_TIDAK_AKTIF/.test(batasNol.err ?? '') && !/BATAS_PESAN_AI/.test(batasNol.err ?? ''), batasNol.err ?? '');

  await sebagaiOwner();
  await q(`delete from public.policy where key = 'ai_batas_pesan_harian'`);
  const tanpaBatas = await statusTidakAktif(manager);
  await sebagai(manager);
  const tanpaKunci = await coba(`insert into public.ai_pesan (percakapan_id, peran, isi) values ($1, 'user', 'x')`, [pMgr]);
  cek('kunci batas hilang -> tidak aktif + AI_TIDAK_AKTIF (tidak ada angka cadangan di kode)',
    tanpaBatas.aktif === false && !tanpaKunci.ok && /AI_TIDAK_AKTIF/.test(tanpaKunci.err ?? ''), { tanpaBatas, err: tanpaKunci.err });

  await sebagaiOwner();
  await q(`insert into public.policy (key, value) values ('ai_batas_pesan_harian', '30')`);
  await q(`delete from public.policy where key = 'ai_peran_boleh'`);
  const tanpaPeranKunci = await statusTidakAktif(manager);
  cek('kunci ai_peran_boleh hilang -> aktif = false (bukan cuma "tidak boleh")', tanpaPeranKunci.aktif === false && tanpaPeranKunci.boleh === false, tanpaPeranKunci);
  await sebagaiOwner();
  await q(`insert into public.policy (key, value) values ('ai_peran_boleh', '["ceo","kadiv","manager_resto"]')`);
  const pulih = await statusTidakAktif(manager);
  cek('kunci dikembalikan -> aktif lagi', pulih.aktif === true && pulih.boleh === true, pulih);

  // ─── Fungsi alat lokal ───────────────────────────────────────────────
  await sebagai(ceo);
  const terlalu = await coba(`select * from public.ai_status_laporan('2026-08-01', '2026-09-15')`);
  cek('ai_status_laporan menolak rentang > 31 hari', !terlalu.ok, terlalu.err ?? '');
  const statusCeo = await coba(`select * from public.ai_status_laporan('2026-09-21', '2026-09-27')`);
  cek('ai_status_laporan jalan untuk CEO', statusCeo.ok && statusCeo.rows.length > 0, statusCeo.err ?? statusCeo.rows.length);
  await sebagai(karyawan);
  const statusKaryawan = await coba(`select * from public.ai_status_laporan('2026-09-21', '2026-09-27')`);
  const namaKaryawan = (await q(`select nama from public.profile where id = $1`, [karyawan])).rows[0].nama;
  cek('ai_status_laporan untuk karyawan: cuma penugasannya sendiri (bukan "belum lapor" palsu milik orang lain)',
    statusKaryawan.ok && statusKaryawan.rows.every((r) => r.pic_nama === namaKaryawan),
    statusKaryawan.err ?? statusKaryawan.rows.map((r) => r.pic_nama));

  await sebagai(ceo);
  const presensiCeo = await coba(`select * from public.ai_presensi('2026-09-21', '2026-09-27')`);
  cek('ai_presensi jalan untuk CEO', presensiCeo.ok, presensiCeo.err ?? presensiCeo.rows.length);
  await sebagai(karyawan);
  const presensiKaryawan = await coba(`select * from public.ai_presensi('2026-09-21', '2026-09-27')`);
  cek('ai_presensi untuk karyawan tunduk RLS (maks dirinya sendiri)', presensiKaryawan.ok && presensiKaryawan.rows.length <= 1,
    presensiKaryawan.err ?? presensiKaryawan.rows.length);

  await sebagaiOwner();
  const outlet = (await q(`select id, nama from public.outlet where aktif order by nama limit 2`)).rows;
  await q(`delete from public.omzet_pos_harian where tanggal = '2020-01-01'`);
  await q(`insert into public.omzet_pos_harian (outlet_id, tanggal, jumlah_order, uang_diterima, penjualan_bersih, refund)
           values ($1, '2020-01-01', 3, 150000, 140000, 0), ($2, '2020-01-01', 5, 250000, 240000, 10000)`, [outlet[0].id, outlet[1].id]);
  await sebagai(ceo);
  const omzetCeo = (await q(`select * from public.ai_omzet_pos('2020-01-01', '2020-01-01')`)).rows;
  const total = omzetCeo.find((r) => r.tingkat === 'total');
  cek('ai_omzet_pos (CEO): baris per outlet + total dihitung Postgres (380000)',
    total && Number(total.penjualan_bersih) === 380000 && omzetCeo.filter((r) => r.tingkat === 'outlet').length === 2, omzetCeo);
  const satuOutlet = (await q(`select * from public.ai_omzet_pos('2020-01-01', '2020-01-01', $1)`, [outlet[0].nama])).rows;
  cek('ai_omzet_pos dengan filter outlet -> cuma outlet itu',
    satuOutlet.filter((r) => r.tingkat === 'outlet').map((r) => r.outlet).join() === outlet[0].nama, satuOutlet);
  await sebagai(manager);
  const omzetMgr = await coba(`select * from public.ai_omzet_pos('2020-01-01', '2020-01-01')`);
  cek('ai_omzet_pos (manager_resto): DITOLAK TIDAK_BERHAK, bukan nol baris yang terbaca "omzet nol"',
    !omzetMgr.ok && /TIDAK_BERHAK/.test(omzetMgr.err ?? ''), omzetMgr.err ?? omzetMgr.rows);
  await peranUji(tanpaPeran, ['accounting']);
  await sebagai(tanpaPeran);
  const omzetAkun = await coba(`select * from public.ai_omzet_pos('2020-01-01', '2020-01-01')`);
  cek('ai_omzet_pos (accounting): boleh', omzetAkun.ok && omzetAkun.rows.length > 0, omzetAkun.err ?? omzetAkun.rows.length);
  await peranUji(tanpaPeran, []);

  const cakupan = async (u) => { await sebagai(u); return (await q('select * from public.ai_cakupan()')).rows[0]; };
  const cCeo = await cakupan(ceo);
  const cMgr = await cakupan(manager);
  cek('ai_cakupan: CEO melihat semua laporan/presensi/omzet', cCeo.laporan_semua && cCeo.presensi_semua && cCeo.omzet_pos, cCeo);
  cek('ai_cakupan: manager_resto terbatas di ketiganya', !cMgr.laporan_semua && !cMgr.presensi_semua && !cMgr.omzet_pos, cMgr);

  await sebagaiAnon();
  const anon = await coba(`select public.boleh_pakai_ai()`);
  cek('anon tidak bisa memanggil fungsi asisten', !anon.ok, anon.err ?? '');
} catch (e) {
  cek('skrip selesai tanpa galat', false, e.message);
} finally {
  try { await q('rollback;'); } catch { /* koneksi mungkin sudah putus */ }
  await client.end();
}

let gagal = 0;
for (const h of hasil) {
  if (!h.lolos) gagal += 1;
  console.log(`${h.lolos ? 'LOLOS' : 'GAGAL'}  #${h.nomor} ${h.skenario}${h.lolos ? '' : `\n        -> ${h.mentah}`}`);
}
console.log(`\n${hasil.length - gagal}/${hasil.length} lolos. Semua perubahan di-ROLLBACK.`);
process.exit(gagal === 0 ? 0 : 1);
