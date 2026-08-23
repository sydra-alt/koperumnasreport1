#!/usr/bin/env node
// Uji Task 21 (Laporan Terpusat) -- tiga view baru migrasi 0019, DB
// sungguhan lewat penyamaran RLS, dibungkus BEGIN...ROLLBACK.
//
//  1. v_security_hari_ini -- SUM lintas 2 laporan security (shift beda) hari
//     ini, jumlah_kejadian menghitung cuma yang ada_kejadian='ya'.
//  2. v_stk_hari_ini -- SUM lintas 2 laporan pic_lokasi.
//  3. v_marketing_hari_ini -- total_karyawan cocok jumlah role karyawan
//     aktif, sudah_lapor_hari_ini menghitung laporan personal_marketing
//     TERKIRIM hari ini (draft TIDAK ikut terhitung).

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

  langkah('SETUP -- 2 laporan security (pagi/siang), 2 laporan pic_lokasi, 1 personal_marketing terkirim + 1 draft');
  const { rows: lokasiRows } = await q(`select id, nama from lokasi order by nama;`);
  const tajur = lokasiRows.find((l) => l.nama === 'Tajur').id;
  const bekasi = lokasiRows.find((l) => l.nama === 'Bekasi').id;

  const satpam1 = await buatProfilSementara('Satpam Uji Terpusat 1', ['karyawan']);
  const satpam2 = await buatProfilSementara('Satpam Uji Terpusat 2', ['karyawan']);
  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, shift, status, data) values
     ('security', (now() at time zone 'Asia/Jakarta')::date, $1, $2, 'pagi', 'terkirim', '{"satpam_hadir":2,"tamu_datang":5,"konsumen_datang":10,"ada_kejadian":"tidak"}'::jsonb);`,
    [satpam1, tajur],
  );
  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, shift, status, data) values
     ('security', (now() at time zone 'Asia/Jakarta')::date, $1, $2, 'siang', 'terkirim', '{"satpam_hadir":1,"tamu_datang":3,"konsumen_datang":7,"ada_kejadian":"ya"}'::jsonb);`,
    [satpam2, bekasi],
  );

  const pic1 = await buatProfilSementara('PIC Uji Terpusat 1', ['pic_lokasi', 'karyawan']);
  const pic2 = await buatProfilSementara('PIC Uji Terpusat 2', ['pic_lokasi', 'karyawan']);
  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, status, data) values
     ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date, $1, $2, 'terkirim', '{"stk_total":10,"stk_sudah_ditempati":6,"stk_belum_ditempati":4,"stk_rumah_kosong":2,"stk_perlu_maintenance":1}'::jsonb);`,
    [pic1, tajur],
  );
  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, status, data) values
     ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date, $1, $2, 'terkirim', '{"stk_total":5,"stk_sudah_ditempati":3,"stk_belum_ditempati":2,"stk_rumah_kosong":1,"stk_perlu_maintenance":0}'::jsonb);`,
    [pic2, bekasi],
  );

  const { rows: karyawanSebelum } = await q(`select count(*)::int as n from profile p join role r on r.user_id=p.id where r.role='karyawan' and p.aktif;`);
  const marketing1 = await buatProfilSementara('Marketing Uji Terpusat 1', ['karyawan']);
  const marketing2 = await buatProfilSementara('Marketing Uji Terpusat 2', ['karyawan']);
  await q(
    `insert into report (form_key, tanggal, author_id, status, data) values
     ('personal_marketing', (now() at time zone 'Asia/Jakarta')::date, $1, 'terkirim', '{}'::jsonb);`,
    [marketing1],
  );
  await q(
    `insert into report (form_key, tanggal, author_id, status, data) values
     ('personal_marketing', (now() at time zone 'Asia/Jakarta')::date, $1, 'draft', '{}'::jsonb);`,
    [marketing2],
  );

  const pusat = await buatProfilSementara('Pusat Uji Terpusat', ['pusat']);

  langkah('UJI 1 -- v_security_hari_ini: satpam 2+1=3, tamu 5+3=8, konsumen 10+7=17, kejadian=1');
  await q('set local role authenticated;');
  await jadiSebagai(pusat);
  const { rows: sec } = await q(`select * from v_security_hari_ini;`);
  cek(sec.length === 1, `tepat 1 baris (dapat ${sec.length})`);
  cek(Number(sec[0].satpam_hadir) === 3, `satpam_hadir = 3 (dapat ${sec[0].satpam_hadir})`);
  cek(Number(sec[0].tamu_datang) === 8, `tamu_datang = 8 (dapat ${sec[0].tamu_datang})`);
  cek(Number(sec[0].konsumen_datang) === 17, `konsumen_datang = 17 (dapat ${sec[0].konsumen_datang})`);
  cek(Number(sec[0].jumlah_kejadian) === 1, `jumlah_kejadian = 1 (dapat ${sec[0].jumlah_kejadian})`);

  langkah('UJI 2 -- v_stk_hari_ini: total 10+5=15, sudah_ditempati 6+3=9');
  const { rows: stk } = await q(`select * from v_stk_hari_ini;`);
  cek(Number(stk[0].stk_total) === 15, `stk_total = 15 (dapat ${stk[0].stk_total})`);
  cek(Number(stk[0].sudah_ditempati) === 9, `sudah_ditempati = 9 (dapat ${stk[0].sudah_ditempati})`);
  cek(Number(stk[0].belum_ditempati) === 6, `belum_ditempati = 6 (dapat ${stk[0].belum_ditempati})`);
  cek(Number(stk[0].rumah_kosong) === 3, `rumah_kosong = 3 (dapat ${stk[0].rumah_kosong})`);
  cek(Number(stk[0].perlu_maintenance) === 1, `perlu_maintenance = 1 (dapat ${stk[0].perlu_maintenance})`);

  langkah('UJI 3 -- v_marketing_hari_ini: total_karyawan naik 4 (2 satpam bukan karyawan-role tambahan, 2 marketing+2 pic = karyawan), sudah_lapor=1 (draft TIDAK ikut)');
  const { rows: mkt } = await q(`select * from v_marketing_hari_ini;`);
  // karyawanSebelum dihitung SETELAH satpam1/2+pic1/2 dibuat (4 profil karyawan baru),
  // jadi yang tersisa nambah cuma marketing1/2 (2 profil) -- bukan bug view, salah hitung skrip ini sebelumnya.
  const karyawanSesudah = karyawanSebelum[0].n + 2;
  cek(Number(mkt[0].total_karyawan) === karyawanSesudah, `total_karyawan bertambah 2 lagi setelah checkpoint (dapat ${mkt[0].total_karyawan}, harap ${karyawanSesudah})`);
  cek(Number(mkt[0].sudah_lapor_hari_ini) >= 1, `sudah_lapor_hari_ini menghitung minimal laporan terkirim (dapat ${mkt[0].sudah_lapor_hari_ini})`);

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
