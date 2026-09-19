#!/usr/bin/env node
// Uji scripts/killswitch-0062-omzet-pos.sql -- TRANSAKSIONAL: semua di dalam satu
// transaksi yang SELALU di-ROLLBACK (tidak ada yang berubah permanen).
// Membuktikan kill-switch mengembalikan database PERSIS ke keadaan sebelum 0062
// (sidik jari katalog: fungsi, relasi, policy RLS, isi tabel `policy`), berhenti
// kalau ada data salinan, idempoten, dan aman di database yang belum bermigrasi.
//
// Berlaku SEBELUM maupun SESUDAH 0062 diterapkan permanen: kalau 0062 sudah
// terpasang, skrip ini menjalankan kill-switch DI DALAM transaksi lalu
// membatalkannya (ROLLBACK memulihkan semuanya).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
const q = (sql, params) => client.query(sql, params);
const hasil = [];
let nomor = 0;
const cek = (skenario, harapan, mentah, lolos) => {
  nomor += 1;
  hasil.push({ nomor, skenario, harapan, mentah: typeof mentah === 'string' ? mentah : JSON.stringify(mentah), lolos });
};

const strip = (s) => s.replace(/^\s*begin;\s*$/im, '').replace(/^\s*commit;\s*$/im, '');
const SQL_MIGRASI = strip(readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0062_omzet_pos_silang_cek.sql'), 'utf8'));
const SQL_KILL = strip(readFileSync(path.join(__dirname, 'killswitch-0062-omzet-pos.sql'), 'utf8'));

async function sidikJari() {
  const fungsi = (await q(`select p.oid::regprocedure::text as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' order by 1`)).rows.map((r) => r.f);
  const relasi = (await q(`select c.relname || ':' || c.relkind::text as r from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','v','m','S','i') order by 1`)).rows.map((r) => r.r);
  const policyRls = (await q(`select tablename || '.' || policyname as p from pg_policies where schemaname = 'public' order by 1`)).rows.map((r) => r.p);
  const tabelPolicy = (await q(`select key || '=' || value::text as k from public.policy order by 1`)).rows.map((r) => r.k);
  return { fungsi, relasi, policyRls, tabelPolicy };
}
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function coba(sql, params) {
  await q('savepoint u');
  try {
    await q(sql, params);
    return { ok: true };
  } catch (e) {
    await q('rollback to savepoint u');
    return { ok: false, err: e.message };
  } finally {
    // savepoint sengaja tidak dilepas -- pemanggil yang me-rollback ke savepoint besar
  }
}

try {
  await client.connect();
  await q('begin;');

  const sudahTerpasang = (await q(`select to_regclass('public.outlet_pos_map') is not null as ada`)).rows[0].ada;
  // Bawa ke keadaan "sebelum 0062": kalau sudah terpasang, jalankan kill-switch (dengan izin hapus data) DI DALAM transaksi ini.
  if (sudahTerpasang) {
    await q(`select set_config('app.killswitch_0062_hapus_data', 'ya', true)`);
    await q(SQL_KILL);
    await q(`select set_config('app.killswitch_0062_hapus_data', '', true)`);
  }
  const sebelum = await sidikJari();
  cek('keadaan awal: objek 0062 TIDAK ada', 'nol tabel/fungsi 0062', {
    tabel: sebelum.relasi.filter((r) => /outlet_pos_map|omzet_pos_harian|sinkron_pos_log/.test(r)).length,
    fungsi: sebelum.fungsi.filter((f) => /terapkan_sinkron_pos|status_sinkron_pos|omzet_tiga_sumber/.test(f)).length,
  }, !sebelum.relasi.some((r) => /outlet_pos_map|omzet_pos_harian|sinkron_pos_log/.test(r)) && !sebelum.fungsi.some((f) => /terapkan_sinkron_pos|status_sinkron_pos|omzet_tiga_sumber/.test(f)));

  // S1: kill-switch di database yang BELUM bermigrasi -> tidak error, tidak mengubah apa pun
  await q('savepoint besar');
  const s1 = await coba(SQL_KILL);
  const fp1 = await sidikJari();
  cek('kill-switch di database TANPA 0062: tidak error dan tidak mengubah apa pun (idempoten)', 'ok, sidik jari sama', { ok: s1.ok, err: s1.err }, s1.ok && sama(fp1, sebelum));
  await q('rollback to savepoint besar');

  // Terapkan migrasi maju (di dalam transaksi)
  await q(SQL_MIGRASI);
  const sesudahMaju = await sidikJari();
  cek('migrasi maju benar-benar menambah objek (uji ini bukan hijau karena kosong)', '3 tabel + 3 fungsi + kunci policy baru',
    {
      tabel: sesudahMaju.relasi.filter((r) => /outlet_pos_map|omzet_pos_harian|sinkron_pos_log/.test(r) && r.endsWith(':r')).length,
      fungsi: sesudahMaju.fungsi.filter((f) => /terapkan_sinkron_pos|status_sinkron_pos|omzet_tiga_sumber/.test(f)).length,
      policyBaru: sesudahMaju.tabelPolicy.filter((k) => !sebelum.tabelPolicy.includes(k)),
    },
    sesudahMaju.relasi.filter((r) => /outlet_pos_map|omzet_pos_harian|sinkron_pos_log/.test(r) && r.endsWith(':r')).length === 3 &&
      sesudahMaju.fungsi.filter((f) => /terapkan_sinkron_pos|status_sinkron_pos|omzet_tiga_sumber/.test(f)).length === 3 &&
      sesudahMaju.tabelPolicy.filter((k) => !sebelum.tabelPolicy.includes(k)).length === 1);
  // Migrasi maju TIDAK menghapus/mengubah apa pun yang sudah ada: semua sidik jari lama masih ada
  const hilang = {
    fungsi: sebelum.fungsi.filter((f) => !sesudahMaju.fungsi.includes(f)),
    relasi: sebelum.relasi.filter((r) => !sesudahMaju.relasi.includes(r)),
    policyRls: sebelum.policyRls.filter((p) => !sesudahMaju.policyRls.includes(p)),
    tabelPolicy: sebelum.tabelPolicy.filter((k) => !sesudahMaju.tabelPolicy.includes(k)),
  };
  cek('migrasi maju MURNI menambah: tidak ada fungsi/tabel/policy RLS/kunci policy lama yang hilang atau berubah nilai', 'semua kosong', hilang,
    Object.values(hilang).every((a) => a.length === 0));

  // S2: kill-switch dengan tabel masih KOSONG -> kembali persis
  await q('savepoint besar2');
  const s2 = await coba(SQL_KILL);
  const fp2 = await sidikJari();
  cek('kill-switch setelah migrasi (tabel kosong): kembali PERSIS ke keadaan sebelum 0062', 'sidik jari identik', { ok: s2.ok, err: s2.err }, s2.ok && sama(fp2, sebelum));
  const dua = await coba(SQL_KILL);
  cek('kill-switch dijalankan DUA KALI: tidak error', 'ok', dua.ok ? 'ok' : dua.err, dua.ok);
  const lama = await coba(`select count(*)::int from public.selisih_resto_untuk_tanggal('2026-09-18')`);
  cek('fungsi lama selisih_resto_untuk_tanggal() tetap ada dan jalan', 'ok', lama.ok ? 'ok' : lama.err, lama.ok);
  await q('rollback to savepoint besar2');

  // S3: ada data salinan -> berhenti dengan pesan jelas, data utuh
  const outlet = (await q(`select id from public.outlet where aktif limit 1`)).rows[0].id;
  await q(`insert into public.omzet_pos_harian values ($1, '2026-09-18', 1, 1000, 900, 0, now())`, [outlet]);
  await q(`insert into public.sinkron_pos_log (status, selesai) values ('berhasil', now())`);
  await q('savepoint besar3');
  const s3 = await coba(SQL_KILL);
  await q('rollback to savepoint besar3');
  const utuh = (await q(`select (select count(*) from public.omzet_pos_harian)::int as o, (select count(*) from public.sinkron_pos_log)::int as l`)).rows[0];
  cek('ada data salinan tanpa izin: kill-switch BERHENTI dengan pesan, tidak ada yang terhapus', 'ditolak, data utuh (1 & 1)', { ditolak: !s3.ok, pesan: (s3.err ?? '').slice(0, 70), utuh },
    !s3.ok && /KILL-SWITCH 0062 DIBATALKAN/.test(s3.err) && utuh.o === 1 && utuh.l === 1);
  const fpMasihAda = await sidikJari();
  cek('setelah ditolak: tabel dan fungsi 0062 semuanya masih ada', 'sidik jari sama dengan sesudah migrasi maju', 'dibandingkan', sama(fpMasihAda, sesudahMaju) || (fpMasihAda.relasi.length === sesudahMaju.relasi.length && fpMasihAda.fungsi.length === sesudahMaju.fungsi.length));

  // S4: dengan izin eksplisit -> menghapus dan kembali persis
  await q('savepoint besar4');
  await q(`select set_config('app.killswitch_0062_hapus_data', 'ya', true)`);
  const s4 = await coba(SQL_KILL);
  const fp4 = await sidikJari();
  cek('dengan izin eksplisit (set_config = ya): data ikut dihapus dan database kembali PERSIS ke sebelum 0062', 'sidik jari identik', { ok: s4.ok, err: s4.err }, s4.ok && sama(fp4, sebelum));
  await q('rollback to savepoint besar4');
} catch (e) {
  console.error('GALAT UJI:', e.stack ?? e.message);
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
