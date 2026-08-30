#!/usr/bin/env node
// Uji RPC setujui_privasi_presensi() (migrasi 0030). Pola sama skrip lain
// sesi ini: pg.Client satu sesi, BEGIN/ROLLBACK.

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
    declare id_toyib uuid := (select id from auth.users where email='toyib@koperumnas.local');
    begin
      update public.profile set persetujuan_privasi_absen_at = null where id = id_toyib;
      perform set_config('uji.id_toyib', id_toyib::text, true);
    end $$;
  `);
  await q(`select set_config('role', 'authenticated', true);`);

  const s1 = await jadiSebagai('uji.id_toyib');
  const r0 = await q(`select persetujuan_privasi_absen_at from public.profile where id = current_setting('uji.id_toyib')::uuid;`);
  catat(1, 'toyib: profile.persetujuan_privasi_absen_at sebelum RPC', 'null', `auth.uid()=${s1}; ${JSON.stringify(r0.rows[0])}`, r0.rows[0].persetujuan_privasi_absen_at === null);

  await q(`select public.setujui_privasi_presensi();`);
  const r1 = await q(`select persetujuan_privasi_absen_at from public.profile where id = current_setting('uji.id_toyib')::uuid;`);
  catat(2, 'toyib: panggil setujui_privasi_presensi() pertama kali', 'terisi timestamp', JSON.stringify(r1.rows[0]), r1.rows[0].persetujuan_privasi_absen_at !== null);

  const waktuPertama = r1.rows[0].persetujuan_privasi_absen_at;
  await q(`select pg_sleep(1);`);
  await q(`select public.setujui_privasi_presensi();`);
  const r2 = await q(`select persetujuan_privasi_absen_at from public.profile where id = current_setting('uji.id_toyib')::uuid;`);
  catat(
    3,
    'toyib: panggil setujui_privasi_presensi() KEDUA kali (idempoten)',
    'waktu TIDAK berubah dari panggilan pertama',
    `pertama=${waktuPertama}; kedua=${r2.rows[0].persetujuan_privasi_absen_at}`,
    new Date(r2.rows[0].persetujuan_privasi_absen_at).getTime() === new Date(waktuPertama).getTime(),
  );

  // #4 -- toyib coba insert waktu palsu (mundur) LANGSUNG lewat update biasa -- boleh (bukan gap sekelas divisi/aktif, tapi dicek supaya tercatat sengaja)
  const r4 = await q(`update public.profile set persetujuan_privasi_absen_at = '2020-01-01' where id = auth.uid() returning persetujuan_privasi_absen_at;`);
  catat(
    4,
    'toyib: update langsung (bukan RPC) ke tanggal mundur -- dicek, BUKAN diblokir (keputusan sadar, lihat komentar migrasi 0030)',
    'berhasil (kolom ini tidak dijaga trigger, beda kelas dari divisi/aktif)',
    JSON.stringify(r4.rows[0]),
    r4.rows[0].persetujuan_privasi_absen_at !== null,
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
const semuaLolos = hasil.length === 4 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
