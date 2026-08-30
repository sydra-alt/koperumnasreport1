#!/usr/bin/env node
// Bukti eksplisit diminta user (30 Agustus 2026) setelah form `ita` dipecah
// jadi `thrifting`+`kontrol_fnb` (migrasi 0036): selisih_resto_untuk_tanggal()
// harus TETAP mendeteksi selisih omzet dengan benar sekarang laporannya
// join langsung by outlet_id (bukan lagi cari kunci JSON di satu laporan
// global). Dua uji:
//   1. Satu outlet, omzet manager_resto vs kontrol_fnb dibedakan sengaja
//      Rp50.000 -- selisih harus terdeteksi TEPAT Rp50.000.
//   2. TIGA outlet sekaligus, masing-masing selisih BEDA -- membuktikan
//      tidak ada yang tertukar antar outlet (risiko paling mungkin salah
//      setelah pemecahan ini, karena sekarang ada BANYAK baris kontrol_fnb
//      per hari, bukan satu laporan ita global lagi).

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

  const toyib = (await client.query(`select id from auth.users where email='toyib@koperumnas.local';`)).rows[0].id;
  const outletRows = (
    await client.query(`select id, nama, slug from public.outlet order by slug;`)
  ).rows;
  const indokopi = outletRows.find((o) => o.slug === 'indokopi_jatinegara');
  const cempaka = outletRows.find((o) => o.slug === 'indosteak_cempaka');
  const pekansari = outletRows.find((o) => o.slug === 'indosteak_pekansari');

  // ═══ UJI 1 -- SATU outlet (Indokopi Jatinegara), selisih sengaja Rp50.000 ═══
  await client.query(
    `insert into public.report (form_key, tanggal, author_id, outlet_id, status, data) values
     ('manager_resto', current_date, $1, $2, 'terkirim', jsonb_build_object('total_omzet', 2000000));`,
    [toyib, indokopi.id],
  );
  await client.query(
    `insert into public.report (form_key, tanggal, author_id, outlet_id, status, data) values
     ('kontrol_fnb', current_date, $1, $2, 'terkirim', jsonb_build_object('omzet_sistem', 1950000));`,
    [toyib, indokopi.id],
  );
  const r1 = await client.query(`select outlet, versi_manager, versi_kontrol_fnb, selisih from public.selisih_resto_untuk_tanggal() where outlet = $1;`, [indokopi.nama]);
  catat(
    1,
    `selisih_resto_untuk_tanggal(): ${indokopi.nama} -- 1 pasang laporan, selisih sengaja Rp50.000`,
    'versi_manager=2.000.000, versi_kontrol_fnb=1.950.000, selisih=50.000',
    JSON.stringify(r1.rows[0]),
    Number(r1.rows[0]?.versi_manager) === 2000000 && Number(r1.rows[0]?.versi_kontrol_fnb) === 1950000 && Number(r1.rows[0]?.selisih) === 50000,
  );

  // ═══ UJI 2 -- TIGA outlet sekaligus, selisih BERBEDA-BEDA -- buktikan tidak tertukar ═══
  // Indokopi sudah ditanam di atas (selisih 50.000). Tambah Cempaka & Pekansari dengan pola beda.
  await client.query(
    `insert into public.report (form_key, tanggal, author_id, outlet_id, status, data) values
     ('manager_resto', current_date, $1, $2, 'terkirim', jsonb_build_object('total_omzet', 5000000)),
     ('kontrol_fnb',   current_date, $1, $2, 'terkirim', jsonb_build_object('omzet_sistem', 5000000));`, // Cempaka: SAMA PERSIS, selisih 0
    [toyib, cempaka.id],
  );
  await client.query(
    `insert into public.report (form_key, tanggal, author_id, outlet_id, status, data) values
     ('manager_resto', current_date, $1, $2, 'terkirim', jsonb_build_object('total_omzet', 3000000)),
     ('kontrol_fnb',   current_date, $1, $2, 'terkirim', jsonb_build_object('omzet_sistem', 3300000));`, // Pekansari: kontrol_fnb LEBIH BESAR, selisih -300.000
    [toyib, pekansari.id],
  );

  const r2 = await client.query(`select outlet, versi_manager, versi_kontrol_fnb, selisih from public.selisih_resto_untuk_tanggal() order by outlet;`);
  const baris = r2.rows;
  catat(2, 'jumlah baris = tepat 3 outlet (tidak ada yang hilang/dobel)', '3 baris', `${baris.length} baris`, baris.length === 3);

  const cek = (nama, versiManager, versiKontrolFnb, selisih) => {
    const b = baris.find((x) => x.outlet === nama);
    const ok = b && Number(b.versi_manager) === versiManager && Number(b.versi_kontrol_fnb) === versiKontrolFnb && Number(b.selisih) === selisih;
    catat(nama, `${nama}: versi_manager/versi_kontrol_fnb/selisih TIDAK tertukar dengan outlet lain`, `manager=${versiManager}, kontrol_fnb=${versiKontrolFnb}, selisih=${selisih}`, JSON.stringify(b), ok);
  };
  cek(indokopi.nama, 2000000, 1950000, 50000);
  cek(cempaka.nama, 5000000, 5000000, 0);
  cek(pekansari.nama, 3000000, 3300000, -300000);
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
const semuaLolos = hasil.length === 5 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS -- selisih_resto benar per outlet, tidak tertukar' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
