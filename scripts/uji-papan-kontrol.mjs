#!/usr/bin/env node
// Uji Task 18 (Papan Kontrol) -- v_papan_hari_ini + tagih_laporan(), DB
// sungguhan lewat penyamaran RLS, dibungkus BEGIN...ROLLBACK.
//
//  1. Assignment baru (PIC Uji Papan, lokasi Tajur) langsung muncul sebagai
//     kartu "belum lapor" di v_papan_hari_ini -- tanpa ubah kode (dihitung
//     dari `assignment`, bukan daftar tetap).
//  2. tagih_laporan() sebagai Pusat -- nudged_at terisi, report_id TETAP null
//     (belum lapor tetap belum lapor, nudge tidak memalsukan submit).
//  3. tagih_laporan() sebagai role tanpa 'pusat'/'ceo' -- ditolak.
//  4. PIC lalu mengisi baris DRAFT yang sama (dari nudge) sampai terkirim --
//     report_id muncul di view, warna & status ikut benar. Baris tetap SATU
//     (report_uniq tidak bentrok meski nudge sudah insert lebih dulu).

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

  langkah('SETUP -- PIC Uji Papan (lokasi Tajur), Pusat sementara, Karyawan polos');
  const { rows: lokasiRows } = await q(`select id from lokasi where nama='Tajur';`);
  const tajur = lokasiRows[0].id;
  const pic = await buatProfilSementara('PIC Uji Papan', ['pic_lokasi', 'karyawan']);
  const { rows: asgRows } = await q(
    `insert into assignment (user_id, form_key, lokasi_id) values ($1, 'pic_lokasi', $2) returning id;`,
    [pic, tajur],
  );
  const assignmentId = asgRows[0].id;
  const pusat = await buatProfilSementara('Pusat Uji Papan', ['pusat']);
  const karyawanPolos = await buatProfilSementara('Karyawan Polos Papan', ['karyawan']);
  console.log(`PIC=${pic} assignment=${assignmentId} Pusat=${pusat} KaryawanPolos=${karyawanPolos}`);

  langkah('UJI 1 -- assignment baru langsung jadi kartu "belum lapor" di v_papan_hari_ini');
  await q('set local role authenticated;');
  await jadiSebagai(pusat);
  let { rows: papan } = await q(`select * from v_papan_hari_ini where assignment_id = $1;`, [assignmentId]);
  cek(papan.length === 1, `1 baris untuk assignment baru (dapat ${papan.length})`);
  cek(papan[0]?.report_id === null, 'report_id null -- belum lapor');
  cek(papan[0]?.nudged_at === null, 'nudged_at masih null sebelum ditagih');
  cek(papan[0]?.pic_nama === 'PIC Uji Papan (uji sementara)', `pic_nama benar (dapat "${papan[0]?.pic_nama}")`);
  cek(papan[0]?.scope_nama === 'Tajur', `scope_nama = lokasi (dapat "${papan[0]?.scope_nama}")`);

  langkah('UJI 2 -- role TANPA pusat/ceo coba tagih_laporan -- ditolak');
  await jadiSebagai(karyawanPolos);
  await q('savepoint sebelum_tagih_ditolak;');
  let ditolak = false;
  try {
    await q(`select tagih_laporan($1);`, [assignmentId]);
  } catch (e) {
    ditolak = /Tidak berhak/.test(e.message);
  } finally {
    await q('rollback to savepoint sebelum_tagih_ditolak;');
  }
  cek(ditolak, 'karyawan polos ditolak memanggil tagih_laporan');

  langkah('UJI 3 -- Pusat menagih -- nudged_at terisi, report_id TETAP null');
  await jadiSebagai(pusat);
  await q(`select tagih_laporan($1);`, [assignmentId]);
  ({ rows: papan } = await q(`select * from v_papan_hari_ini where assignment_id = $1;`, [assignmentId]));
  cek(papan[0]?.nudged_at !== null, 'nudged_at terisi setelah ditagih');
  cek(papan[0]?.report_id === null, 'report_id TETAP null -- nudge bukan submit palsu');

  langkah('UJI 4 -- PIC mengisi baris draft yang SAMA (dari nudge) sampai terkirim -- SATU baris, bukan dua');
  await jadiSebagai(pic);
  const { rows: draftRows } = await q(
    `select id from report where form_key='pic_lokasi' and author_id=$1 and tanggal=(now() at time zone 'Asia/Jakarta')::date;`,
    [pic],
  );
  cek(draftRows.length === 1, `tetap SATU baris report untuk PIC ini hari ini (dapat ${draftRows.length})`);
  await q(`update report set data='{"progress_catatan":"uji"}'::jsonb, status='terkirim', warna='kuning', submitted_at=now() where id=$1;`, [
    draftRows[0].id,
  ]);

  await jadiSebagai(pusat);
  ({ rows: papan } = await q(`select * from v_papan_hari_ini where assignment_id = $1;`, [assignmentId]));
  cek(papan[0]?.report_id === draftRows[0].id, 'report_id sekarang muncul di view -- kartu jadi "sudah lapor"');
  cek(papan[0]?.warna === 'kuning', `warna ikut terbawa ke view (dapat "${papan[0]?.warna}")`);

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
