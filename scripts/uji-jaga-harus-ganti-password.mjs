#!/usr/bin/env node
// Uji guard DB utk profile.harus_ganti_password (perluasan jaga_profil_
// sensitif(), migrasi 0034). Inti keamanan fitur paksa-ganti-password:
// TANPA guard ini, siapa pun bisa mematikan penandanya langsung lewat
// REST tanpa pernah benar-benar mengganti password, membuat SELURUH
// mekanisme /api/ganti-password + proxy.ts sia-sia.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
const hasil = [];
function catat(nomor, skenario, harapan, mentah, lolos) {
  hasil.push({ nomor, skenario, harapan, mentah, lolos });
}
function q(sql) {
  return client.query(sql);
}
async function jadiSebagai(kunciUuid) {
  await q(`select set_config('request.jwt.claims', json_build_object('sub', current_setting('${kunciUuid}'), 'role','authenticated')::text, true);`);
  return (await q('select auth.uid() as siapa;')).rows[0].siapa;
}

try {
  await client.connect();
  await q('begin;');

  await q(`
    do $$
    declare
      id_toyib uuid := (select id from auth.users where email='toyib@koperumnas.local');
      id_putri uuid := (select id from auth.users where email='putri@koperumnas.local');
    begin
      update public.profile set harus_ganti_password = true where id = id_toyib;
      perform set_config('uji.id_toyib', id_toyib::text, true);
      perform set_config('uji.id_putri', id_putri::text, true);
    end $$;
  `);
  await q(`select set_config('role', 'authenticated', true);`);

  // #1 -- Toyib (dirinya sendiri) coba matikan flag LANGSUNG lewat update biasa -- harus ditolak.
  const s1 = await jadiSebagai('uji.id_toyib');
  await q(`
    do $$
    begin
      update public.profile set harus_ganti_password = false where id = auth.uid();
      perform set_config('uji.h1', 'LOLOS_SALAH: flag berubah jadi false tanpa ganti password sungguhan', true);
    exception when others then
      perform set_config('uji.h1', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h1 = (await q(`select current_setting('uji.h1') as h;`)).rows[0].h;
  catat(1, 'toyib (sesi sendiri) matikan harus_ganti_password langsung lewat update biasa', 'ditolak', `auth.uid()=${s1}; ${h1}`, h1.startsWith('DITOLAK_BENAR'));

  // #2 -- Toyib TETAP boleh menyalakannya (true -> true, no-op, tapi juga arah true dijamin tidak diblokir) -- verifikasi tidak salah blokir arah lain.
  const r2 = await q(`update public.profile set nama = nama where id = auth.uid() returning harus_ganti_password;`);
  catat(2, 'toyib update kolom TIDAK sensitif (nama) di baris yang sama -- tidak ikut kena blokir', 'berhasil, flag tetap true', JSON.stringify(r2.rows[0]), r2.rows[0]?.harus_ganti_password === true);

  // #3 -- ceo (putri) matikan flag milik Toyib LANGSUNG -- diizinkan (override CEO, sama pola divisi/aktif).
  const s3 = await jadiSebagai('uji.id_putri');
  const r3 = await q(`update public.profile set harus_ganti_password = false where id = current_setting('uji.id_toyib')::uuid returning harus_ganti_password;`);
  catat(3, 'ceo (putri) matikan harus_ganti_password milik toyib langsung', 'berhasil (override CEO)', `auth.uid()=${s3}; ${JSON.stringify(r3.rows[0])}`, r3.rows[0]?.harus_ganti_password === false);

  // #4 -- koneksi pemilik/service (persis app/api/ganti-password/route.ts, auth.uid() null) -- boleh matikan flag.
  await q('reset role;');
  await q(`update public.profile set harus_ganti_password = true where id = (select id from auth.users where email='toyib@koperumnas.local');`); // reset dulu ke true
  await q(`select set_config('role', 'authenticated', true);`);
  await q('reset role;');
  const r4 = await q(`update public.profile set harus_ganti_password = false where id = (select id from auth.users where email='toyib@koperumnas.local') returning harus_ganti_password;`);
  catat(4, 'koneksi pemilik/service (auth.uid() null, persis /api/ganti-password) matikan flag', 'berhasil', JSON.stringify(r4.rows[0]), r4.rows[0]?.harus_ganti_password === false);
} catch (err) {
  console.error('ERROR TAK TERDUGA:', err.message);
  catat('(error)', 'eksekusi skrip', '-', err.message, false);
} finally {
  try {
    await q('rollback;');
    console.log('\n(ROLLBACK -- semua perubahan uji dibatalkan)');
  } catch (e) {
    console.error('Gagal rollback:', e.message);
  }
  await client.end();
}

console.table(hasil.map((h) => ({ '#': h.nomor, skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.length === 4 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
