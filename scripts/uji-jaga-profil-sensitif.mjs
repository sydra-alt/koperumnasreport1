#!/usr/bin/env node
// Uji perbaikan eskalasi privilege lewat profile.divisi/aktif (migrasi 0028).
// Ditemukan sambil mengaudit insert policy lain (instruksi user 30 Agustus
// 2026) -- profile_update TIDAK PERNAH punya WITH CHECK, jadi karyawan biasa
// bisa mengubah divisi miliknya sendiri jadi 'HRD' dan lolos is_hrd_kadiv()
// kalau dia sudah punya role 'kadiv' dari divisi lain. Diperbaiki lewat
// trigger (bukan WITH CHECK -- butuh OLD vs NEW, RLS check saja tidak cukup).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
const hasil = [];

function q(sql) {
  return client.query(sql);
}
async function jadiSebagai(kunciUuid) {
  await q(`select set_config('request.jwt.claims', json_build_object('sub', current_setting('${kunciUuid}'), 'role','authenticated')::text, true);`);
  return (await q('select auth.uid() as siapa;')).rows[0].siapa;
}
function catat(nomor, skenario, harapan, mentah, lolos) {
  hasil.push({ nomor, skenario, harapan, mentah, lolos });
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
      perform set_config('uji.id_toyib', id_toyib::text, true);
      perform set_config('uji.id_putri', id_putri::text, true);
    end $$;
  `);
  await q(`select set_config('role', 'authenticated', true);`);

  // #1 -- eskalasi yang DITEMUKAN: toyib (karyawan biasa) ubah divisi sendiri jadi HRD -- harus ditolak sekarang
  const s1 = await jadiSebagai('uji.id_toyib');
  await q(`
    do $$
    begin
      update public.profile set divisi = 'HRD' where id = auth.uid();
      perform set_config('uji.h1', 'LOLOS_SALAH: divisi berubah', true);
    exception when others then
      perform set_config('uji.h1', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h1 = (await q(`select current_setting('uji.h1') as h;`)).rows[0].h;
  catat(1, 'toyib (karyawan biasa) ubah profile.divisi miliknya sendiri jadi HRD', 'ditolak', `auth.uid()=${s1}; ${h1}`, h1.startsWith('DITOLAK_BENAR'));

  // #2 -- toyib set aktif=false miliknya sendiri (sembunyi dari filter pr.aktif) -- harus ditolak
  await q(`
    do $$
    begin
      update public.profile set aktif = false where id = auth.uid();
      perform set_config('uji.h2', 'LOLOS_SALAH: aktif berubah', true);
    exception when others then
      perform set_config('uji.h2', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h2 = (await q(`select current_setting('uji.h2') as h;`)).rows[0].h;
  catat(2, 'toyib ubah profile.aktif miliknya sendiri jadi false', 'ditolak', h2, h2.startsWith('DITOLAK_BENAR'));

  // #3 -- toyib TETAP boleh ubah nama miliknya sendiri (jalur wajar, kolom tidak sensitif)
  const r3 = await q(`update public.profile set nama = 'Toyib (uji)' where id = auth.uid() returning nama;`);
  catat(3, 'toyib ubah profile.nama miliknya sendiri (kolom tidak sensitif)', 'berhasil', JSON.stringify(r3.rows[0]), r3.rows[0]?.nama === 'Toyib (uji)');

  // #4 -- ceo TETAP boleh ubah divisi/aktif siapa pun
  const s4 = await jadiSebagai('uji.id_putri');
  const r4 = await q(`update public.profile set divisi = 'Rukost (diubah CEO)' where id = current_setting('uji.id_toyib')::uuid returning divisi;`);
  catat(4, 'ceo (putri) ubah profile.divisi milik toyib', 'berhasil', `auth.uid()=${s4}; ${JSON.stringify(r4.rows[0])}`, r4.rows[0]?.divisi === 'Rukost (diubah CEO)');

  // #5 -- koneksi pemilik/service (persis scripts/buat-akun.mjs, auth.uid() null) -- UPSERT divisi TETAP berhasil
  await q('reset role;');
  const r5 = await q(`
    insert into public.profile (id, nama, jabatan, divisi)
    select id, nama, jabatan, 'Rukost (upsert owner)' from public.profile where id = current_setting('uji.id_toyib')::uuid
    on conflict (id) do update set divisi = excluded.divisi
    returning divisi;
  `);
  catat(5, 'koneksi pemilik/service (auth.uid() null, persis buat-akun.mjs) UPSERT profile.divisi', 'berhasil', JSON.stringify(r5.rows[0]), r5.rows[0]?.divisi === 'Rukost (upsert owner)');
} catch (err) {
  console.error('ERROR TAK TERDUGA:', err.message);
  catat('(error)', 'eksekusi skrip', '-', err.message, false);
} finally {
  try {
    await q('rollback;');
    console.log('\n(ROLLBACK -- semua data uji dibatalkan)');
  } catch (e) {
    console.error('Gagal rollback:', e.message);
  }
  await client.end();
}

console.table(hasil.map((h) => ({ '#': h.nomor, skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.length === 5 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
