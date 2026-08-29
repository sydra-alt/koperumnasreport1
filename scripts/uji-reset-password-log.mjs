#!/usr/bin/env node
// Uji RLS reset_password_log (0021_reset_password_log.sql) -- dipakai fitur
// "Atur ulang kata sandi" di halaman Admin, dibangun pra-peluncuran karena
// tidak ada alur "lupa password" mandiri (docs/07-CATATAN-PELUNCURAN.md).
// Pola sama seperti skrip uji lain sesi ini: pg.Client satu sesi, BEGIN/
// ROLLBACK, auth.uid() dicek ulang tiap ganti persona.

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

try {
  await client.connect();
  await q('begin;');

  await q(`
    do $$
    declare
      id_putri uuid := (select id from auth.users where email='putri@koperumnas.local');
      id_toyib uuid := (select id from auth.users where email='toyib@koperumnas.local');
      log_id uuid := gen_random_uuid();
    begin
      insert into public.reset_password_log (id, actor_id, target_id)
      values (log_id, id_putri, id_toyib);
      perform set_config('uji.id_putri', id_putri::text, true);
      perform set_config('uji.id_toyib', id_toyib::text, true);
    end $$;
  `);
  await q(`select set_config('role', 'authenticated', true);`);

  // Toyib (karyawan biasa) -- harap 0 baris
  const sToyib = await jadiSebagai('uji.id_toyib');
  const rToyib = await q(`select count(*)::int as n from public.reset_password_log;`);
  hasil.push({
    skenario: 'karyawan biasa (toyib) select reset_password_log',
    harapan: '0 baris',
    mentah: `auth.uid()=${sToyib}; n=${rToyib.rows[0].n}`,
    lolos: sToyib !== null && rToyib.rows[0].n === 0,
  });

  // Putri (ceo) -- harap >= 1 baris
  const sPutri = await jadiSebagai('uji.id_putri');
  const rPutri = await q(`select count(*)::int as n from public.reset_password_log;`);
  hasil.push({
    skenario: 'ceo (putri) select reset_password_log',
    harapan: '>= 1 baris',
    mentah: `auth.uid()=${sPutri}; n=${rPutri.rows[0].n}`,
    lolos: sPutri !== null && rPutri.rows[0].n >= 1,
  });

  // Toyib coba insert langsung (bukan lewat service_role) -- harap ditolak
  const s3 = await jadiSebagai('uji.id_toyib');
  await q(`
    do $$
    begin
      insert into public.reset_password_log (actor_id, target_id)
      values (current_setting('uji.id_toyib')::uuid, current_setting('uji.id_toyib')::uuid);
      perform set_config('uji.h3', 'LOLOS_SALAH: insert langsung berhasil', true);
    exception when others then
      perform set_config('uji.h3', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h3 = (await q(`select current_setting('uji.h3') as h;`)).rows[0].h;
  hasil.push({
    skenario: 'karyawan biasa insert langsung ke reset_password_log (bukan lewat service_role)',
    harapan: 'ditolak (tidak ada policy insert untuk authenticated)',
    mentah: `auth.uid()=${s3}; ${h3}`,
    lolos: s3 !== null && h3.startsWith('DITOLAK_BENAR'),
  });
} catch (err) {
  console.error('ERROR:', err.message);
  hasil.push({ skenario: 'eksekusi skrip', harapan: '-', mentah: err.message, lolos: false });
} finally {
  await q('rollback;').catch(() => {});
  await client.end();
}

console.table(hasil.map((h) => ({ skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.length === 3 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
