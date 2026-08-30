#!/usr/bin/env node
// Bukti eksplisit diminta user (30 Agustus 2026): ganti nama shift "Pagi"
// jadi "Shift Pagi" (persis yang akan dilakukan tombol Simpan di Admin ->
// Kelola Shift, useUbahShift() -- lib/api/admin.ts), lalu tunjukkan
// assignment/report LAMA Kasam (security/DTI/pagi, dibuat SEBELUM rename)
// tetap menunjuk shift yang benar lewat shift_id -- INI INTI KENAPA uuid FK
// dipilih ketimbang FK ke shift.nama (teks). Dibungkus BEGIN...ROLLBACK
// seperti semua uji lain sesi ini -- pembuktian mekanisme, bukan perubahan
// permanen ke nama shift produksi.

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

try {
  await client.connect();
  await client.query('begin;');

  const kasam = (await client.query(`select id from profile where nama = 'Kasam';`)).rows[0].id;
  const dti = (await client.query(`select id from lokasi where nama = 'DTI';`)).rows[0].id;
  const shiftPagiId = (await client.query(`select id from shift where nama = 'Pagi';`)).rows[0].id;

  // #1 -- SEBELUM rename: assignment lama Kasam (dibuat migrasi 0033 lewat backfill) sudah menunjuk shift_id ini.
  const sebelum = await client.query(
    `select a.shift_id, s.nama as nama_shift_saat_ini from assignment a join shift s on s.id = a.shift_id
     where a.user_id = $1 and a.form_key = 'security' and a.lokasi_id = $2 and a.shift_id = $3;`,
    [kasam, dti, shiftPagiId],
  );
  catat(1, 'assignment lama Kasam (backfill migrasi 0033) menunjuk shift_id "Pagi" SEBELUM rename', "nama_shift_saat_ini='Pagi'", JSON.stringify(sebelum.rows[0]), sebelum.rows[0]?.nama_shift_saat_ini === 'Pagi');

  // Tanam SATU laporan security "lama" (persis laporan sungguhan Kasam yang sudah ada) memakai shift_id yang SAMA.
  const laporanLama = await client.query(
    `insert into report (form_key, tanggal, author_id, lokasi_id, shift_id, status, data)
     values ('security', current_date - 30, $1, $2, $3, 'terkirim', '{"satpam_hadir":1}'::jsonb)
     returning id, shift_id;`,
    [kasam, dti, shiftPagiId],
  );
  catat(2, 'laporan security "lama" (30 hari lalu) Kasam ditanam dgn shift_id "Pagi"', '1 baris, shift_id = id shift Pagi', JSON.stringify(laporanLama.rows[0]), laporanLama.rows[0].shift_id === shiftPagiId);

  // #3 -- RENAME: persis apa yang tombol Simpan Admin->Kelola Shift lakukan (useUbahShift -> update shift set nama=...).
  const setelahRename = await client.query(`update shift set nama = 'Shift Pagi' where id = $1 returning id, nama;`, [shiftPagiId]);
  catat(3, "rename shift.nama 'Pagi' -> 'Shift Pagi' (persis useUbahShift(), Admin -> Kelola Shift)", "nama='Shift Pagi'", JSON.stringify(setelahRename.rows[0]), setelahRename.rows[0].nama === 'Shift Pagi');

  // #4 -- SETELAH rename: assignment LAMA Kasam TETAP menunjuk baris shift yang SAMA (shift_id tidak berubah), cuma namanya yang beda sekarang.
  const assignmentSetelah = await client.query(
    `select a.shift_id, s.nama as nama_shift_sekarang from assignment a join shift s on s.id = a.shift_id
     where a.user_id = $1 and a.form_key = 'security' and a.lokasi_id = $2 and a.shift_id = $3;`,
    [kasam, dti, shiftPagiId],
  );
  catat(
    4,
    'assignment LAMA Kasam SETELAH rename -- shift_id TIDAK BERUBAH, nama ikut ter-update otomatis lewat join',
    "shift_id sama persis, nama_shift_sekarang='Shift Pagi'",
    JSON.stringify(assignmentSetelah.rows[0]),
    assignmentSetelah.rows[0]?.shift_id === shiftPagiId && assignmentSetelah.rows[0]?.nama_shift_sekarang === 'Shift Pagi',
  );

  // #5 -- laporan LAMA (30 hari lalu, ditanam SEBELUM rename) SETELAH rename -- masih menunjuk shift yang benar, bukan orphan/salah.
  const laporanSetelah = await client.query(
    `select r.shift_id, s.nama as nama_shift_sekarang from report r join shift s on s.id = r.shift_id where r.id = $1;`,
    [laporanLama.rows[0].id],
  );
  catat(
    5,
    'laporan LAMA Kasam (ditanam SEBELUM rename) SETELAH rename -- shift_id tetap sama, resolve ke nama baru dgn benar',
    "shift_id sama, nama_shift_sekarang='Shift Pagi'",
    JSON.stringify(laporanSetelah.rows[0]),
    laporanSetelah.rows[0]?.shift_id === shiftPagiId && laporanSetelah.rows[0]?.nama_shift_sekarang === 'Shift Pagi',
  );

  console.log('\n>>> INI YANG TIDAK AKAN TERJADI kalau FK-nya ke shift.nama (teks) alih-alih shift.id (uuid): <<<');
  console.log('>>> Baris assignment/report lama TIDAK PERNAH menyimpan ulang string "Pagi" -- mereka menyimpan UUID.');
  console.log('>>> Rename di atas HANYA mengubah SATU baris (shift.nama), dan SEMUA histori otomatis ikut, tanpa UPDATE massal apa pun ke assignment/report.');
} catch (err) {
  console.error('ERROR TAK TERDUGA:', err.message);
  catat('(error)', 'eksekusi skrip', '-', err.message, false);
} finally {
  try {
    await client.query('rollback;');
    console.log('\n(ROLLBACK -- rename "Shift Pagi" DIBATALKAN, shift.nama produksi tetap "Pagi", tidak ada perubahan permanen)');
  } catch (e) {
    console.error('Gagal rollback:', e.message);
  }
  await client.end();
}

console.table(hasil.map((h) => ({ '#': h.nomor, skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.length === 5 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS -- BUKTI: shift_id (uuid) bertahan lintas rename nama' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
