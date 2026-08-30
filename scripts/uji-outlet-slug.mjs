#!/usr/bin/env node
// Uji selisih_resto_untuk_tanggal() setelah Indosteak jadi dua outlet
// (migrasi 0031). Menanam laporan manager_resto + ita palsu untuk KETIGA
// outlet, cek angka versi_manager/versi_ita/selisih cocok lewat outlet.slug
// (bukan lower(nama) lama, yang akan salah untuk nama berspasi).

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

  await client.query(`
    do $$
    declare
      id_toyib uuid := (select id from auth.users where email='toyib@koperumnas.local');
      o_indokopi uuid := (select id from public.outlet where slug='indokopi_jatinegara');
      o_cempaka  uuid := (select id from public.outlet where slug='indosteak_cempaka');
      o_pekansari uuid := (select id from public.outlet where slug='indosteak_pekansari');
    begin
      insert into public.report (form_key, tanggal, author_id, outlet_id, status, data) values
        ('manager_resto', current_date, id_toyib, o_indokopi,  'terkirim', jsonb_build_object('total_omzet', 1000000)),
        ('manager_resto', current_date, id_toyib, o_cempaka,   'terkirim', jsonb_build_object('total_omzet', 2000000)),
        ('manager_resto', current_date, id_toyib, o_pekansari, 'terkirim', jsonb_build_object('total_omzet', 3000000));

      insert into public.report (form_key, tanggal, author_id, status, data) values
        ('ita', current_date, id_toyib, 'terkirim', jsonb_build_object(
          'omzet_indokopi_jatinegara', 1000000,
          'omzet_indosteak_cempaka', 1950000,
          'omzet_indosteak_pekansari', 3000000
        ));
    end $$;
  `);

  const r = await client.query(`select outlet, versi_manager, versi_ita, selisih from public.selisih_resto_untuk_tanggal() order by outlet;`);
  const baris = r.rows;

  const cek = (nama, versiManagerHarap, versiItaHarap, selisihHarap) => {
    const b = baris.find((x) => x.outlet === nama);
    const ok = b && Number(b.versi_manager) === versiManagerHarap && Number(b.versi_ita) === versiItaHarap && Number(b.selisih) === selisihHarap;
    catat(nama, `selisih_resto_untuk_tanggal(): ${nama}`, `manager=${versiManagerHarap}, ita=${versiItaHarap}, selisih=${selisihHarap}`, JSON.stringify(b), ok);
  };

  cek('Indokopi Jatinegara', 1000000, 1000000, 0);
  cek('Indosteak Cempaka', 2000000, 1950000, 50000);
  cek('Indosteak Pekansari', 3000000, 3000000, 0);

  catat('jumlah', 'jumlah baris hasil (3 outlet, semua cocok, tidak ada yang tertukar/hilang)', '3 baris', `${baris.length} baris`, baris.length === 3);
} catch (err) {
  console.error('ERROR TAK TERDUGA:', err.message);
  catat('(error)', 'eksekusi skrip', '-', err.message, false);
} finally {
  try {
    await client.query('rollback;');
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
