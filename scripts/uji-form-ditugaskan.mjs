#!/usr/bin/env node
// Uji migrasi 0069 (form divisi hanya untuk yang ditugaskan, audit UI R01) --
// TRANSAKSIONAL: satu transaksi yang SELALU di-ROLLBACK. Kalau 0069 belum
// terpasang, migrasinya dijalankan DI DALAM transaksi ini (= dry run).
//
// Peran yang diuji (akun uji, scripts/buat-akun-uji.mjs): CEO (uji-ceo),
// Admin (uji6), manajer yang ditugaskan (uji1, manager_resto Indosteak
// Cempaka), karyawan tidak ditugaskan (uji2; uji4 kadiv), dan "Ita"
// (uji5 diberi penugasan thrifting global di dalam transaksi). Orang
// sungguhan HANYA dibaca lewat penyamaran: setiap penugasan nyata harus
// tetap lolos boleh_isi_form. Tidak ada yang tersimpan.

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
const cek = (skenario, lolos, mentah = '') => hasil.push({ skenario, lolos, mentah: typeof mentah === 'string' ? mentah : JSON.stringify(mentah) });

async function sebagaiOwner() {
  await q('reset role');
  await q(`select set_config('request.jwt.claims', '', true)`);
}
async function sebagai(uid) {
  await q('reset role');
  await q(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, true)`, [uid]);
  await q(`select set_config('role', 'authenticated', true)`);
}
async function coba(sql, params) {
  await q('savepoint s');
  try {
    const r = await q(sql, params);
    await q('release savepoint s');
    return { ok: true, rows: r.rows, rowCount: r.rowCount };
  } catch (e) {
    await q('rollback to s');
    return { ok: false, err: e.message };
  }
}
const uid = async (email) => (await q(`select id from auth.users where email = $1`, [email])).rows[0]?.id;
const tulis = (form, author, outlet = null, lokasi = null) =>
  coba(
    `insert into public.report (form_key, tanggal, author_id, outlet_id, lokasi_id, data, status)
     values ($1, (now() at time zone 'Asia/Jakarta')::date, $2, $3, $4, '{}'::jsonb, 'draft') returning id`,
    [form, author, outlet, lokasi],
  );
const bukaForm = async (f) => (await q('select public.boleh_buka_form($1) as b', [f])).rows[0].b;

try {
  await client.connect();
  await q('begin;');

  const terpasang = (await q(`select to_regprocedure('public.boleh_isi_form(text,uuid,uuid)') is not null as t`)).rows[0].t;
  const sebelum = (await q('select count(*)::int n, coalesce(sum(hashtext(id::text || status || data::text)), 0)::text sidik from public.report')).rows[0];
  if (!terpasang) {
    const sql = readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0069_form_hanya_yang_ditugaskan.sql'), 'utf8')
      .split('\n')
      .filter((l) => !/^\s*(begin|commit);\s*$/i.test(l))
      .join('\n');
    await q(sql);
    console.log('0069 belum terpasang -- dijalankan di dalam transaksi uji (DRY RUN, akan di-ROLLBACK).');
  } else {
    console.log('0069 sudah terpasang -- menguji aturan yang berlaku.');
  }
  const sesudah = (await q('select count(*)::int n, coalesce(sum(hashtext(id::text || status || data::text)), 0)::text sidik from public.report')).rows[0];
  cek('migrasi tidak menghapus/mengubah baris report yang ada', sebelum.n === sesudah.n && sebelum.sidik === sesudah.sidik, { sebelum, sesudah });

  const ids = [];
  for (const u of ['uji-ceo', 'uji6', 'uji1', 'uji2', 'uji4', 'uji5']) ids.push(await uid(`${u}@koperumnas.local`));
  const [ceo, admin, manajer, karyawan, kadiv, ita] = ids;
  const outlet = Object.fromEntries((await q('select nama, id from public.outlet')).rows.map((r) => [r.nama, r.id]));
  const cempaka = outlet['Indosteak Cempaka'];
  const lain = Object.values(outlet).find((id) => id !== cempaka);
  await sebagaiOwner();
  await q(`insert into public.assignment (user_id, form_key) values ($1, 'thrifting')`, [ita]);
  await q(`insert into public.role (user_id, role) values ($1, 'karyawan') on conflict do nothing`, [ita]);

  // Karyawan tidak ditugaskan
  await sebagai(karyawan);
  const k1 = await tulis('accounting', karyawan);
  const k2 = await tulis('hrd', karyawan);
  const k3 = await tulis('manager_resto', karyawan, cempaka);
  cek('karyawan tidak ditugaskan: accounting/hrd/manager_resto DITOLAK RLS', !k1.ok && !k2.ok && !k3.ok, { k1: k1.err, k2: k2.err, k3: k3.err });
  cek('karyawan tidak ditugaskan: halaman accounting tidak boleh dibuka', (await bukaForm('accounting')) === false);
  const kPm = await tulis('personal_marketing', karyawan);
  cek('karyawan: personal_marketing (kewajiban semua karyawan) tetap bisa', kPm.ok, kPm.err);
  cek('karyawan dengan penugasan absen di outlet: kebersihan tetap boleh', (await q('select public.boleh_isi_form($1, null, $2) b', ['kebersihan', cempaka])).rows[0].b === true);

  await sebagai(kadiv);
  const kd = await tulis('accounting', kadiv);
  cek('kadiv tidak ditugaskan: accounting DITOLAK', !kd.ok, kd.err);

  // Manajer yang ditugaskan
  await sebagai(manajer);
  const m1 = await tulis('manager_resto', manajer, cempaka);
  const m2 = await tulis('manager_resto', manajer, lain);
  const m3 = await tulis('manager_resto', manajer, null);
  const m4 = await tulis('accounting', manajer);
  cek('manajer ditugaskan: manager_resto di outletnya BISA', m1.ok, m1.err);
  cek('manajer ditugaskan: outlet lain / tanpa outlet / accounting DITOLAK', !m2.ok && !m3.ok && !m4.ok, { m2: m2.err, m3: m3.err, m4: m4.err });
  cek('manajer ditugaskan: halaman manager_resto boleh, accounting tidak', (await bukaForm('manager_resto')) === true && (await bukaForm('accounting')) === false);
  if (m1.ok) {
    const u = await coba(`update public.report set data = '{"uji":1}'::jsonb, status = 'terkirim' where id = $1`, [m1.rows[0].id]);
    cek('manajer ditugaskan: mengirim draf miliknya sendiri BISA', u.ok && u.rowCount === 1, u.err ?? u.rowCount);
  }

  // Draf lama milik orang yang tidak ditugaskan: tidak bisa dikirim (tapi tidak dihapus)
  await sebagaiOwner();
  const draf = (await q(`insert into public.report (form_key, tanggal, author_id, data, status) values ('hrd', (now() at time zone 'Asia/Jakarta')::date, $1, '{}', 'draft') returning id`, [karyawan])).rows[0].id;
  await sebagai(karyawan);
  const kirim = await coba(`update public.report set status = 'terkirim' where id = $1`, [draf]);
  await sebagaiOwner();
  const masihAda = (await q('select status from public.report where id = $1', [draf])).rows[0];
  cek('draf lama tanpa penugasan: tidak bisa dikirim, barisnya tetap ada apa adanya', !kirim.ok && masihAda?.status === 'draft', { kirim: kirim.err, masihAda });

  // CEO & Admin
  await sebagai(ceo);
  const c1 = await tulis('accounting', ceo);
  const c2 = await tulis('manager_resto', ceo, lain);
  cek('CEO: accounting & manager_resto outlet mana pun BISA', c1.ok && c2.ok, { c1: c1.err, c2: c2.err });
  await sebagai(admin);
  const a1 = await tulis('hrd', admin);
  cek('Admin: hrd BISA, halaman accounting boleh dibuka', a1.ok && (await bukaForm('accounting')) === true, a1.err);

  // "Ita" -- penugasan thrifting global
  await sebagai(ita);
  const i1 = await tulis('thrifting', ita);
  const i2 = await tulis('accounting', ita);
  const i3 = await tulis('kontrol_fnb', ita, cempaka);
  cek('Ita (thrifting): thrifting BISA; accounting & kontrol_fnb DITOLAK', i1.ok && !i2.ok && !i3.ok, { i1: i1.err, i2: i2.err, i3: i3.err });

  // Setiap penugasan NYATA (bukan akun uji) tetap lolos untuk pemiliknya.
  await sebagaiOwner();
  const nyata = (
    await q(`select a.user_id, a.form_key, a.lokasi_id, a.outlet_id from public.assignment a join public.profile p on p.id = a.user_id where not coalesce(p.akun_uji, false)`)
  ).rows;
  const gagalNyata = [];
  for (const a of nyata) {
    await sebagai(a.user_id);
    const ok = (await q('select public.boleh_isi_form($1, $2, $3) b', [a.form_key, a.lokasi_id, a.outlet_id])).rows[0].b;
    const buka = await bukaForm(a.form_key);
    if (!ok || !buka) gagalNyata.push(a.form_key);
  }
  cek(`semua ${nyata.length} penugasan nyata tetap boleh membuka & mengirim form-nya`, nyata.length > 0 && gagalNyata.length === 0, gagalNyata);

  // Informasi: penulis laporan nyata 60 hari terakhir yang TIDAK akan lolos lagi (bukan kegagalan uji).
  await sebagaiOwner();
  const lama = (
    await q(`select r.author_id, r.form_key, r.lokasi_id, r.outlet_id from public.report r join public.profile p on p.id = r.author_id
             where not coalesce(p.akun_uji, false) and r.tanggal > (now() at time zone 'Asia/Jakarta')::date - 60`)
  ).rows;
  const terdampak = new Map();
  for (const r of lama) {
    await sebagai(r.author_id);
    const ok = (await q('select public.boleh_isi_form($1, $2, $3) b', [r.form_key, r.lokasi_id, r.outlet_id])).rows[0].b;
    if (!ok) {
      await sebagaiOwner();
      const peran = (await q(`select string_agg(role, ',' order by role) p from public.role where user_id = $1`, [r.author_id])).rows[0].p;
      terdampak.set(`${r.form_key} (peran: ${peran})`, (terdampak.get(`${r.form_key} (peran: ${peran})`) ?? 0) + 1);
    }
  }
  console.log(`INFO: laporan nyata 60 hari terakhir yang penulisnya tidak lagi lolos: ${terdampak.size === 0 ? 'tidak ada' : [...terdampak].map(([k, n]) => `${k} x${n}`).join('; ')}`);
} catch (e) {
  cek('skrip selesai tanpa galat', false, e.message);
} finally {
  try { await q('rollback;'); } catch { /* koneksi mungkin sudah putus */ }
  await client.end();
}

let gagal = 0;
for (const h of hasil) {
  if (!h.lolos) gagal += 1;
  console.log(`${h.lolos ? 'LOLOS' : 'GAGAL'}  ${h.skenario}${h.lolos ? '' : `\n        -> ${h.mentah}`}`);
}
console.log(`\n${hasil.length - gagal}/${hasil.length} lolos. Semua perubahan di-ROLLBACK.`);
process.exit(gagal === 0 ? 0 : 1);
