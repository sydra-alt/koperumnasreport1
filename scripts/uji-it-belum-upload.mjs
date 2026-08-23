#!/usr/bin/env node
// Uji v_pic_lokasi_belum_upload_progress (migrasi 0012, Task 14 §7 + D2).
// SEKALI PAKAI, dibungkus BEGIN...ROLLBACK.
//
// Skenario: Dadang PIC 2 lokasi sementara (Tajur + Bekasi). Tajur kirim
// laporan pic_lokasi LENGKAP dengan attachment field_key='progress' (sudah
// upload). Bekasi kirim laporan TANPA attachment (belum upload).
//   1. Sebagai "Diki" (persis IT: role kadiv+karyawan, assignment
//      form_key='it') -> view harus mengembalikan Bekasi SAJA (bukan Tajur).
//   2. Sebagai Toyib (tanpa assignment 'it' apa pun) -> view 0 baris.

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
}
function langkah(j) { console.log(`\n════ ${j} ════`); }

try {
  await client.connect();
  await q('begin;');
  await q('set local role postgres;');

  langkah('SETUP — Dadang PIC 2 lokasi sementara (Tajur + Bekasi)');
  const { rows: dadangRows } = await q(`select id from profile where nama='Dadang';`);
  const { rows: toyibRows } = await q(`select id from profile where nama='Toyib';`);
  const dadang = dadangRows[0].id;
  const toyib = toyibRows[0].id;
  const { rows: lokasiRows } = await q(`select id, nama from lokasi where nama in ('Tajur','Bekasi') order by nama;`);
  const tajur = lokasiRows.find((l) => l.nama === 'Tajur').id;
  const bekasi = lokasiRows.find((l) => l.nama === 'Bekasi').id;
  await q(`insert into assignment (user_id, form_key, lokasi_id) values ($1,'pic_lokasi',$2) on conflict do nothing;`, [dadang, bekasi]);

  await q('set local role authenticated;');
  await jadiSebagai(dadang);
  const { rows: rTajur } = await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, data, status, warna, submitted_at)
     values ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date, $1, $2, '{"unit_dibangun":1}', 'terkirim', 'hijau', now())
     returning id;`,
    [dadang, tajur],
  );
  await q(`insert into attachment (report_id, field_key, path, mime, bytes) values ($1, 'progress', 'bukti/dummy.jpg', 'image/jpeg', 100);`, [rTajur[0].id]);
  console.log('Tajur: laporan + attachment "progress" terkirim (SUDAH upload).');

  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, data, status, warna, submitted_at)
     values ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date, $1, $2, '{"unit_dibangun":1}', 'terkirim', 'hijau', now());`,
    [dadang, bekasi],
  );
  console.log('Bekasi: laporan terkirim TANPA attachment (BELUM upload).');

  langkah('SETUP — buat profil "Diki" persis IT: role kadiv+karyawan, assignment form_key=\'it\'');
  await q('set local role postgres;');
  const { rows: dikiAuth } = await q(
    `insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
     values (gen_random_uuid(), 'diki-uji-sementara@koperumnas.local', 'x', now(), 'authenticated', 'authenticated')
     returning id;`,
  );
  const diki = dikiAuth[0].id;
  await q(`insert into profile (id, nama, aktif) values ($1, 'Diki (uji sementara)', true);`, [diki]);
  await q(`insert into role (user_id, role) values ($1,'kadiv'), ($1,'karyawan');`, [diki]);
  await q(`insert into assignment (user_id, form_key) values ($1,'it');`, [diki]);
  console.log(`Diki dibuat: ${diki}`);

  langkah('UJI 1 — sebagai Diki, SELECT * FROM v_pic_lokasi_belum_upload_progress (RAW OUTPUT)');
  await q('set local role authenticated;');
  await jadiSebagai(diki);
  const { rows: hasil1 } = await q(`select lokasi from v_pic_lokasi_belum_upload_progress order by lokasi;`);
  console.log(JSON.stringify(hasil1, null, 2));
  const benar = hasil1.length === 1 && hasil1[0].lokasi === 'Bekasi';
  console.log(benar ? 'OK: cuma Bekasi (belum upload) yang muncul, Tajur (sudah upload) tidak.' : 'SALAH.');

  langkah('UJI 2 — sebagai Toyib (tanpa assignment \'it\'), SELECT * FROM view yang sama (RAW OUTPUT)');
  await jadiSebagai(toyib);
  const { rows: hasil2 } = await q(`select lokasi from v_pic_lokasi_belum_upload_progress;`);
  console.log(JSON.stringify(hasil2, null, 2));
  console.log(hasil2.length === 0 ? 'OK: Toyib dapat 0 baris.' : 'SALAH.');

  await q('rollback;');
  console.log('\n=== ROLLBACK -- tidak ada yang tersimpan. ===');
} catch (err) {
  await q('rollback;').catch(() => {});
  console.error('GAGAL:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
