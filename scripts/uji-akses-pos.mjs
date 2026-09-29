#!/usr/bin/env node
// Uji migrasi 0068 (akses pos-fnb diturunkan dari sistem laporan) --
// TRANSAKSIONAL: satu transaksi yang SELALU di-ROLLBACK. Migrasi dijalankan
// di dalam transaksi ini kalau belum terpasang.
//
// Orang sungguhan (Ita, Mba Rika, Cuko) HANYA dibaca lewat penyamaran di
// dalam transaksi -- tidak ada yang ditulis untuk mereka. Semua kasus yang
// MENGUBAH data (penugasan, tanda) memakai akun uji (scripts/buat-akun-uji.mjs),
// ikut di-ROLLBACK.

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
const akses = async (u) => { await sebagai(u); return (await q('select public.akses_pos_saya() as a')).rows[0].a; };
const sama = (a, b) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());

// ID outlet pos-fnb (Koperumnas Group) -- sama dengan outlet_pos_map.
const POS = {
  jatinegara: '4150168b-11ae-445c-819c-ee949f3726e4',
  kemayoran: 'f7a7b52a-b032-4b3f-a413-c527be40a3c3',
  cempaka: 'eb599c88-d2db-4723-94cf-5c2e2c667587',
  pekansari: '39c30eea-f354-4892-8d16-199b5c7b1614',
  bestie: '01a08e38-0737-7e92-8fb1-1bf597e0c6a7',
};

try {
  await client.connect();
  await q('begin;');
  const sudah = (await q(`select 1 from information_schema.columns where table_name = 'profile' and column_name = 'akses_semua_outlet_pos'`)).rowCount > 0;
  if (!sudah) await q(readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0068_akses_pos_dari_laporan.sql'), 'utf8'));

  const ita = await uid('ita@koperumnas.local');
  const rika = await uid('rika@koperumnas.local');
  const cuko = await uid('cuko@koperumnas.local');
  const ujiCeo = await uid('uji-ceo@koperumnas.local');
  const uji1 = await uid('uji1@koperumnas.local');
  const uji2 = await uid('uji2@koperumnas.local');
  const uji3 = await uid('uji3@koperumnas.local');
  const uji5 = await uid('uji5@koperumnas.local');
  const uji6 = await uid('uji6@koperumnas.local');
  const outletLaporan = async (nama) => (await q('select id from public.outlet where nama = $1', [nama])).rows[0].id;

  // ─── Orang sungguhan (baca saja) ─────────────────────────────────────
  const aIta = await akses(ita);
  cek('Ita: SEMUA outlet (termasuk Bestie Thrift) + audit_semua dari tanda, peran manager',
    aIta.boleh === true && aIta.semua_outlet === true && aIta.audit_semua === true && aIta.peran_pos === 'manager' && aIta.outlet_pos_ids === null, aIta);
  const aRika = await akses(rika);
  cek('Mba Rika: HANYA outlet penugasannya (Cempaka Putih + Pekansari), TANPA audit_semua',
    aRika.boleh === true && aRika.semua_outlet === false && aRika.audit_semua === false && sama(aRika.outlet_pos_ids, [POS.cempaka, POS.pekansari]), aRika);
  const aCuko = await akses(cuko);
  cek('Cuko (manager_resto Pekansari): hanya Pekansari', aCuko.boleh === true && sama(aCuko.outlet_pos_ids, [POS.pekansari]) && aCuko.peran_pos === 'manager', aCuko);

  // ─── Akun uji (diubah di dalam transaksi) ────────────────────────────
  // uji-ceo punya_akses_pos MATI secara bawaan (29 September 2026: akunnya
  // manager semua outlet produksi) -- dinyalakan di dalam transaksi ini saja.
  await sebagaiOwner();
  await q('update public.profile set punya_akses_pos = true where id = $1', [ujiCeo]);
  const aCeo = await akses(ujiCeo);
  cek('CEO: manager (bukan owner), semua outlet', aCeo.boleh === true && aCeo.peran_pos === 'manager' && aCeo.semua_outlet === true && aCeo.audit_semua === false, aCeo);

  await sebagaiOwner();
  await q('update public.profile set punya_akses_pos = false where id = $1', [uji3]);
  const aTanpa = await akses(uji3);
  cek('punya_akses_pos = false -> DITOLAK (tanpa_akses_pos)', aTanpa.boleh === false && aTanpa.alasan === 'tanpa_akses_pos', aTanpa);

  await sebagaiOwner();
  await q('update public.profile set punya_akses_pos = true where id = $1', [uji3]);
  await q(`insert into public.assignment (user_id, form_key, outlet_id) values ($1, 'kontrol_fnb', $2)`, [uji3, await outletLaporan('Indosteak Pekansari')]);
  const aDua = await akses(uji3);
  cek('Kontrol FnB uji dengan penugasan Cempaka + Pekansari -> dua outlet itu saja', sama(aDua.outlet_pos_ids, [POS.cempaka, POS.pekansari]), aDua);
  await sebagaiOwner();
  await q(`delete from public.assignment where user_id = $1 and form_key = 'kontrol_fnb' and outlet_id = $2`, [uji3, await outletLaporan('Indosteak Pekansari')]);
  const aSatu = await akses(uji3);
  cek('penugasan Pekansari DICABUT -> Pekansari hilang dari akses (penghapusan ikut)', sama(aSatu.outlet_pos_ids, [POS.cempaka]), aSatu);

  await sebagaiOwner();
  await q('update public.profile set punya_akses_pos = true where id = $1', [uji2]);
  const aKebersihan = await akses(uji2);
  cek('petugas kebersihan (form tidak dipetakan) -> DITOLAK (peran_tidak_dipetakan)', aKebersihan.boleh === false && aKebersihan.alasan === 'peran_tidak_dipetakan', aKebersihan);

  await sebagaiOwner();
  await q('update public.profile set punya_akses_pos = true where id = $1', [uji5]);
  await q(`insert into public.assignment (user_id, form_key) values ($1, 'thrifting')`, [uji5]);
  const aThrift = await akses(uji5);
  cek('penugasan thrifting -> Bestie Thrift (lewat form_akses, bukan outlet laporan)', aThrift.boleh === true && sama(aThrift.outlet_pos_ids, [POS.bestie]), aThrift);

  await sebagaiOwner();
  await q('update public.profile set aktif = false where id = $1', [uji5]);
  const aNonaktif = await akses(uji5);
  cek('profil nonaktif -> DITOLAK', aNonaktif.boleh === false && aNonaktif.alasan === 'nonaktif', aNonaktif);
  await sebagaiOwner();
  await q('update public.profile set aktif = true where id = $1', [uji5]);

  await sebagaiOwner();
  await q('update public.profile set akses_semua_outlet_pos = true where id = $1', [uji2]);
  const aFlag = await akses(uji2);
  cek('tanda akses_semua_outlet_pos pada orang tanpa form terpetakan -> semua outlet + audit, peran manager',
    aFlag.boleh === true && aFlag.semua_outlet === true && aFlag.audit_semua === true && aFlag.peran_pos === 'manager', aFlag);

  // ─── Siapa boleh mengubah ────────────────────────────────────────────
  await sebagai(uji1);
  const ubahSendiri = await coba('update public.profile set akses_semua_outlet_pos = true where id = $1', [uji1]);
  cek('non-CEO/Admin tidak bisa menyalakan akses_semua_outlet_pos miliknya', !ubahSendiri.ok && /akses semua outlet POS/.test(ubahSendiri.err ?? ''), ubahSendiri.err ?? ubahSendiri.rowCount);
  await sebagai(uji6);
  const adminUbah = await coba('update public.profile set akses_semua_outlet_pos = false where id = $1', [uji2]);
  cek('Admin boleh mengubah akses_semua_outlet_pos', adminUbah.ok && adminUbah.rowCount === 1, adminUbah.err ?? adminUbah.rowCount);

  await sebagai(uji1);
  const bacaPeta = await coba('select count(*)::int n from public.peta_akses_pos');
  const tulisPeta = await coba(`insert into public.peta_akses_pos (sumber, kunci, peran_pos, cakupan) values ('form', 'kebersihan', 'manager', 'semua')`);
  cek('non-admin tidak bisa membaca/menulis peta_akses_pos', bacaPeta.ok && bacaPeta.rows[0].n === 0 && !tulisPeta.ok, { baca: bacaPeta.rows?.[0], tulis: tulisPeta.err });
  await sebagai(uji6);
  const owner = await coba(`insert into public.peta_akses_pos (sumber, kunci, peran_pos, cakupan) values ('form', 'hrd', 'owner', 'semua')`);
  const akuntan = await coba(`insert into public.peta_akses_pos (sumber, kunci, peran_pos, cakupan) values ('form', 'hrd', 'accountant', 'semua')`);
  cek('peta tidak bisa memberi owner atau accountant, bahkan oleh Admin', !owner.ok && !akuntan.ok, { owner: owner.err, akuntan: akuntan.err });

  await sebagaiOwner();
  const bestie = (await q(`select diabaikan, form_akses, outlet_id from public.outlet_pos_map where pos_outlet_id = $1`, [POS.bestie])).rows[0];
  cek('Bestie Thrift: tetap dikecualikan dari sinkron omzet (diabaikan), diberikan lewat form thrifting',
    bestie.diabaikan === true && bestie.form_akses === 'thrifting' && bestie.outlet_id === null, bestie);
  const ditandai = (await q(`select u.email from public.profile p join auth.users u on u.id = p.id where p.punya_akses_pos order by 1`)).rows.map((r) => r.email);
  console.log(`punya_akses_pos (di dalam transaksi uji): ${ditandai.join(', ')}`);
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
