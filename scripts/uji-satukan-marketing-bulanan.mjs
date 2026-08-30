#!/usr/bin/env node
// Bukti eksplisit yang diminta user (30 Agustus 2026) setelah menyatukan
// rumus marketing bulanan (migrasi 0024): `v_marketing_bulanan` (dipakai
// dashboard Marketing) dan `marketing_bulanan_untuk()` (dipakai ekspor)
// HARUS identik baris per baris untuk bulan berjalan -- bukan cuma "sudah
// disatukan menurut kode", diverifikasi lewat data sungguhan.
//
// Sekaligus menguji sebagai PERSONA sungguhan (kontrol_marketing, lewat
// penyamaran RLS -- studi kasus DATABASE, bukan HTTP, konsisten dengan
// instruksi user "penyamaran JWT tetap dipakai kalau memang perlu menguji
// lapisan database") supaya perbandingannya representasi apa yang benar-
// benar dilihat dashboard/ekspor, bukan pandangan pemilik tabel yang
// melihat segalanya.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });

try {
  await client.connect();
  await client.query('begin;');

  await client.query(`
    do $$
    declare id_fauzy uuid := (select id from auth.users where email='fauzy@koperumnas.local');
    begin
      perform set_config('uji.id_fauzy', id_fauzy::text, true);
    end $$;
  `);
  await client.query(`select set_config('role', 'authenticated', true);`);
  await client.query(`select set_config('request.jwt.claims', json_build_object('sub', current_setting('uji.id_fauzy'), 'role','authenticated')::text, true);`);
  const siapa = (await client.query('select auth.uid() as s;')).rows[0].s;
  console.log('Menyamar sebagai Fauzy (kontrol_marketing), auth.uid() =', siapa);

  const [dariView, dariFungsi] = await Promise.all([
    client.query(`select user_id, nama, bulan, pte_berlaku, hari_wajib, hari_lengkap, hari_bolong, undangan, closing from v_marketing_bulanan order by user_id;`),
    client.query(`select user_id, nama, bulan, pte_berlaku, hari_wajib, hari_lengkap, hari_bolong, undangan, closing from marketing_bulanan_untuk() order by user_id;`),
  ]);

  console.log(`\nv_marketing_bulanan: ${dariView.rows.length} baris`);
  console.log(`marketing_bulanan_untuk(): ${dariFungsi.rows.length} baris`);

  let semuaSama = dariView.rows.length === dariFungsi.rows.length;
  const beda = [];
  for (let i = 0; i < Math.min(dariView.rows.length, dariFungsi.rows.length); i++) {
    const a = JSON.stringify(dariView.rows[i]);
    const b = JSON.stringify(dariFungsi.rows[i]);
    if (a !== b) {
      semuaSama = false;
      beda.push({ baris: i, view: a, fungsi: b });
    }
  }

  if (beda.length > 0) {
    console.log('\nBaris yang BERBEDA:');
    console.table(beda);
  }

  console.log(semuaSama ? '\n✅ IDENTIK baris per baris, kolom per kolom -- rumus benar-benar satu sumber sekarang.' : '\n🛑 ADA PERBEDAAN -- rumus belum benar-benar satu.');
  process.exitCode = semuaSama ? 0 : 1;
} catch (err) {
  console.error('ERROR:', err.message);
  process.exitCode = 1;
} finally {
  await client.query('rollback;').catch(() => {});
  await client.end();
}
