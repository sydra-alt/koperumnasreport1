#!/usr/bin/env node
// Uji RLS storage.objects untuk bucket 'absensi' (migrasi 0022_presensi.sql)
// -- pola path {user_id}/... (BEDA dari 'bukti' yang pakai {report_id}/...,
// lihat komentar migrasi). Pola skrip sama seperti uji lain sesi ini.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
const hasil = [];
function q(sql) { return client.query(sql); }
async function jadiSebagai(kunciUuid) {
  await q(`select set_config('request.jwt.claims', json_build_object('sub', current_setting('${kunciUuid}'), 'role','authenticated')::text, true);`);
  return (await q('select auth.uid() as siapa;')).rows[0].siapa;
}

try {
  await client.connect();
  await q('begin;');
  await q(`
    do $$
    declare id_toyib uuid := (select id from auth.users where email='toyib@koperumnas.local');
            id_kasam uuid := (select id from auth.users where email='kasam@koperumnas.local');
            obj_id uuid := gen_random_uuid();
    begin
      insert into storage.objects (id, bucket_id, name, owner) values (obj_id, 'absensi', id_toyib::text || '/foto-uji.jpg', id_toyib);
      perform set_config('uji.id_toyib', id_toyib::text, true);
      perform set_config('uji.id_kasam', id_kasam::text, true);
    end $$;
  `);
  await q(`select set_config('role', 'authenticated', true);`);

  const s1 = await jadiSebagai('uji.id_toyib');
  const r1 = await q(`select count(*)::int as n from storage.objects where bucket_id='absensi' and name = current_setting('uji.id_toyib') || '/foto-uji.jpg';`);
  hasil.push({ skenario: 'toyib select foto absen milik sendiri', harapan: '1 baris', mentah: `auth.uid()=${s1}; n=${r1.rows[0].n}`, lolos: s1 !== null && r1.rows[0].n === 1 });

  const s2 = await jadiSebagai('uji.id_kasam');
  const r2 = await q(`select count(*)::int as n from storage.objects where bucket_id='absensi' and name = current_setting('uji.id_toyib') || '/foto-uji.jpg';`);
  hasil.push({ skenario: 'kasam (karyawan lain) select foto absen milik toyib', harapan: '0 baris', mentah: `auth.uid()=${s2}; n=${r2.rows[0].n}`, lolos: s2 !== null && r2.rows[0].n === 0 });

  await q(`
    do $$
    begin
      insert into storage.objects (bucket_id, name, owner) values ('absensi', current_setting('uji.id_toyib') || '/nyasar.jpg', current_setting('uji.id_kasam')::uuid);
      perform set_config('uji.h3', 'LOLOS_SALAH: insert berhasil', true);
    exception when others then
      perform set_config('uji.h3', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h3 = (await q(`select current_setting('uji.h3') as h;`)).rows[0].h;
  hasil.push({ skenario: 'kasam upload ke folder toyib (bukan foldernya sendiri)', harapan: 'ditolak', mentah: h3, lolos: h3.startsWith('DITOLAK_BENAR') });
} catch (err) {
  console.error('ERROR TAK TERDUGA:', err.message);
  hasil.push({ skenario: 'eksekusi skrip', harapan: '-', mentah: err.message, lolos: false });
} finally {
  await q('rollback;').catch(() => {});
  await client.end();
}

console.table(hasil.map((h) => ({ skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.length === 3 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
