#!/usr/bin/env node
// Uji tujuh fungsi baru migrasi 0020 (dulu view "..._hari_ini", diubah jadi
// fungsi bertanggal supaya Papan Kontrol & Laporan Terpusat bisa mundur).
// DB sungguhan, penyamaran RLS, BEGIN...ROLLBACK.
//
//  1. Tiap fungsi dipanggil TANPA parameter (default) -- harus sama seperti
//     hari ini (pola lama, dipakai form pembangunan sendiri & CEO dashboard).
//  2. Tiap fungsi dipanggil DENGAN tanggal KEMARIN eksplisit -- harus
//     menemukan laporan yang sengaja ditanam kemarin, BUKAN 0/kosong.
//  3. Dipanggil dengan tanggal HARI INI eksplisit setelah data kemarin ada --
//     harus TETAP 0/kosong (tidak ikut menghitung data kemarin).

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

  langkah('SETUP -- 1 laporan security KEMARIN, 1 laporan pic_lokasi KEMARIN, 1 laporan personal_marketing KEMARIN');
  const { rows: lokasiRows } = await q(`select id from lokasi where nama='Tajur';`);
  const tajur = lokasiRows[0].id;
  const satpam = await buatProfilSementara('Satpam Uji Mundur', ['karyawan']);
  const pic = await buatProfilSementara('PIC Uji Mundur', ['pic_lokasi', 'karyawan']);
  const marketing = await buatProfilSementara('Marketing Uji Mundur', ['karyawan']);
  const pusat = await buatProfilSementara('Pusat Uji Mundur', ['pusat']);

  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, shift, status, data) values
     ('security', (now() at time zone 'Asia/Jakarta')::date - 1, $1, $2, 'pagi', 'terkirim', '{"satpam_hadir":4,"tamu_datang":9,"konsumen_datang":2,"ada_kejadian":"tidak"}'::jsonb);`,
    [satpam, tajur],
  );
  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, status, data) values
     ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date - 1, $1, $2, 'terkirim', '{"unit_dibangun":7,"stk_total":3,"target_unit":9}'::jsonb);`,
    [pic, tajur],
  );
  await q(
    `insert into report (form_key, tanggal, author_id, status, data) values
     ('personal_marketing', (now() at time zone 'Asia/Jakarta')::date - 1, $1, 'terkirim', '{}'::jsonb);`,
    [marketing],
  );
  const { rows: asgRows } = await q(
    `insert into assignment (user_id, form_key, lokasi_id) values ($1, 'pic_lokasi', $2) returning id;`,
    [pic, tajur],
  );

  await q('set local role authenticated;');
  await jadiSebagai(pusat);

  langkah('UJI 1 -- default (tanpa parameter) TIDAK ikut menghitung data kemarin (harus 0, bukan menemukan data)');
  const { rows: secDefault } = await q(`select * from security_untuk_tanggal();`);
  cek(Number(secDefault[0].satpam_hadir ?? 0) === 0, `security_untuk_tanggal() default = 0 (dapat ${secDefault[0].satpam_hadir})`);
  const { rows: pembDefault } = await q(`select * from pembangunan_untuk_tanggal();`);
  cek(Number(pembDefault[0].sedang_dibangun ?? 0) === 0, `pembangunan_untuk_tanggal() default = 0 (dapat ${pembDefault[0].sedang_dibangun})`);

  langkah('UJI 2 -- dipanggil dengan tanggal KEMARIN eksplisit -- harus menemukan data yang ditanam');
  const { rows: secKemarin } = await q(
    `select * from security_untuk_tanggal(((now() at time zone 'Asia/Jakarta')::date - 1));`,
  );
  cek(Number(secKemarin[0].satpam_hadir) === 4, `security_untuk_tanggal(kemarin).satpam_hadir = 4 (dapat ${secKemarin[0].satpam_hadir})`);

  const { rows: stkKemarin } = await q(
    `select * from stk_untuk_tanggal(((now() at time zone 'Asia/Jakarta')::date - 1));`,
  );
  cek(Number(stkKemarin[0].stk_total) === 3, `stk_untuk_tanggal(kemarin).stk_total = 3 (dapat ${stkKemarin[0].stk_total})`);

  const { rows: pembKemarin } = await q(
    `select * from pembangunan_untuk_tanggal(((now() at time zone 'Asia/Jakarta')::date - 1));`,
  );
  cek(Number(pembKemarin[0].sedang_dibangun) === 7, `pembangunan_untuk_tanggal(kemarin).sedang_dibangun = 7 (dapat ${pembKemarin[0].sedang_dibangun})`);

  const { rows: pplKemarin } = await q(
    `select * from pembangunan_per_lokasi_untuk_tanggal(((now() at time zone 'Asia/Jakarta')::date - 1));`,
  );
  cek(pplKemarin.length === 1 && Number(pplKemarin[0].target) === 9, `pembangunan_per_lokasi_untuk_tanggal(kemarin) -- target = 9 (dapat ${pplKemarin[0]?.target})`);

  const { rows: mktKemarin } = await q(
    `select * from marketing_untuk_tanggal(((now() at time zone 'Asia/Jakarta')::date - 1));`,
  );
  cek(Number(mktKemarin[0].sudah_lapor_hari_ini) >= 1, `marketing_untuk_tanggal(kemarin).sudah_lapor_hari_ini >= 1 (dapat ${mktKemarin[0].sudah_lapor_hari_ini})`);

  const { rows: papanKemarin } = await q(
    `select * from papan_untuk_tanggal(((now() at time zone 'Asia/Jakarta')::date - 1)) where assignment_id = $1;`,
    [asgRows[0].id],
  );
  cek(papanKemarin.length === 1 && papanKemarin[0].report_id !== null, 'papan_untuk_tanggal(kemarin) menemukan laporan PIC yang ditanam kemarin');

  langkah('UJI 3 -- dipanggil dengan tanggal HARI INI eksplisit -- TETAP 0/kosong, tidak tertukar dengan data kemarin');
  const { rows: secHariIni } = await q(`select * from security_untuk_tanggal((now() at time zone 'Asia/Jakarta')::date);`);
  cek(Number(secHariIni[0].satpam_hadir ?? 0) === 0, `security_untuk_tanggal(hari ini) = 0 (dapat ${secHariIni[0].satpam_hadir})`);
  const { rows: papanHariIni } = await q(
    `select * from papan_untuk_tanggal((now() at time zone 'Asia/Jakarta')::date) where assignment_id = $1;`,
    [asgRows[0].id],
  );
  cek(papanHariIni[0].report_id === null, 'papan_untuk_tanggal(hari ini) TIDAK ikut menemukan laporan kemarin -- report_id null');

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
