#!/usr/bin/env node
// Uji RLS presensi (migrasi 0022_presensi.sql) -- lokasi_absen, penugasan_absen,
// absensi, is_hrd_kadiv(), putuskan_absensi(), atur_jam_kerja(). Pola sama
// skrip lain sesi ini: pg.Client satu sesi, BEGIN/ROLLBACK, auth.uid() dicek
// ulang tiap ganti persona.
//
// is_hrd_kadiv() diuji dengan MEMINJAM SEMENTARA dua akun uji yang sudah ada
// (Fauzy, Kasam) -- BUKAN profil baru: `profile.id` punya foreign key ke
// `auth.users(id)`, jadi tidak bisa insert profil "palsu" tanpa baris
// auth.users yang cocok (dicoba, gagal duluan, baru diperbaiki jadi pola
// ini). Fauzy diberi role 'kadiv' + divisi diubah sementara ke 'HRD' (harus
// LOLOS is_hrd_kadiv); Kasam diberi role 'kadiv' TANPA ubah divisi-nya
// ('DTI', harus GAGAL is_hrd_kadiv -- kadiv divisi lain, bukan HRD). Semua
// perubahan ini di dalam transaksi yang di-ROLLBACK di akhir, tidak
// tersimpan ke akun uji sungguhan.

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
      id_toyib      uuid := (select id from auth.users where email='toyib@koperumnas.local');
      id_kasam      uuid := (select id from auth.users where email='kasam@koperumnas.local');
      id_sabrina    uuid := (select id from auth.users where email='sabrina@koperumnas.local');
      id_putri      uuid := (select id from auth.users where email='putri@koperumnas.local');
      id_fauzy      uuid := (select id from auth.users where email='fauzy@koperumnas.local');
      titik_id      uuid := (select id from lokasi_absen limit 1);
      absensi_id    uuid := gen_random_uuid();
    begin
      -- Pinjam Fauzy jadi "kadiv HRD" sementara (positif), Kasam jadi
      -- "kadiv non-HRD" sementara (negatif) -- lihat komentar berkas.
      insert into public.role (user_id, role) values (id_fauzy, 'kadiv'), (id_kasam, 'kadiv');
      update public.profile set divisi = 'HRD' where id = id_fauzy;

      insert into public.absensi (id, user_id, tanggal, tipe, lokasi_absen_id, status, foto_path)
      values (absensi_id, id_toyib, (now() at time zone 'Asia/Jakarta')::date, 'masuk', titik_id, 'di_luar_radius', 'uji/percobaan.jpg');

      perform set_config('uji.id_toyib', id_toyib::text, true);
      perform set_config('uji.id_kasam', id_kasam::text, true);
      perform set_config('uji.id_sabrina', id_sabrina::text, true);
      perform set_config('uji.id_putri', id_putri::text, true);
      perform set_config('uji.id_kadiv_hrd', id_fauzy::text, true);
      perform set_config('uji.id_kadiv_cs', id_kasam::text, true);
      perform set_config('uji.titik_id', titik_id::text, true);
      perform set_config('uji.absensi_id', absensi_id::text, true);
    end $$;
  `);
  await q(`select set_config('role', 'authenticated', true);`);

  // #1 -- lokasi_absen: siapa pun login boleh baca
  const s1 = await jadiSebagai('uji.id_toyib');
  const r1 = await q(`select count(*)::int as n from public.lokasi_absen;`);
  catat(1, 'karyawan biasa select lokasi_absen', '>= 1 baris (CONTOH)', `auth.uid()=${s1}; n=${r1.rows[0].n}`, s1 !== null && r1.rows[0].n >= 1);

  // #2 -- lokasi_absen: karyawan biasa TIDAK boleh insert
  await q(`
    do $$
    begin
      insert into public.lokasi_absen (nama, latitude, longitude) values ('Percobaan', 0, 0);
      perform set_config('uji.h2', 'LOLOS_SALAH: insert berhasil', true);
    exception when others then
      perform set_config('uji.h2', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h2 = (await q(`select current_setting('uji.h2') as h;`)).rows[0].h;
  catat(2, 'karyawan biasa insert lokasi_absen', 'ditolak', h2, h2.startsWith('DITOLAK_BENAR'));

  // #3 -- absensi: pemilik lihat baris sendiri
  const r3 = await q(`select count(*)::int as n from public.absensi where id = current_setting('uji.absensi_id')::uuid;`);
  catat(3, 'toyib select absensi milik sendiri', '1 baris', `n=${r3.rows[0].n}`, r3.rows[0].n === 1);

  // #4 -- absensi: karyawan LAIN (kasam) tidak lihat punya toyib
  const s4 = await jadiSebagai('uji.id_kasam');
  const r4 = await q(`select count(*)::int as n from public.absensi where id = current_setting('uji.absensi_id')::uuid;`);
  catat(4, 'kasam (karyawan lain) select absensi milik toyib', '0 baris', `auth.uid()=${s4}; n=${r4.rows[0].n}`, s4 !== null && r4.rows[0].n === 0);

  // #5 -- absensi: pusat (sabrina) lihat semua
  const s5 = await jadiSebagai('uji.id_sabrina');
  const r5 = await q(`select count(*)::int as n from public.absensi where id = current_setting('uji.absensi_id')::uuid;`);
  catat(5, 'pusat (sabrina) select absensi milik toyib', '1 baris', `auth.uid()=${s5}; n=${r5.rows[0].n}`, s5 !== null && r5.rows[0].n === 1);

  // #6 -- is_hrd_kadiv(): kadiv+HRD lihat, kadiv+CS tidak
  const s6a = await jadiSebagai('uji.id_kadiv_hrd');
  const r6a = await q(`select count(*)::int as n from public.absensi where id = current_setting('uji.absensi_id')::uuid;`);
  catat(6, 'kadiv+divisi HRD (is_hrd_kadiv) select absensi orang lain', '1 baris', `auth.uid()=${s6a}; n=${r6a.rows[0].n}`, s6a !== null && r6a.rows[0].n === 1);

  const s6b = await jadiSebagai('uji.id_kadiv_cs');
  const r6b = await q(`select count(*)::int as n from public.absensi where id = current_setting('uji.absensi_id')::uuid;`);
  catat('6b', 'kadiv+divisi CS (BUKAN HRD) select absensi orang lain', '0 baris', `auth.uid()=${s6b}; n=${r6b.rows[0].n}`, s6b !== null && r6b.rows[0].n === 0);

  // #7 -- absensi: TIDAK ADA jalur update biasa, bahkan pemiliknya sendiri
  const s7 = await jadiSebagai('uji.id_toyib');
  const r7 = await q(`
    with u as (
      update public.absensi set catatan = 'ubah paksa' where id = current_setting('uji.absensi_id')::uuid returning id
    ) select count(*)::int as n from u;
  `);
  catat(7, 'toyib update absensi milik sendiri langsung (bukan RPC)', '0 baris terupdate (tidak ada policy update)', `auth.uid()=${s7}; n=${r7.rows[0].n}`, s7 !== null && r7.rows[0].n === 0);

  // #8 -- putuskan_absensi(): kasam (karyawan biasa) ditolak
  const s8 = await jadiSebagai('uji.id_kasam');
  await q(`
    do $$
    begin
      perform public.putuskan_absensi(current_setting('uji.absensi_id')::uuid, true, 'coba paksa');
      perform set_config('uji.h8', 'LOLOS_SALAH: rpc berhasil', true);
    exception when others then
      perform set_config('uji.h8', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h8 = (await q(`select current_setting('uji.h8') as h;`)).rows[0].h;
  catat(8, 'kasam (karyawan biasa) panggil putuskan_absensi()', 'ditolak', `auth.uid()=${s8}; ${h8}`, s8 !== null && h8.startsWith('DITOLAK_BENAR'));

  // #9 -- putuskan_absensi(): pusat (sabrina) berhasil
  const s9 = await jadiSebagai('uji.id_sabrina');
  await q(`select public.putuskan_absensi(current_setting('uji.absensi_id')::uuid, true, 'diperiksa, GPS lemah dekat tembok');`);
  const r9 = await q(`select keputusan_hrd, disetujui_oleh, catatan from public.absensi where id = current_setting('uji.absensi_id')::uuid;`);
  catat(
    9,
    'pusat (sabrina) panggil putuskan_absensi(diterima=true)',
    "keputusan_hrd='diterima', disetujui_oleh=sabrina",
    `auth.uid()=${s9}; ${JSON.stringify(r9.rows[0])}`,
    s9 !== null && r9.rows[0].keputusan_hrd === 'diterima' && r9.rows[0].disetujui_oleh === s9,
  );

  // #10 -- atur_jam_kerja(): karyawan biasa ditolak, pusat berhasil
  const s10a = await jadiSebagai('uji.id_kasam');
  await q(`
    do $$
    begin
      perform public.atur_jam_kerja(current_setting('uji.id_toyib')::uuid, current_setting('uji.titik_id')::uuid, '07:00', '15:00');
      perform set_config('uji.h10a', 'LOLOS_SALAH: rpc berhasil', true);
    exception when others then
      perform set_config('uji.h10a', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h10a = (await q(`select current_setting('uji.h10a') as h;`)).rows[0].h;
  catat('10a', 'kasam (karyawan biasa) panggil atur_jam_kerja()', 'ditolak', `auth.uid()=${s10a}; ${h10a}`, s10a !== null && h10a.startsWith('DITOLAK_BENAR'));

  // butuh baris penugasan_absen dulu supaya atur_jam_kerja ada yang diubah -- buat sebagai pemilik tabel
  await q('reset role;');
  await q(`insert into public.penugasan_absen (user_id, lokasi_absen_id) select current_setting('uji.id_toyib')::uuid, current_setting('uji.titik_id')::uuid;`);
  await q(`select set_config('role', 'authenticated', true);`);

  const s10b = await jadiSebagai('uji.id_sabrina');
  await q(`select public.atur_jam_kerja(current_setting('uji.id_toyib')::uuid, current_setting('uji.titik_id')::uuid, '07:00', '15:00');`);
  const r10b = await q(`select jam_masuk, jam_pulang from public.penugasan_absen where user_id = current_setting('uji.id_toyib')::uuid and lokasi_absen_id = current_setting('uji.titik_id')::uuid;`);
  catat('10b', 'pusat (sabrina) panggil atur_jam_kerja(07:00,15:00)', "jam_masuk='07:00', jam_pulang='15:00'", `auth.uid()=${s10b}; ${JSON.stringify(r10b.rows[0])}`, s10b !== null && r10b.rows[0]?.jam_masuk === '07:00' && r10b.rows[0]?.jam_pulang === '15:00');
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
const semuaLolos = hasil.length === 12 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
