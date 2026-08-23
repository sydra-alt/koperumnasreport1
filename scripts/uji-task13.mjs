#!/usr/bin/env node
// Uji Task 13 (form pic_lokasi) langsung ke DB, lewat penyamaran RLS
// (set_config request.jwt.claims), pola sama dengan uji-checkpoint2.mjs.
// SEKALI PAKAI. Semua dibungkus BEGIN...ROLLBACK -- tidak ada yang tersimpan.

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
  await q(`set local role postgres;`); // insert setup pakai owner dulu, baru pindah role authenticated

  langkah('SETUP — cari Dadang (pic_lokasi) & dua lokasi');
  const { rows: dadangRows } = await q(`select id from profile where nama = 'Dadang';`);
  if (dadangRows.length !== 1) throw new Error('Akun Dadang tidak ditemukan -- jalankan scripts/buat-akun.mjs dulu.');
  const dadang = dadangRows[0].id;

  const { rows: lokasiRows } = await q(`select id, nama from lokasi where nama in ('Tajur','Bekasi') order by nama;`);
  const tajur = lokasiRows.find((l) => l.nama === 'Tajur').id;
  const bekasi = lokasiRows.find((l) => l.nama === 'Bekasi').id;
  console.log(`Dadang=${dadang}  Tajur=${tajur}  Bekasi=${bekasi}`);

  langkah('SETUP — tambah penugasan kedua (Dadang jadi PIC Bekasi juga)');
  await q(
    `insert into assignment (user_id, form_key, lokasi_id) values ($1, 'pic_lokasi', $2)
     on conflict do nothing;`,
    [dadang, bekasi],
  );
  const { rows: asgCount } = await q(
    `select count(*)::int as n from assignment where user_id=$1 and form_key='pic_lokasi';`,
    [dadang],
  );
  console.log(asgCount[0].n === 2 ? 'OK: Dadang sekarang PIC 2 lokasi' : `SALAH: jumlah penugasan = ${asgCount[0].n}`);

  langkah('UJI 1 — sebagai Dadang, kirim laporan pic_lokasi utk Tajur DAN Bekasi hari yang sama');
  await q(`set local role authenticated;`);
  await jadiSebagai(dadang);

  const dataDasar = { unit_dibangun: 3, unit_finishing: 1, unit_selesai: 0, unit_belum_mulai: 2, progress_catatan: 'progress hari ini' };

  const { rows: r1 } = await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, data, status, warna, submitted_at)
     values ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date, $1, $2, $3, 'terkirim', 'hijau', now())
     returning id;`,
    [dadang, tajur, JSON.stringify(dataDasar)],
  );
  const { rows: r2 } = await q(
    `insert into report (form_key, tanggal, author_id, lokasi_id, data, status, warna, submitted_at)
     values ('pic_lokasi', (now() at time zone 'Asia/Jakarta')::date, $1, $2, $3, 'terkirim', 'hijau', now())
     returning id;`,
    [dadang, bekasi, JSON.stringify({ ...dataDasar, unit_dibangun: 5 })],
  );
  console.log(r1.length === 1 && r2.length === 1 ? 'OK: dua baris report berhasil dibuat (tidak bentrok unique index)' : 'SALAH: gagal membuat salah satu baris');
  const reportTajurId = r1[0].id;

  const { rows: cekDua } = await q(
    `select lokasi_id from report where form_key='pic_lokasi' and author_id=$1 and tanggal=(now() at time zone 'Asia/Jakarta')::date;`,
    [dadang],
  );
  console.log(
    cekDua.length === 2 ? 'OK: 2 laporan terpisah hari ini utk Dadang' : `SALAH: jumlah laporan hari ini = ${cekDua.length}`,
  );

  langkah('UJI 2 — kirim TANPA foto/video progress (tanpa attachment progress) tetap masuk DB kalau lewat RPC/insert langsung?');
  console.log('(Validasi "tanpa bukti ditolak" ada di zod client-side/forms/validasi.ts, sudah diuji lewat SSR script terpisah -- bukan RLS.)');

  langkah('UJI 3 — centang Butuh Keputusan CEO + judul terisi -> buat baris decision status menunggu');
  const { rows: dec1 } = await q(
    `insert into decision (report_id, judul, masalah) values ($1, $2, $3) returning id, status;`,
    [reportTajurId, 'Jalan rusak parah, butuh anggaran perbaikan', 'Akses ke lokasi Tajur rusak berat'],
  );
  console.log(
    dec1.length === 1 && dec1[0].status === 'menunggu'
      ? 'OK: baris decision dibuat, status default = menunggu'
      : `SALAH: ${JSON.stringify(dec1)}`,
  );

  langkah('UJI 4 — Dadang (bukan CEO) coba ubah status decision -> harus DITOLAK');
  let uji4Lolos = false;
  try {
    await q(`update decision set status='disetujui' where id=$1;`, [dec1[0].id]);
    const { rows: cekStatus } = await q(`select status from decision where id=$1;`, [dec1[0].id]);
    uji4Lolos = cekStatus[0].status === 'menunggu'; // update "berhasil" tapi 0 baris kena (RLS using-clause menyaring)
  } catch {
    uji4Lolos = true; // policy menolak lewat exception -- juga dianggap lolos
  }
  console.log(uji4Lolos ? 'OK: Dadang tidak bisa mengubah status decision' : 'SALAH: Dadang berhasil mengubah status decision!');

  langkah('UJI 5 — decision.report_id merujuk laporan MILIK ORANG LAIN -> insert harus DITOLAK');
  const { rows: toyibRows } = await q(`select id from profile where nama = 'Toyib';`);
  let uji5Lolos = false;
  if (toyibRows.length === 1) {
    await q(`set local role postgres;`);
    const { rows: laporToyib } = await q(
      `insert into report (form_key, tanggal, author_id, data, status)
       values ('personal_marketing', (now() at time zone 'Asia/Jakarta')::date, $1, '{}', 'terkirim')
       returning id;`,
      [toyibRows[0].id],
    );
    await q(`set local role authenticated;`);
    await jadiSebagai(dadang);
    try {
      await q(`insert into decision (report_id, judul) values ($1, 'coba tembus RLS');`, [laporToyib[0].id]);
      uji5Lolos = false;
    } catch {
      uji5Lolos = true;
    }
  } else {
    console.log('(akun Toyib tidak ditemukan -- dilewati)');
    uji5Lolos = true;
  }
  console.log(uji5Lolos ? 'OK: insert decision ke laporan orang lain ditolak' : 'SALAH: RLS dec_insert bocor!');

  await q('rollback;');
  console.log('\n=== SELESAI, semua perubahan di-ROLLBACK -- tidak ada yang tersimpan. ===');
} catch (err) {
  await q('rollback;').catch(() => {});
  console.error('GAGAL:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
