#!/usr/bin/env node
// Uji Masalah 1 (Riwayat/"Laporan Saya", 24 Agustus 2026). DB sungguhan,
// penyamaran RLS, BEGIN...ROLLBACK.
//
//  1. Laporan TERKIRIM milik sendiri, dalam 30 hari, muncul di query riwayat.
//  2. Laporan DRAFT milik sendiri TIDAK muncul (cuma yang benar-benar dikirim).
//  3. Laporan lebih dari 30 hari lalu TIDAK muncul.
//  4. Query "detail" (author_id = diri sendiri, eksplisit) TIDAK menemukan
//     laporan MILIK ORANG LAIN walau role Pusat -- RLS `can_see_report()`
//     SEBENARNYA mengizinkan Pusat baca laporan itu, tapi "Laporan Saya"
//     sengaja dipersempit lagi di query sendiri (bukan cuma andalkan RLS).
//  5. Lampiran laporan sendiri ikut kebaca lewat query attachment biasa.

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

  langkah('SETUP -- Toyib: 1 laporan terkirim (dalam 30 hari + lampiran), 1 draft, 1 laporan 40 hari lalu; Pusat: 1 laporan sendiri');
  const { rows: toyibRows } = await q(`select id from profile where nama='Toyib';`);
  const toyib = toyibRows[0].id;
  const pusat = await buatProfilSementara('Pusat Uji Riwayat', ['pusat']);

  const { rows: rTerkirim } = await q(
    `insert into report (form_key, tanggal, author_id, status, submitted_at, data) values
     ('personal_marketing', (now() at time zone 'Asia/Jakarta')::date, $1, 'terkirim', now(), '{"undang_jumlah": 3}'::jsonb) returning id;`,
    [toyib],
  );
  await q(
    `insert into attachment (report_id, field_key, path, mime) values ($1, 'undang', 'x/y/z.jpg', 'image/jpeg');`,
    [rTerkirim[0].id],
  );
  await q(
    `insert into report (form_key, tanggal, author_id, status, data) values
     ('personal_marketing', (now() at time zone 'Asia/Jakarta')::date - 1, $1, 'draft', '{}'::jsonb);`,
    [toyib],
  );
  await q(
    `insert into report (form_key, tanggal, author_id, status, submitted_at, data) values
     ('personal_marketing', (now() at time zone 'Asia/Jakarta')::date - 40, $1, 'terkirim', now() - interval '40 days', '{}'::jsonb);`,
    [toyib],
  );
  const { rows: rPusat } = await q(
    `insert into report (form_key, tanggal, author_id, status, submitted_at, data) values
     ('personal_marketing', (now() at time zone 'Asia/Jakarta')::date, $1, 'terkirim', now(), '{}'::jsonb) returning id;`,
    [pusat],
  );

  await q('set local role authenticated;');
  await jadiSebagai(toyib);

  langkah('UJI 1/2/3 -- query "riwayat saya" Toyib: terkirim dalam 30 hari MUNCUL, draft TIDAK, 40 hari lalu TIDAK');
  const batas = new Date();
  batas.setUTCDate(batas.getUTCDate() - 30);
  const batasStr = batas.toISOString().slice(0, 10);
  const { rows: riwayatToyib } = await q(
    `select id, tanggal, status from report
     where author_id = $1 and status <> 'draft' and tanggal >= $2::date
     order by tanggal desc, submitted_at desc;`,
    [toyib, batasStr],
  );
  cek(riwayatToyib.some((r) => r.id === rTerkirim[0].id), 'laporan terkirim dalam 30 hari MUNCUL di riwayat');
  cek(riwayatToyib.every((r) => r.status !== 'draft'), 'tidak ada baris berstatus draft yang ikut muncul');
  cek(riwayatToyib.length === 1, `cuma 1 baris (laporan 40 hari lalu tersaring) -- dapat ${riwayatToyib.length}`);

  langkah('UJI 4 -- Pusat coba "detail" laporan Toyib lewat query ber-author_id=diri-sendiri -- TIDAK ditemukan (dipersempit di luar RLS)');
  await jadiSebagai(pusat);
  const { rows: detailSalahOrang } = await q(
    `select id from report where id = $1 and author_id = $2;`,
    [rTerkirim[0].id, pusat],
  );
  cek(detailSalahOrang.length === 0, 'query "detail Laporan Saya" Pusat TIDAK menemukan laporan Toyib walau RLS aslinya mengizinkan Pusat membacanya');
  const { rows: detailSendiri } = await q(`select id from report where id = $1 and author_id = $2;`, [rPusat[0].id, pusat]);
  cek(detailSendiri.length === 1, 'tapi Pusat TETAP bisa lihat laporannya sendiri lewat query yang sama');

  langkah('UJI 5 -- lampiran laporan Toyib kebaca lewat query attachment biasa (sebagai Toyib)');
  await jadiSebagai(toyib);
  const { rows: lampiranToyib } = await q(`select field_key, path from attachment where report_id = $1;`, [rTerkirim[0].id]);
  cek(lampiranToyib.length === 1 && lampiranToyib[0].field_key === 'undang', `lampiran terbaca benar (dapat ${JSON.stringify(lampiranToyib)})`);

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
