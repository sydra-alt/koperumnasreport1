#!/usr/bin/env node
// Uji opsi (d) -- 04-CATATAN-TEKNIS.md §3.4b: view agregat security-definer
// dengan penjaga boleh_lihat_rekap(), BUKAN pelebaran can_see_report().
// SEKALI PAKAI, dibungkus BEGIN...ROLLBACK -- tidak ada yang tersimpan.
//
// Tiga uji diminta user, dicetak MENTAH (bukan cuma OK/SALAH):
//   1. Profil persis Ronald (kadiv+karyawan, assignment form_key='pembangunan')
//      -> select dari v_pembangunan_per_lokasi harus TERISI.
//   2. Toyib (karyawan polos, tanpa assignment apa pun) -> view 0 baris.
//   3. Ronald -> select LANGSUNG ke report where form_key='pic_lokasi' TETAP
//      0 baris (dia dapat angkanya lewat view, bukan baris laporannya).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
function q(sql, params) { return client.query(sql, params); }
async function jadiSebagai(uuid) {
  await q(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, true);`, [uuid]);
  const r = await q('select auth.uid() as siapa;');
  if (r.rows[0].siapa !== uuid) throw new Error('Penyamaran gagal');
  return r.rows[0].siapa;
}
function langkah(j) { console.log(`\n════ ${j} ════`); }

try {
  await client.connect();
  await q('begin;');
  await q('set local role postgres;');

  langkah('SETUP — Dadang (pic_lokasi/Tajur) kirim laporan lengkap unit+material+infra');
  const { rows: dadangRows } = await q(`select id from profile where nama='Dadang';`);
  const { rows: toyibRows } = await q(`select id from profile where nama='Toyib';`);
  const dadang = dadangRows[0].id;
  const toyib = toyibRows[0].id;
  const { rows: tajurRows } = await q(`select id from lokasi where nama='Tajur';`);
  const tajur = tajurRows[0].id;

  await q('set local role authenticated;');
  await jadiSebagai(dadang);
  const dataDikirim = {
    target_unit: 10, unit_dibangun: 4, unit_finishing: 2, unit_selesai: 1, unit_belum_mulai: 3,
    material_cukup: 'tidak',
    material_kurang: [{ material: 'Semen', kebutuhan: '50 sak' }, { material: 'Pasir', kebutuhan: '2 truk' }],
    kiriman_precast_jumlah: 12,
    kiriman_kekurangan: 'RAHASIA -- catatan bebas Dadang, tidak boleh bocor ke Ronald',
    jalan_status: 'Rusak', listrik_status: 'Proses', air_status: 'Sudah',
    drainase_baik: 'tidak', penerangan_baik: 'ya', gerbang_baik: 'ya',
    infrastruktur_kebutuhan: 'RAHASIA -- observasi bebas Dadang, tidak boleh bocor ke Ronald',
    keluhan_konsumen: 3,
    keperluan_konsumen: 'RAHASIA -- keperluan konsumen, tidak ada urusannya dengan Ronald',
  };
  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, data, status, warna, submitted_at)
     values ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date, $1, $2, $3, 'terkirim', 'hijau', now());`,
    [dadang, tajur, JSON.stringify(dataDikirim)],
  );
  console.log('Laporan Dadang terkirim (Tajur, dengan field "RAHASIA" sengaja disisipkan utk uji kebocoran).');

  langkah('SETUP — buat profil "Ronald" persis: role kadiv+karyawan (BUKAN ceo/pusat), assignment form_key=\'pembangunan\'');
  await q('set local role postgres;');
  const { rows: ronaldAuth } = await q(
    `insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
     values (gen_random_uuid(), 'ronald-uji-sementara@koperumnas.local', 'x', now(), 'authenticated', 'authenticated')
     returning id;`,
  );
  const ronald = ronaldAuth[0].id;
  await q(`insert into profile (id, nama, aktif) values ($1, 'Ronald (uji sementara)', true);`, [ronald]);
  await q(`insert into role (user_id, role) values ($1, 'kadiv'), ($1, 'karyawan');`, [ronald]);
  await q(`insert into assignment (user_id, form_key) values ($1, 'pembangunan');`, [ronald]);
  console.log(`Ronald dibuat: ${ronald}, role=[kadiv,karyawan], assignment=[pembangunan]`);

  langkah('UJI 1 — sebagai Ronald, SELECT * FROM v_pembangunan_per_lokasi (RAW OUTPUT)');
  await q('set local role authenticated;');
  await jadiSebagai(ronald);
  const { rows: hasil1 } = await q(`select * from v_pembangunan_per_lokasi;`);
  console.log(JSON.stringify(hasil1, null, 2));
  console.log(`--> ${hasil1.length} baris.`);
  const bocor = JSON.stringify(hasil1).includes('RAHASIA');
  console.log(bocor ? '¡¡¡ BOCOR: field RAHASIA ikut terbawa !!!' : 'Tidak ada field "RAHASIA" yang bocor lewat view.');

  langkah('UJI 2 — sebagai Toyib (karyawan polos, TANPA assignment apa pun), SELECT * FROM v_pembangunan_per_lokasi (RAW OUTPUT)');
  await jadiSebagai(toyib);
  const { rows: hasil2 } = await q(`select * from v_pembangunan_per_lokasi;`);
  console.log(JSON.stringify(hasil2, null, 2));
  console.log(`--> ${hasil2.length} baris.`);

  langkah('UJI 3 — sebagai Ronald, SELECT langsung ke report WHERE form_key=\'pic_lokasi\' (RAW OUTPUT)');
  await jadiSebagai(ronald);
  const { rows: hasil3 } = await q(
    `select id, author_id, data from report where form_key='pic_lokasi' and tanggal=(now() at time zone 'Asia/Jakarta')::date and status <> 'draft';`,
  );
  console.log(JSON.stringify(hasil3, null, 2));
  console.log(`--> ${hasil3.length} baris.`);

  langkah('RINGKASAN');
  console.log(`UJI 1 (Ronald lewat view)         : ${hasil1.length} baris, harap TERISI (>0)  -> ${hasil1.length > 0 ? 'LOLOS' : 'GAGAL'}`);
  console.log(`     tidak ada kebocoran RAHASIA   : ${!bocor ? 'LOLOS' : 'GAGAL'}`);
  console.log(`UJI 2 (Toyib lewat view)           : ${hasil2.length} baris, harap 0            -> ${hasil2.length === 0 ? 'LOLOS' : 'GAGAL'}`);
  console.log(`UJI 3 (Ronald langsung ke report)  : ${hasil3.length} baris, harap 0            -> ${hasil3.length === 0 ? 'LOLOS' : 'GAGAL'}`);

  await q('rollback;');
  console.log('\n=== ROLLBACK -- tidak ada yang tersimpan. ===');
} catch (err) {
  await q('rollback;').catch(() => {});
  console.error('GAGAL:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
