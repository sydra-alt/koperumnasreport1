#!/usr/bin/env node
// Uji Task 20 (view agregasi + dashboard CEO), DB sungguhan lewat penyamaran
// RLS, dibungkus BEGIN...ROLLBACK.
//
//  1. v_pembangunan_hari_ini -- 1 baris SELALU ada (sum tanpa GROUP BY),
//     angka benar dari 2 laporan pic_lokasi hari ini.
//  2. v_keuangan_rekap -- Pusat (TANPA akses baris ke accounting) tetap
//     dapat 4 angka; karyawan biasa (bukan ceo/pusat/accounting) 0 baris;
//     kolom PERSIS 5 (tanggal/total_masuk/total_keluar/net/warna), tidak ada
//     saldo bank/piutang/apa pun lain bocor lewat view ini.
//  3. selisih_resto_untuk_tanggal() -- outlet dengan KEDUA laporan
//     (manager_resto + kontrol_fnb, dulu "ita" sebelum dipecah migrasi 0036)
//     hari ini tampil dengan selisih benar; outlet dengan cuma SATU laporan
//     tidak tampil sama sekali.

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

  langkah('SETUP -- 2 laporan pic_lokasi, 1 laporan accounting, manager_resto+ita utk 1 outlet');
  const { rows: lokasiRows } = await q(`select id, nama from lokasi order by nama;`);
  const tajur = lokasiRows.find((l) => l.nama === 'Tajur').id;
  const bekasi = lokasiRows.find((l) => l.nama === 'Bekasi').id;
  const { rows: outletRows } = await q(`select id, nama, slug from outlet order by nama;`);
  const outletCempaka = outletRows.find((o) => o.slug === 'indosteak_cempaka');
  const indosteak = outletCempaka.id;

  const pic1 = await buatProfilSementara('PIC Uji Dashboard 1', ['pic_lokasi', 'karyawan']);
  const pic2 = await buatProfilSementara('PIC Uji Dashboard 2', ['pic_lokasi', 'karyawan']);
  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, status, data) values
     ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date, $1, $2, 'terkirim', '{"unit_dibangun":3,"unit_finishing":1,"unit_selesai":0,"unit_belum_mulai":2}'::jsonb);`,
    [pic1, tajur],
  );
  await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, status, data) values
     ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date, $1, $2, 'terkirim', '{"unit_dibangun":5,"unit_finishing":2,"unit_selesai":1,"unit_belum_mulai":0}'::jsonb);`,
    [pic2, bekasi],
  );

  const akuntan = await buatProfilSementara('Akuntan Uji Dashboard', ['accounting', 'karyawan']);
  await q(
    `insert into report (form_key, tanggal, author_id, status, data) values
     ('accounting', (now() at time zone 'Asia/Jakarta')::date, $1, 'terkirim', '{"total_masuk":10000000,"total_keluar":4000000,"saldo_rahasia":"RAHASIA -- jangan bocor ke Pusat"}'::jsonb);`,
    [akuntan],
  );

  const managerIndosteak = await buatProfilSementara('Manager Indosteak Uji Dashboard', ['karyawan']);
  await q(
    `insert into report (form_key, tanggal, author_id, outlet_id, status, data) values
     ('manager_resto', (now() at time zone 'Asia/Jakarta')::date, $1, $2, 'terkirim', '{"total_omzet":5000000}'::jsonb);`,
    [managerIndosteak, indosteak],
  );
  const ita = await buatProfilSementara('Ita Uji Dashboard', ['karyawan']);
  await q(
    `insert into report (form_key, tanggal, author_id, outlet_id, status, data) values
     ('kontrol_fnb', (now() at time zone 'Asia/Jakarta')::date, $1, $2, 'terkirim', jsonb_build_object('omzet_sistem', 4800000));`,
    [ita, outletCempaka.id],
  );

  const pusat = await buatProfilSementara('Pusat Uji Dashboard', ['pusat']);
  const karyawanPolos = await buatProfilSementara('Karyawan Polos Dashboard', ['karyawan']);

  langkah('UJI 1 -- v_pembangunan_hari_ini: 1 baris, angka benar (3+5, 1+2, 0+1, 2+0)');
  await q('set local role authenticated;');
  await jadiSebagai(pusat);
  const { rows: pemb } = await q(`select * from v_pembangunan_hari_ini;`);
  cek(pemb.length === 1, `tepat 1 baris (dapat ${pemb.length})`);
  cek(Number(pemb[0].sedang_dibangun) === 8, `sedang_dibangun = 8 (dapat ${pemb[0].sedang_dibangun})`);
  cek(Number(pemb[0].finishing) === 3, `finishing = 3 (dapat ${pemb[0].finishing})`);
  cek(Number(pemb[0].selesai_hari_ini) === 1, `selesai_hari_ini = 1 (dapat ${pemb[0].selesai_hari_ini})`);
  cek(Number(pemb[0].belum_mulai) === 2, `belum_mulai = 2 (dapat ${pemb[0].belum_mulai})`);

  langkah('UJI 2 -- v_keuangan_rekap: Pusat dapat 4 angka walau TANPA akses baris report accounting');
  const { rows: keu } = await q(`select * from v_keuangan_rekap where tanggal = (now() at time zone 'Asia/Jakarta')::date;`);
  cek(keu.length === 1, `Pusat dapat 1 baris (dapat ${keu.length})`);
  cek(Number(keu[0]?.total_masuk) === 10000000, `total_masuk benar (dapat ${keu[0]?.total_masuk})`);
  cek(Number(keu[0]?.total_keluar) === 4000000, `total_keluar benar (dapat ${keu[0]?.total_keluar})`);
  cek(Number(keu[0]?.net) === 6000000, `net benar (dapat ${keu[0]?.net})`);
  const kolomKeu = keu[0] ? Object.keys(keu[0]).sort() : [];
  cek(
    JSON.stringify(kolomKeu) === JSON.stringify(['net', 'tanggal', 'total_keluar', 'total_masuk', 'warna']),
    `kolom PERSIS 5, tidak ada yang bocor (dapat ${JSON.stringify(kolomKeu)})`,
  );
  cek(
    !JSON.stringify(keu).includes('RAHASIA'),
    'field lain (saldo_rahasia) TIDAK bocor lewat view',
  );

  await jadiSebagai(karyawanPolos);
  const { rows: keuKaryawan } = await q(`select * from v_keuangan_rekap where tanggal = (now() at time zone 'Asia/Jakarta')::date;`);
  cek(keuKaryawan.length === 0, `karyawan biasa (bukan ceo/pusat/accounting) 0 baris (dapat ${keuKaryawan.length})`);

  langkah('UJI 3 -- selisih_resto_untuk_tanggal(): Indosteak Cempaka (kedua laporan ada) tampil, selisih 200000; outlet lain TIDAK tampil');
  await jadiSebagai(pusat);
  const { rows: selisih } = await q(`select * from selisih_resto_untuk_tanggal();`);
  cek(selisih.length === 1, `cuma Indosteak Cempaka yang tampil (dapat ${selisih.length} baris)`);
  cek(selisih[0]?.outlet === 'Indosteak Cempaka', `outlet = Indosteak Cempaka (dapat "${selisih[0]?.outlet}")`);
  cek(Number(selisih[0]?.selisih) === 200000, `selisih = 200000 (dapat ${selisih[0]?.selisih})`);

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
