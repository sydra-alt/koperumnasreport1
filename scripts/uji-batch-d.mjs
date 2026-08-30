#!/usr/bin/env node
// Uji Batch D (nav + Task 14 sebagian + Task 15 penuh) langsung ke DB, pola
// sama dengan uji-checkpoint2.mjs / uji-task13.mjs. SEKALI PAKAI, dibungkus
// BEGIN...ROLLBACK -- tidak ada yang tersimpan.
//
// Fokus: (1) security scope lokasi+shift -- satu lokasi bisa >1 laporan
// sehari kalau shift beda; (2) blok keputusan CEO generik jalan utk form
// SELAIN pic_lokasi juga (dicoba pakai laporan 'hrd').

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL tidak ada di .env.local');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl });
function q(sql, params) {
  return client.query(sql, params);
}
async function jadiSebagai(uuid) {
  await q(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, true);`, [uuid]);
  const r = await q('select auth.uid() as siapa;');
  if (r.rows[0].siapa !== uuid) throw new Error(`Penyamaran gagal: auth.uid()=${r.rows[0].siapa}, harusnya ${uuid}`);
}
function langkah(judul) {
  console.log(`\n── ${judul} ──`);
}

try {
  await client.connect();
  await q('begin;');
  await q(`set local role postgres;`);

  langkah('SETUP — cari Kasam (security/DTI/pagi) & Sabrina (hrd)');
  const { rows: kasamRows } = await q(`select id from profile where nama = 'Kasam';`);
  const { rows: sabrinaRows } = await q(`select id from profile where nama = 'Sabrina';`);
  if (kasamRows.length !== 1 || sabrinaRows.length !== 1) throw new Error('Akun Kasam/Sabrina tidak ditemukan.');
  const kasam = kasamRows[0].id;
  const sabrina = sabrinaRows[0].id;
  const { rows: dtiRows } = await q(`select id from lokasi where nama = 'DTI';`);
  const dti = dtiRows[0].id;
  const { rows: shiftRows } = await q(`select id, nama from shift where nama in ('Pagi', 'Malam');`);
  const shiftPagi = shiftRows.find((s) => s.nama === 'Pagi').id;
  const shiftMalam = shiftRows.find((s) => s.nama === 'Malam').id;
  console.log(`Kasam=${kasam}  Sabrina=${sabrina}  DTI=${dti}  shiftPagi=${shiftPagi}  shiftMalam=${shiftMalam}`);

  langkah('SETUP — pastikan assignment asli Kasam (security/DTI/pagi) ada, tambah shift malam sementara (shift_id, migrasi 0033)');
  const { rows: asgAsli } = await q(
    `select shift_id from assignment where user_id=$1 and form_key='security' and lokasi_id=$2;`,
    [kasam, dti],
  );
  console.log('Assignment security Kasam saat ini:', asgAsli.map((r) => r.shift_id));
  await q(
    `insert into assignment (user_id, form_key, lokasi_id, shift_id) values ($1, 'security', $2, $3)
     on conflict do nothing;`,
    [kasam, dti, shiftMalam],
  );
  const { rows: asgSetelah } = await q(
    `select shift_id from assignment where user_id=$1 and form_key='security' and lokasi_id=$2 order by shift_id;`,
    [kasam, dti],
  );
  console.log(
    asgSetelah.length === 2 ? 'OK: Kasam sekarang punya 2 shift (pagi + malam) di DTI' : `SALAH: shift_id = ${JSON.stringify(asgSetelah)}`,
  );

  langkah('UJI 1 — sebagai Kasam, kirim laporan security shift PAGI dan MALAM di DTI hari yang sama');
  await q(`set local role authenticated;`);
  await jadiSebagai(kasam);

  const { rows: rPagi } = await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, shift_id, data, status, warna, submitted_at)
     values ('security', (now() at time zone 'Asia/Jakarta')::date, $1, $2, $3, '{"satpam_hadir":2}', 'terkirim', 'hijau', now())
     returning id;`,
    [kasam, dti, shiftPagi],
  );
  const { rows: rMalam } = await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, shift_id, data, status, warna, submitted_at)
     values ('security', (now() at time zone 'Asia/Jakarta')::date, $1, $2, $3, '{"satpam_hadir":1}', 'terkirim', 'hijau', now())
     returning id;`,
    [kasam, dti, shiftMalam],
  );
  console.log(
    rPagi.length === 1 && rMalam.length === 1
      ? 'OK: 2 baris report (shift pagi & malam) berhasil dibuat, tidak bentrok report_uniq (kunci shift_id, migrasi 0033)'
      : 'SALAH: gagal membuat salah satu baris',
  );

  const { rows: cekDua } = await q(
    `select shift_id from report where form_key='security' and author_id=$1 and lokasi_id=$2
     and tanggal=(now() at time zone 'Asia/Jakarta')::date order by shift_id;`,
    [kasam, dti],
  );
  console.log(
    cekDua.length === 2 ? 'OK: 2 laporan security terpisah hari ini utk Kasam di DTI' : `SALAH: jumlah = ${cekDua.length}`,
  );

  langkah('UJI 2 — blok keputusan CEO generik: coba dari laporan HRD (bukan pic_lokasi)');
  await jadiSebagai(sabrina);
  const { rows: rHrdBenar } = await q(
    `insert into report (form_key, tanggal, author_id, data, status, warna, submitted_at)
     values ('hrd', (now() at time zone 'Asia/Jakarta')::date, $1,
             '{"keputusan_ceo": true, "keputusan_ceo_judul": "Rekrut 2 satpam baru", "masalah_utama": "Kurang satpam"}',
             'terkirim', 'hijau', now())
     returning id;`,
    [sabrina],
  );
  console.log(rHrdBenar.length === 1 ? 'OK: laporan HRD (Sabrina) berhasil dibuat' : 'SALAH: gagal membuat laporan HRD');
  const hrdReportId = rHrdBenar[0].id;

  const { rows: decHrd } = await q(
    `insert into decision (report_id, judul, masalah) values ($1, $2, $3) returning id, status;`,
    [hrdReportId, 'Rekrut 2 satpam baru', 'Kurang satpam'],
  );
  console.log(
    decHrd.length === 1 && decHrd[0].status === 'menunggu'
      ? 'OK: baris decision dari laporan HRD (bukan pic_lokasi) berhasil dibuat, status menunggu -- blok keputusan CEO memang generik, tidak per-formKey'
      : `SALAH: ${JSON.stringify(decHrd)}`,
  );

  await q('rollback;');
  console.log('\n=== SELESAI, semua perubahan di-ROLLBACK -- tidak ada yang tersimpan. ===');
} catch (err) {
  await q('rollback;').catch(() => {});
  console.error('GAGAL:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
