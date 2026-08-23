#!/usr/bin/env node
// Uji Task 19 (Antrean Keputusan CEO), DB sungguhan lewat penyamaran RLS,
// dibungkus BEGIN...ROLLBACK.
//
//  1. Pusat TIDAK bisa lihat decision yang lahir dari laporan `accounting`
//     (perbaikan migrasi 0016) -- tapi TETAP bisa lihat decision dari form lain.
//  2. Pusat coba `update decision set status='disetujui'` -- ditolak database.
//  3. CEO memutuskan (Setujui) -- decided_by/decided_at/keputusan_catatan
//     terisi benar, baris pindah dari "menunggu" ke "riwayat".
//  4. Urutan antrean: urgensi 1 sebelum urgensi 2 (decision_antrean_idx).

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

  langkah('SETUP -- laporan accounting + laporan hrd, masing-masing dengan 1 decision');
  const akuntan = await buatProfilSementara('Akuntan Uji Keputusan', ['accounting', 'karyawan']);
  const hrd = await buatProfilSementara('HRD Uji Keputusan', ['karyawan']);
  const ceo = await buatProfilSementara('CEO Uji Keputusan', ['ceo']);
  const pusat = await buatProfilSementara('Pusat Uji Keputusan', ['pusat']);

  const { rows: rAcc } = await q(
    `insert into report (form_key, tanggal, author_id, status) values ('accounting', (now() at time zone 'Asia/Jakarta')::date, $1, 'terkirim') returning id;`,
    [akuntan],
  );
  const { rows: decAcc } = await q(
    `insert into decision (report_id, judul, nominal, urgensi) values ($1, 'RAHASIA -- bayar kontraktor X', 75000000, 1) returning id;`,
    [rAcc[0].id],
  );

  const { rows: rHrd } = await q(
    `insert into report (form_key, tanggal, author_id, status) values ('hrd', (now() at time zone 'Asia/Jakarta')::date, $1, 'terkirim') returning id;`,
    [hrd],
  );
  const { rows: decHrd } = await q(
    `insert into decision (report_id, judul, nominal, urgensi) values ($1, 'Butuh approval cuti massal', 0, 2) returning id;`,
    [rHrd[0].id],
  );
  console.log(`decision accounting=${decAcc[0].id}  decision hrd=${decHrd[0].id}`);

  langkah('UJI 1 -- Pusat TIDAK lihat decision accounting, TAPI lihat decision hrd (migrasi 0016)');
  await q('set local role authenticated;');
  await jadiSebagai(pusat);
  const { rows: terlihatPusat } = await q(`select id, judul from decision where status='menunggu' order by urgensi;`);
  const idTerlihat = terlihatPusat.map((r) => r.id);
  cek(!idTerlihat.includes(decAcc[0].id), 'decision accounting TIDAK muncul untuk Pusat');
  cek(idTerlihat.includes(decHrd[0].id), 'decision hrd TETAP muncul untuk Pusat');
  cek(terlihatPusat.every((r) => !/RAHASIA/.test(r.judul)), 'tidak ada judul accounting yang bocor ke hasil query Pusat');

  langkah('UJI 2 -- CEO TETAP lihat keduanya (termasuk accounting)');
  await jadiSebagai(ceo);
  const { rows: terlihatCeo } = await q(`select id from decision where status='menunggu';`);
  const idTerlihatCeo = terlihatCeo.map((r) => r.id);
  cek(idTerlihatCeo.includes(decAcc[0].id) && idTerlihatCeo.includes(decHrd[0].id), 'CEO melihat KEDUA decision');

  langkah('UJI 3 -- urutan antrean: urgensi 1 (accounting) sebelum urgensi 2 (hrd), utk CEO');
  const { rows: urut } = await q(`select id, urgensi from decision where id in ($1,$2) order by urgensi, deadline nulls last;`, [
    decAcc[0].id,
    decHrd[0].id,
  ]);
  cek(urut[0].id === decAcc[0].id && urut[0].urgensi === 1, 'urgensi 1 (accounting) muncul lebih dulu');

  langkah('UJI 4 -- Pusat coba update status -- ditolak database');
  await jadiSebagai(pusat);
  await q('savepoint sebelum_update_pusat;');
  const { rowCount } = await q(`update decision set status='disetujui' where id=$1 returning id;`, [decHrd[0].id]);
  cek(rowCount === 0, `update dari Pusat tidak mengubah baris apa pun (rowCount=${rowCount})`);
  await q('rollback to savepoint sebelum_update_pusat;');

  langkah('UJI 5 -- CEO memutuskan (Setujui) decision hrd -- decided_by/decided_at/catatan terisi');
  await jadiSebagai(ceo);
  await q(
    `update decision set status='disetujui', keputusan_catatan='Sudah dicek, oke.', decided_by=$1, decided_at=now() where id=$2;`,
    [ceo, decHrd[0].id],
  );
  const { rows: hasil } = await q(`select status, decided_by, decided_at, keputusan_catatan from decision where id=$1;`, [decHrd[0].id]);
  cek(hasil[0].status === 'disetujui', 'status berubah jadi disetujui');
  cek(hasil[0].decided_by === ceo, 'decided_by = CEO yang memutuskan');
  cek(hasil[0].decided_at !== null, 'decided_at terisi');
  cek(hasil[0].keputusan_catatan === 'Sudah dicek, oke.', 'catatan tersimpan');

  await jadiSebagai(pusat);
  const { rows: riwayatPusat } = await q(`select id from decision where status <> 'menunggu';`);
  cek(
    riwayatPusat.some((r) => r.id === decHrd[0].id),
    'decision hrd yang sudah diputuskan muncul di riwayat Pusat',
  );

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
