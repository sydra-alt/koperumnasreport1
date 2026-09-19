#!/usr/bin/env node
// Uji migrasi 0059 -- terlambat_menit dihitung SERVER. Semua di dalam satu
// transaksi yang SELALU di-ROLLBACK (tidak ada data uji tersimpan).
// Migrasi 0059 dijalankan ulang di dalam transaksi ini (idempotent: create or
// replace + drop trigger if exists), jadi skrip ini bisa dipakai SEBELUM
// migrasi diterapkan (dry-run) maupun sesudahnya.
//
// Pola sama uji-presensi-rls.mjs: pg.Client satu sesi, penyamaran
// `set role authenticated` + request.jwt.claims.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
const hasil = [];
const q = (sql, params) => client.query(sql, params);
const catat = (nomor, skenario, harapan, mentah, lolos) => hasil.push({ nomor, skenario, harapan, mentah, lolos });

async function hitung(waktuUtcIso) {
  const r = await q(`select public.hitung_terlambat_menit($1::uuid, $2::uuid, $3::timestamptz) as n`, [uid, titik, waktuUtcIso]);
  return r.rows[0].n;
}

let uid;
let titik;

try {
  await client.connect();
  await q('begin;');

  // Terapkan migrasi di dalam transaksi uji (buang begin/commit bawaannya).
  const sqlMigrasi = readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0059_terlambat_dihitung_server.sql'), 'utf8')
    .replace(/^\s*begin;\s*$/im, '')
    .replace(/^\s*commit;\s*$/im, '');
  await q(sqlMigrasi);

  // Orang uji: karyawan aktif bertitik SATU tanpa absensi hari ini, tanpa cuti.
  const pilih = await q(`
    select pa.user_id, pa.lokasi_absen_id
    from public.penugasan_absen pa
    join public.profile p on p.id = pa.user_id and p.aktif
    where pa.jam_masuk is null
      and not exists (select 1 from public.cuti c where c.user_id = pa.user_id)
      and not exists (select 1 from public.absensi a where a.user_id = pa.user_id and a.tanggal = (now() at time zone 'Asia/Jakarta')::date)
      and (select count(*) from public.penugasan_absen x where x.user_id = pa.user_id) = 1
    limit 1`);
  if (pilih.rowCount === 0) throw new Error('Tidak ada karyawan uji yang cocok.');
  uid = pilih.rows[0].user_id;
  titik = pilih.rows[0].lokasi_absen_id;
  const titikLain = (await q(`select id from public.lokasi_absen where id <> $1 and aktif limit 1`, [titik])).rows[0].id;

  // ── Fungsi hitung (waktu dipilih eksplisit, WIB = UTC+7) ─────────────
  // 2026-09-14 = Senin, 2026-09-12 = Sabtu, 2026-09-13 = Minggu, 2026-09-15 = Selasa.
  catat(1, 'Senin 14:59 WIB, acuan 08:00 + toleransi 15', '404 (kasus asli Putri)', String(await hitung('2026-09-14T07:59:00Z')), (await hitung('2026-09-14T07:59:00Z')) === 404);
  catat(2, 'Senin 08:15 (tepat batas toleransi)', '0', String(await hitung('2026-09-14T01:15:00Z')), (await hitung('2026-09-14T01:15:00Z')) === 0);
  catat(3, 'Senin 08:16', '1', String(await hitung('2026-09-14T01:16:00Z')), (await hitung('2026-09-14T01:16:00Z')) === 1);
  catat(4, 'Senin 07:30 (sebelum jam masuk)', '0, bukan negatif', String(await hitung('2026-09-14T00:30:00Z')), (await hitung('2026-09-14T00:30:00Z')) === 0);
  catat(5, 'Sabtu 14:59 (Sabtu ada di policy.workdays)', '404 (dihitung)', String(await hitung('2026-09-12T07:59:00Z')), (await hitung('2026-09-12T07:59:00Z')) === 404);
  const minggu = await hitung('2026-09-13T07:59:00Z');
  catat(6, 'Minggu 14:59 (di luar policy.workdays)', 'null (tidak dinilai), BUKAN 0 dan bukan angka', String(minggu), minggu === null);
  // Batas hari lewat konversi zona waktu: 2026-09-13 20:00Z = Senin 03:00 WIB -> hari kerja, acuan belum lewat -> 0
  const seninDini = await hitung('2026-09-13T20:00:00Z');
  catat(7, '2026-09-13 20:00 UTC = Senin 03:00 WIB (hari ditentukan WIB, bukan UTC)', '0 (Senin, sebelum jam masuk) -- BUKAN null', String(seninDini), seninDini === 0);
  const mingguMalam = await hitung('2026-09-13T17:30:00Z');
  catat(8, '2026-09-13 17:30 UTC = Senin 00:30 WIB', '0 (Senin), bukan null (Minggu)', String(mingguMalam), mingguMalam === 0);

  // ── Override per orang ────────────────────────────────────────────────
  await q(`update public.penugasan_absen set jam_masuk = '09:00' where user_id = $1 and lokasi_absen_id = $2`, [uid, titik]);
  const ov1 = await hitung('2026-09-14T02:16:00Z'); // 09:16 WIB
  catat(9, 'override penugasan_absen.jam_masuk=09:00, masuk 09:16', '1', String(ov1), ov1 === 1);
  await q(`update public.penugasan_absen set jam_masuk = null where user_id = $1 and lokasi_absen_id = $2`, [uid, titik]);

  // ── Cuti ──────────────────────────────────────────────────────────────
  await q(`insert into public.cuti (user_id, tanggal_mulai, tanggal_selesai, jenis, status) values ($1,'2026-09-15','2026-09-16','sakit','disetujui')`, [uid]);
  const c1 = await hitung('2026-09-15T07:59:00Z');
  catat(10, 'cuti disetujui menutup 15-16 Sep, masuk 15 Sep 14:59', 'null', String(c1), c1 === null);
  const c2 = await hitung('2026-09-16T07:59:00Z');
  catat(11, 'hari terakhir cuti (16 Sep) masih tertutup (inklusif)', 'null', String(c2), c2 === null);
  const c3 = await hitung('2026-09-17T07:59:00Z');
  catat(12, 'sehari SETELAH cuti (17 Sep) dihitung lagi', '404', String(c3), c3 === 404);
  await q(`update public.cuti set status = 'diajukan' where user_id = $1`, [uid]);
  const c4 = await hitung('2026-09-15T07:59:00Z');
  catat(13, 'cuti baru DIAJUKAN (belum disetujui) tidak membebaskan', '404', String(c4), c4 === 404);
  await q(`update public.cuti set status = 'ditolak' where user_id = $1`, [uid]);
  const c5 = await hitung('2026-09-15T07:59:00Z');
  catat(14, 'cuti DITOLAK tidak membebaskan', '404', String(c5), c5 === 404);

  // ── Trigger: menyamar sebagai karyawan (jalur klien) ──────────────────
  await q(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, true)`, [uid]);
  await q(`select set_config('role', 'authenticated', true)`);
  const siapa = (await q(`select auth.uid() as s`)).rows[0].s;
  catat(15, 'penyamaran aktif', `auth.uid() = ${uid}`, String(siapa), siapa === uid);

  // Klien memalsukan: terlambat 0, waktu & tanggal tahun 2020.
  await q('savepoint sp');
  const ins = await q(
    `insert into public.absensi (user_id, tanggal, tipe, waktu, lokasi_absen_id, status, foto_path, terlambat_menit)
     values ($1, '2020-01-01', 'masuk', '2020-01-01T01:00:00Z', $2, 'valid', 'uji/x.jpg', 0)
     returning tanggal::text as tanggal, waktu, terlambat_menit`,
    [uid, titik],
  );
  const baris = ins.rows[0];
  const hariIniWib = (await q(`select ((now() at time zone 'Asia/Jakarta')::date)::text as d`)).rows[0].d;
  catat(16, 'klien mengirim tanggal=2020-01-01', `tanggal tersimpan = hari ini WIB (${hariIniWib})`, baris.tanggal, baris.tanggal === hariIniWib);
  const selisihDetik = Math.abs(Date.now() - new Date(baris.waktu).getTime()) / 1000;
  catat(17, 'klien mengirim waktu=2020-01-01', 'waktu tersimpan = jam server (selisih < 60 detik dari sekarang)', `selisih ${selisihDetik.toFixed(1)} dtk`, selisihDetik < 60);
  await q('rollback to sp');

  // Nilai yang diharapkan dihitung sebagai owner (authenticated tidak boleh
  // memanggil fungsi hitung), lalu menyamar lagi sebagai karyawan.
  await q('reset role');
  const harapan = (await q(`select public.hitung_terlambat_menit($1::uuid, $2::uuid, now()) as n`, [uid, titik])).rows[0].n;
  await q(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, true)`, [uid]);
  await q(`select set_config('role', 'authenticated', true)`);
  const ins2 = await q(
    `insert into public.absensi (user_id, tanggal, tipe, lokasi_absen_id, status, foto_path, terlambat_menit)
     values ($1, (now() at time zone 'Asia/Jakarta')::date, 'masuk', $2, 'valid', 'uji/y.jpg', 0) returning terlambat_menit`,
    [uid, titik],
  );
  catat(18, 'klien mengirim terlambat_menit=0 (curang)', `tersimpan = hasil hitungan server (${harapan}), bukan 0 kiriman klien`, String(ins2.rows[0].terlambat_menit), ins2.rows[0].terlambat_menit === harapan);
  await q('rollback to sp');

  // Titik yang tidak ditugaskan ditolak.
  await q('savepoint sp2');
  let h19;
  try {
    await q(
      `insert into public.absensi (user_id, tanggal, tipe, lokasi_absen_id, status, foto_path, terlambat_menit)
       values ($1, (now() at time zone 'Asia/Jakarta')::date, 'masuk', $2, 'valid', 'uji/z.jpg', 0)`,
      [uid, titikLain],
    );
    h19 = 'LOLOS_SALAH: insert berhasil';
  } catch (e) {
    h19 = `DITOLAK_BENAR: ${e.message}`;
    await q('rollback to sp2');
  }
  catat(19, 'klien memakai titik yang TIDAK ditugaskan', 'ditolak', h19, h19.startsWith('DITOLAK_BENAR'));

  // 'pulang' selalu null walau klien mengirim angka.
  await q('savepoint sp3');
  const ins3 = await q(
    `insert into public.absensi (user_id, tanggal, tipe, lokasi_absen_id, status, foto_path, terlambat_menit)
     values ($1, (now() at time zone 'Asia/Jakarta')::date, 'pulang', $2, 'valid', 'uji/p.jpg', 999) returning terlambat_menit`,
    [uid, titik],
  );
  catat(20, "tipe 'pulang' dengan terlambat_menit=999 dari klien", 'null', String(ins3.rows[0].terlambat_menit), ins3.rows[0].terlambat_menit === null);
  await q('rollback to sp3');

  // Klien tidak bisa memanggil fungsi hitung langsung (bocor status cuti orang lain).
  await q('savepoint sp4');
  let h21;
  try {
    await q(`select public.hitung_terlambat_menit($1::uuid, $2::uuid, now())`, [uid, titik]);
    h21 = 'LOLOS_SALAH: fungsi bisa dipanggil klien';
  } catch (e) {
    h21 = `DITOLAK_BENAR: ${e.message}`;
    await q('rollback to sp4');
  }
  catat(21, 'authenticated memanggil hitung_terlambat_menit() langsung', 'ditolak (EXECUTE dicabut)', h21, h21.startsWith('DITOLAK_BENAR'));

  // Jalur owner/skrip (auth.uid() null) TIDAK ditimpa.
  await q('reset role');
  await q(`select set_config('request.jwt.claims', '', true)`);
  await q('savepoint sp5');
  const ins5 = await q(
    `insert into public.absensi (user_id, tanggal, tipe, lokasi_absen_id, status, foto_path, terlambat_menit)
     values ($1, '2020-01-01', 'masuk', $2, 'valid', 'uji/o.jpg', 77) returning tanggal::text as tanggal, terlambat_menit`,
    [uid, titik],
  );
  catat(22, 'insert tanpa JWT (owner/skrip)', 'tidak ditimpa: tanggal 2020-01-01, terlambat 77', `${ins5.rows[0].tanggal}, ${ins5.rows[0].terlambat_menit}`, ins5.rows[0].tanggal === '2020-01-01' && ins5.rows[0].terlambat_menit === 77);
  await q('rollback to sp5');

  // presensi_untuk_tanggal masih jalan & masuk_jam_efektif konsisten dengan fungsi acuan.
  const pt = await q(`select count(*)::int as n from public.presensi_untuk_tanggal('2026-09-14')`);
  catat(23, 'presensi_untuk_tanggal() masih bisa dipanggil (return type tak berubah)', '>= 1 baris', `n=${pt.rows[0].n}`, pt.rows[0].n >= 1);
} catch (e) {
  console.error('GALAT UJI:', e.message);
  hasil.push({ nomor: 'X', skenario: 'skrip', harapan: 'selesai tanpa galat', mentah: e.message, lolos: false });
} finally {
  try { await client.query('rollback;'); } catch { /* tidak ada transaksi aktif */ }
  await client.end();
}

let gagal = 0;
for (const h of hasil) {
  if (!h.lolos) gagal++;
  console.log(`${h.lolos ? 'LOLOS ' : 'GAGAL '} #${h.nomor} ${h.skenario}\n        harapan: ${h.harapan}\n        hasil  : ${h.mentah}`);
}
console.log(`\n${hasil.length - gagal}/${hasil.length} lolos. Semua perubahan di-ROLLBACK.`);
process.exit(gagal === 0 ? 0 : 1);
