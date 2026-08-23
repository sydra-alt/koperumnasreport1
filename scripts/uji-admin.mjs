#!/usr/bin/env node
// Uji Task 23 (Halaman Admin) -- CRUD lokasi/outlet/assignment/policy/role
// SEMUANYA lewat RLS `*_admin` yang sudah ada sejak Task 04, bukan policy
// baru. DB sungguhan lewat penyamaran RLS, dibungkus BEGIN...ROLLBACK.
//
//  1. CEO bisa insert lokasi baru, update policy, insert assignment --
//     KETIGANYA lewat klien biasa (bukan service_role), sesuai instruksi
//     "CRUD lewat browser client, service_role CUMA utk auth.users".
//  2. Karyawan biasa (BUKAN ceo) ditolak melakukan hal yang sama.
//  3. Route Handler /api/admin/user: cek struktur -- 'use client' TIDAK
//     ada di file itu (dicek langsung dari isi file, bukan cuma dibaca).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
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

langkah('UJI 0 -- app/api/admin/user/route.ts TIDAK punya directive \'use client\' (kunci service_role cuma boleh di server)');
const isiRoute = readFileSync(path.join(__dirname, '..', 'app', 'api', 'admin', 'user', 'route.ts'), 'utf8');
cek(!/^\s*'use client';?\s*$/m.test(isiRoute), 'tidak ada baris directive `\'use client\'` di file route handler');
cek(isiRoute.includes('SUPABASE_SERVICE_ROLE_KEY'), 'file ini memang yang membaca SUPABASE_SERVICE_ROLE_KEY (lokasinya benar)');
const fileLain = ['lib/api/admin.ts', 'app/admin/page.tsx'].map((f) => readFileSync(path.join(__dirname, '..', f), 'utf8'));
cek(fileLain.every((isi) => !isi.includes('SUPABASE_SERVICE_ROLE_KEY')), 'lib/api/admin.ts dan app/admin/page.tsx (keduanya \'use client\') TIDAK menyentuh nama kunci itu sama sekali');

try {
  await client.connect();
  await q('begin;');
  await q('set local role postgres;');

  langkah('SETUP -- CEO sementara, karyawan polos sementara');
  const ceo = await buatProfilSementara('CEO Uji Admin', ['ceo']);
  const karyawanPolos = await buatProfilSementara('Karyawan Polos Admin', ['karyawan']);

  langkah('UJI 1 -- CEO: insert lokasi, update policy, insert assignment -- semua via klien biasa');
  await q('set local role authenticated;');
  await jadiSebagai(ceo);

  const { rows: lokasiBaru } = await q(`insert into lokasi (nama) values ('Lokasi Uji Admin') returning id;`);
  cek(lokasiBaru.length === 1, 'CEO berhasil insert lokasi baru');

  const { rowCount: rcPolicy } = await q(`update policy set value = '3' where key = 'closing_target';`);
  cek(rcPolicy === 1, 'CEO berhasil update policy.closing_target');
  await q(`update policy set value = '2' where key = 'closing_target';`); // kembalikan sebelum baris berikutnya membaca

  const { rows: pic } = await q(`select id from profile where nama = 'Toyib' limit 1;`);
  if (pic.length > 0) {
    const { rows: asgBaru } = await q(
      `insert into assignment (user_id, form_key, lokasi_id) values ($1, 'pic_lokasi', $2) returning id;`,
      [pic[0].id, lokasiBaru[0].id],
    );
    cek(asgBaru.length === 1, 'CEO berhasil insert assignment baru (PIC ke lokasi baru)');
  }

  langkah('UJI 2 -- karyawan BIASA ditolak melakukan hal yang sama');
  await jadiSebagai(karyawanPolos);
  await q('savepoint sebelum_tolak;');
  const { rowCount: rcLokasiPolos } = await q(`insert into lokasi (nama) values ('Lokasi Ditolak') returning id;`).catch((e) => ({ rowCount: 0, error: e }));
  await q('rollback to savepoint sebelum_tolak;');
  cek(rcLokasiPolos === 0, 'karyawan polos GAGAL insert lokasi (RLS lokasi_admin menolak)');

  await q('savepoint sebelum_tolak2;');
  const { rowCount: rcPolicyPolos } = await q(`update policy set value = '99' where key = 'closing_target' returning key;`);
  await q('rollback to savepoint sebelum_tolak2;');
  cek(rcPolicyPolos === 0, 'karyawan polos GAGAL update policy (RLS policy_admin menolak)');

  await q('set local role postgres;');
  await q('rollback;');
  const { rows: sisa } = await q(`select count(*)::int as n from profile where nama like '%(uji sementara)%';`);
  cek(sisa[0].n === 0, 'ROLLBACK bersih -- 0 profil uji sementara tersisa');
  const { rows: policySisa } = await q(`select value from policy where key = 'closing_target';`);
  // node-postgres mem-parse kolom jsonb jadi nilai JS asli (angka 2, bukan string "2") -- bandingkan Number(), bukan strict-equal ke string.
  cek(Number(policySisa[0].value) === 2, `policy.closing_target kembali ke nilai asli 2 (dapat ${policySisa[0].value})`);

  console.log(process.exitCode ? '\n❌ ADA YANG GAGAL' : '\n✅ SEMUA LOLOS');
} catch (err) {
  console.error('ERROR:', err);
  process.exitCode = 1;
} finally {
  await client.end();
}
