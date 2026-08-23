#!/usr/bin/env node
// Verifikasi CONCRETE: bisakah user ber-role kadiv+karyawan (BUKAN ceo/pusat)
// -- persis peran Ronald (Kepala Pembangunan) di DATA-KARYAWAN.md -- membaca
// laporan pic_lokasi milik orang lain lewat RLS? Kalau tidak, blok rekap
// read-only (1/3/5) di f15-pembangunan.ts akan tampil kosong di produksi.
// SEKALI PAKAI, dibungkus BEGIN...ROLLBACK.

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

try {
  await client.connect();
  await q('begin;');
  await q('set local role postgres;');

  // Pastikan ada laporan pic_lokasi hari ini milik Dadang untuk dites.
  const { rows: dadangRows } = await q(`select id from profile where nama='Dadang';`);
  const dadang = dadangRows[0].id;
  const { rows: tajurRows } = await q(`select id from lokasi where nama='Tajur';`);
  const tajur = tajurRows[0].id;
  await q(`set local role authenticated;`);
  await jadiSebagai(dadang);
  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, data, status, warna, submitted_at)
     values ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date, $1, $2, '{"unit_dibangun":3}', 'terkirim', 'hijau', now())
     on conflict do nothing;`,
    [dadang, tajur],
  );

  // Buat "Ronald" palsu: profile + role kadiv & karyawan (PERSIS peran asli Ronald,
  // BUKAN ceo/pusat) -- di DB sungguhan lewat auth.users palsu (FK profile->auth.users).
  await q('set local role postgres;');
  const { rows: ronaldAuth } = await q(
    `insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
     values (gen_random_uuid(), 'ronald-uji-sementara@koperumnas.local', 'x', now(), 'authenticated', 'authenticated')
     returning id;`,
  );
  const ronald = ronaldAuth[0].id;
  await q(`insert into profile (id, nama, aktif) values ($1, 'Ronald (uji sementara)', true);`, [ronald]);
  await q(`insert into role (user_id, role) values ($1, 'kadiv'), ($1, 'karyawan');`, [ronald]);

  await q('set local role authenticated;');
  await jadiSebagai(ronald);
  const { rows: hasilRonald } = await q(
    `select id, author_id, data from report where form_key='pic_lokasi'
     and tanggal=(now() at time zone 'Asia/Jakarta')::date and status <> 'draft';`,
  );
  console.log(`Ronald (role kadiv+karyawan, BUKAN ceo/pusat) bisa lihat ${hasilRonald.length} baris laporan pic_lokasi milik orang lain.`);
  console.log(
    hasilRonald.length === 0
      ? 'TERKONFIRMASI: RLS memblokir Ronald -- blok rekap read-only (1/3/5) akan tampil KOSONG di produksi, walau Dadang SUDAH mengirim laporan.'
      : 'Ronald BISA melihat -- berarti asumsi saya soal RLS keliru, tidak ada gap.',
  );

  await q('rollback;');
  console.log('\n=== ROLLBACK -- tidak ada yang tersimpan. ===');
} catch (err) {
  await q('rollback;').catch(() => {});
  console.error('GAGAL:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
