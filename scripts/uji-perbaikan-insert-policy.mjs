#!/usr/bin/env node
// Uji perbaikan celah RLS insert (migrasi 0027) -- decision & absensi.
// Pola sama skrip lain sesi ini: pg.Client satu sesi, BEGIN/ROLLBACK.
// Fokus: (a) pemalsuan kolom keputusan pihak lain saat insert DITOLAK,
// (b) insert wajar (persis yang dikirim app) TETAP berhasil -- perbaikan
// tidak boleh merusak jalur pakai yang sah.

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
      id_toyib   uuid := (select id from auth.users where email='toyib@koperumnas.local');
      titik_id   uuid := (select id from lokasi_absen limit 1);
      report_id  uuid;
    begin
      insert into public.report (id, form_key, tanggal, author_id, status)
      values (gen_random_uuid(), 'personal_marketing', current_date, id_toyib, 'terkirim')
      returning id into report_id;

      perform set_config('uji.id_toyib', id_toyib::text, true);
      perform set_config('uji.titik_id', titik_id::text, true);
      perform set_config('uji.report_id', report_id::text, true);
    end $$;
  `);
  await q(`select set_config('role', 'authenticated', true);`);

  const s1 = await jadiSebagai('uji.id_toyib');

  // #1 -- decision: toyib coba insert LANGSUNG status='disetujui' + decided_by dirinya sendiri -- harus ditolak
  await q(`
    do $$
    begin
      insert into public.decision (report_id, judul, status, decided_by, decided_at)
      values (current_setting('uji.report_id')::uuid, 'coba palsu', 'disetujui', current_setting('uji.id_toyib')::uuid, now());
      perform set_config('uji.h1', 'LOLOS_SALAH: insert status disetujui berhasil', true);
    exception when others then
      perform set_config('uji.h1', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h1 = (await q(`select current_setting('uji.h1') as h;`)).rows[0].h;
  catat(1, "decision: toyib insert langsung status='disetujui' + decided_by dirinya", 'ditolak', `auth.uid()=${s1}; ${h1}`, h1.startsWith('DITOLAK_BENAR'));

  // #2 -- decision: insert WAJAR (persis buatKeputusanDariLaporan -- tanpa status/decided_by/decided_at) -- harus berhasil
  const r2 = await q(`
    insert into public.decision (report_id, judul, masalah, nominal, urgensi)
    values (current_setting('uji.report_id')::uuid, 'keputusan wajar', 'masalah uji', 500000, 2)
    returning status, decided_by, decided_at;
  `);
  catat(
    2,
    'decision: insert wajar tanpa status/decided_by/decided_at (persis buatKeputusanDariLaporan)',
    "berhasil, status default 'menunggu'",
    JSON.stringify(r2.rows[0]),
    r2.rows[0].status === 'menunggu' && r2.rows[0].decided_by === null && r2.rows[0].decided_at === null,
  );

  // #3 -- absensi: toyib coba insert LANGSUNG keputusan_hrd='diterima' + disetujui_oleh dirinya -- harus ditolak
  await q(`
    do $$
    begin
      insert into public.absensi (user_id, tanggal, tipe, lokasi_absen_id, status, foto_path, keputusan_hrd, disetujui_oleh)
      values (current_setting('uji.id_toyib')::uuid, current_date, 'masuk', current_setting('uji.titik_id')::uuid, 'di_luar_radius', 'uji/x.jpg', 'diterima', current_setting('uji.id_toyib')::uuid);
      perform set_config('uji.h3', 'LOLOS_SALAH: insert keputusan_hrd berhasil', true);
    exception when others then
      perform set_config('uji.h3', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h3 = (await q(`select current_setting('uji.h3') as h;`)).rows[0].h;
  catat(3, "absensi: toyib insert langsung keputusan_hrd='diterima' + disetujui_oleh dirinya", 'ditolak', `${h3}`, h3.startsWith('DITOLAK_BENAR'));

  // #4 -- absensi: toyib coba insert status='manual_hrd' (belum ada jalur UI-nya) -- harus ditolak
  await q(`
    do $$
    begin
      insert into public.absensi (user_id, tanggal, tipe, lokasi_absen_id, status, foto_path)
      values (current_setting('uji.id_toyib')::uuid, current_date, 'pulang', current_setting('uji.titik_id')::uuid, 'manual_hrd', 'uji/y.jpg');
      perform set_config('uji.h4', 'LOLOS_SALAH: insert manual_hrd berhasil', true);
    exception when others then
      perform set_config('uji.h4', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h4 = (await q(`select current_setting('uji.h4') as h;`)).rows[0].h;
  catat(4, "absensi: toyib insert langsung status='manual_hrd' (belum ada jalur UI)", 'ditolak', `${h4}`, h4.startsWith('DITOLAK_BENAR'));

  // #5 -- absensi: insert WAJAR (persis useKirimAbsen -- status valid, tanpa keputusan_hrd/disetujui_oleh) -- harus berhasil
  const r5 = await q(`
    insert into public.absensi (user_id, tanggal, tipe, lokasi_absen_id, status, foto_path, jarak_meter)
    values (current_setting('uji.id_toyib')::uuid, current_date, 'masuk', current_setting('uji.titik_id')::uuid, 'valid', 'uji/z.jpg', 15)
    returning status, keputusan_hrd, disetujui_oleh;
  `);
  catat(
    5,
    "absensi: insert wajar status='valid' tanpa keputusan_hrd/disetujui_oleh (persis useKirimAbsen)",
    'berhasil, keputusan_hrd & disetujui_oleh null',
    JSON.stringify(r5.rows[0]),
    r5.rows[0].status === 'valid' && r5.rows[0].keputusan_hrd === null && r5.rows[0].disetujui_oleh === null,
  );
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
