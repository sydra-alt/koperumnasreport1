#!/usr/bin/env node
// Uji Task 22 (Dashboard Kontrol Marketing) -- bukan view baru (v_marketing_bulanan
// sudah diuji Task 15), tapi DUA query BARU yang dipakai halaman ini: pte_daily
// SIAPA PUN (kalender per karyawan) dan v_marketing_bulanan SEMUA baris (bukan
// cuma milik sendiri). Uji fokus ke BATAS RLS-nya, DB sungguhan, BEGIN...ROLLBACK.
//
//  1. kontrol_marketing bisa baca v_marketing_bulanan MILIK ORANG LAIN (bukan cuma dirinya).
//  2. kontrol_marketing bisa baca pte_daily MILIK ORANG LAIN (utk kalender).
//  3. Karyawan BIASA (bukan kontrol_marketing/ceo/pusat/manager_resto) TIDAK
//     bisa baca pte_daily milik orang lain -- cuma baris dirinya sendiri.

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
async function buatProfilSementara(nama, roles) {
  const { rows } = await q(
    `insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
     values (gen_random_uuid(), $1, 'x', now(), 'authenticated', 'authenticated') returning id;`,
    [`${nama.toLowerCase().replace(/\s+/g, '-')}-uji-sementara@koperumnas.local`],
  );
  const id = rows[0].id;
  await q(`insert into profile (id, nama, aktif) values ($1, $2, true);`, [id, `${nama} (uji sementara)`]);
  for (const role of roles) await q(`insert into role (user_id, role) values ($1, $2);`, [id, role]);
  return id;
}
function langkah(j) { console.log(`\n════ ${j} ════`); }
function cek(kondisi, pesan) {
  console.log((kondisi ? 'OK: ' : 'SALAH: ') + pesan);
  if (!kondisi) process.exitCode = 1;
}

try {
  await client.connect();
  await q('begin;');
  await q('set local role postgres;');

  langkah('SETUP -- 2 karyawan biasa dengan pte_daily hari ini, 1 kontrol_marketing, 1 karyawan polos pengamat');
  const marketing1 = await buatProfilSementara('Marketing Uji Dashboard 1', ['karyawan']);
  const marketing2 = await buatProfilSementara('Marketing Uji Dashboard 2', ['karyawan']);
  await q(`insert into pte_daily (user_id, tanggal, live, undang_jumlah, kesaksian_jumlah, review_jumlah, konten_jumlah, mentahan_jumlah)
           values ($1, (now() at time zone 'Asia/Jakarta')::date, true, 5, 1, 1, 3, 1);`, [marketing1]);
  await q(`insert into pte_daily (user_id, tanggal, live, undang_jumlah, kesaksian_jumlah, review_jumlah, konten_jumlah, mentahan_jumlah)
           values ($1, (now() at time zone 'Asia/Jakarta')::date, true, 8, 1, 1, 3, 1);`, [marketing2]);

  const kontrolMarketing = await buatProfilSementara('Kontrol Marketing Uji Dashboard', ['kontrol_marketing', 'karyawan']);
  const karyawanPolos = await buatProfilSementara('Karyawan Polos Dashboard 2', ['karyawan']);

  langkah('UJI 1 -- kontrol_marketing lihat v_marketing_bulanan MILIK ORANG LAIN (bukan cuma dirinya)');
  await q('set local role authenticated;');
  await jadiSebagai(kontrolMarketing);
  const { rows: bulananLain } = await q(`select user_id, undangan from v_marketing_bulanan where user_id in ($1, $2);`, [marketing1, marketing2]);
  cek(bulananLain.length === 2, `kontrol_marketing melihat KEDUA baris orang lain (dapat ${bulananLain.length})`);

  langkah('UJI 2 -- kontrol_marketing lihat pte_daily MILIK ORANG LAIN (utk kalender detail)');
  const { rows: pteLain } = await q(`select user_id, undang_jumlah from pte_daily where user_id in ($1, $2) and tanggal = (now() at time zone 'Asia/Jakarta')::date;`, [
    marketing1,
    marketing2,
  ]);
  cek(pteLain.length === 2, `kontrol_marketing melihat KEDUA baris pte_daily orang lain (dapat ${pteLain.length})`);
  cek(
    pteLain.find((r) => r.user_id === marketing1)?.undang_jumlah === 5 && pteLain.find((r) => r.user_id === marketing2)?.undang_jumlah === 8,
    'angka pte_daily per orang benar (tidak tertukar)',
  );

  langkah('UJI 3 -- karyawan BIASA (bukan kontrol_marketing/ceo/pusat) TIDAK bisa baca pte_daily orang lain');
  await jadiSebagai(karyawanPolos);
  const { rows: pteSebagaiPolos } = await q(`select user_id from pte_daily where user_id in ($1, $2) and tanggal = (now() at time zone 'Asia/Jakarta')::date;`, [
    marketing1,
    marketing2,
  ]);
  cek(pteSebagaiPolos.length === 0, `karyawan polos 0 baris pte_daily orang lain (dapat ${pteSebagaiPolos.length})`);

  await q('set local role postgres;');
  await q('rollback;');
  const { rows: sisa } = await q(`select count(*)::int as n from profile where nama like '%(uji sementara)%';`);
  cek(sisa[0].n === 0, 'ROLLBACK bersih -- 0 profil uji sementara tersisa');

  console.log(process.exitCode ? '\n❌ ADA YANG GAGAL' : '\n✅ SEMUA LOLOS');
} catch (err) {
  console.error('ERROR:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
