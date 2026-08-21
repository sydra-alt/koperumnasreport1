#!/usr/bin/env node
// Skrip uji CHECKPOINT 2 — matriks RLS di 04-CATATAN-TEKNIS.md §4.
// Versi terakhir yang disepakati: UJI #0 kontrol positif, sanity check
// auth.uid() di setiap blok, EXCEPTION tunggal dengan beberapa WHEN,
// GUC uji.* (bukan temp table), reset role sebelum anon.
//
// SEKALI PAKAI, bukan bagian dari perkakas umum: setiap langkah dijalankan
// satu-satu lewat client yang SAMA (sesi Postgres yang sama) supaya state
// role/GUC/transaksi konsisten -- pg.Client.query() dengan banyak statement
// dalam satu string cuma mengembalikan hasil statement TERAKHIR, jadi tidak
// bisa dipakai untuk menangkap hasil tiap baris uji satu per satu.
//
// Data dummy dibuat lalu SELALU di-ROLLBACK di akhir (di blok finally),
// apa pun hasilnya -- tidak ada yang tersimpan.

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
const hasilAkhir = []; // { nomor, skenario, harapan, mentah, lolos }

function q(sql) {
  return client.query(sql);
}

async function jadiSebagai(kunciUuid) {
  await q(
    `select set_config('request.jwt.claims', json_build_object('sub', current_setting('${kunciUuid}'), 'role','authenticated')::text, true);`,
  );
  const r = await q('select auth.uid() as siapa;');
  return r.rows[0].siapa;
}

function cetakLangkah(judul) {
  console.log(`\n── ${judul} ──`);
}

try {
  await client.connect();
  await q('begin;');

  // ═══ 0. Pastikan 7 akun ada ═══
  cetakLangkah('SETUP 0 — cek 7 akun ada');
  await q(`
    do $$
    declare hilang text;
    begin
      select string_agg(email, ', ') into hilang
      from (values ('putri@koperumnas.local'),('sabrina@koperumnas.local'),
                   ('accounting@koperumnas.local'),('dadang@koperumnas.local'),
                   ('fauzy@koperumnas.local'),('toyib@koperumnas.local'),
                   ('kasam@koperumnas.local')) as v(email)
      where not exists (select 1 from auth.users u where u.email = v.email);
      if hilang is not null then
        raise exception 'Akun belum ada di auth.users: %. Cek email persis sama.', hilang;
      end if;
    end $$;
  `);
  console.log('OK — 7 akun ada.');

  // ═══ 1. Data dummy + GUC id (masih admin) ═══
  cetakLangkah('SETUP 1 — data dummy + simpan id lewat GUC uji.*');
  await q(`
    do $$
    declare
      id_putri      uuid := (select id from auth.users where email='putri@koperumnas.local');
      id_sabrina    uuid := (select id from auth.users where email='sabrina@koperumnas.local');
      id_accounting uuid := (select id from auth.users where email='accounting@koperumnas.local');
      id_dadang     uuid := (select id from auth.users where email='dadang@koperumnas.local');
      id_fauzy      uuid := (select id from auth.users where email='fauzy@koperumnas.local');
      id_toyib      uuid := (select id from auth.users where email='toyib@koperumnas.local');
      id_kasam      uuid := (select id from auth.users where email='kasam@koperumnas.local');
      r_acc      uuid := gen_random_uuid();
      r_toyib    uuid := gen_random_uuid();
      r_dadang_kemarin uuid := gen_random_uuid();
      d_id       uuid := gen_random_uuid();
      hari_ini   date := (now() at time zone 'Asia/Jakarta')::date;
    begin
      insert into public.report (id, form_key, tanggal, author_id, status, data) values
        (r_acc,   'accounting', hari_ini,     id_accounting, 'terkirim', '{}'),
        (r_toyib, 'personal_marketing', hari_ini, id_toyib,  'terkirim', '{}'),
        (r_dadang_kemarin, 'pic_lokasi', hari_ini - 1, id_dadang, 'terkirim', '{}');

      insert into public.decision (id, report_id, judul, status)
      values (d_id, r_acc, 'Uji keputusan CHECKPOINT 2', 'menunggu');

      perform set_config('uji.id_putri', id_putri::text, true);
      perform set_config('uji.id_sabrina', id_sabrina::text, true);
      perform set_config('uji.id_accounting', id_accounting::text, true);
      perform set_config('uji.id_dadang', id_dadang::text, true);
      perform set_config('uji.id_fauzy', id_fauzy::text, true);
      perform set_config('uji.id_toyib', id_toyib::text, true);
      perform set_config('uji.id_kasam', id_kasam::text, true);
      perform set_config('uji.r_acc', r_acc::text, true);
      perform set_config('uji.r_toyib', r_toyib::text, true);
      perform set_config('uji.r_dadang_kemarin', r_dadang_kemarin::text, true);
      perform set_config('uji.d_id', d_id::text, true);
    end $$;
  `);
  console.log('OK — data dummy dibuat, id disimpan di GUC uji.*');

  // ═══ 2. Turunkan role ═══
  cetakLangkah('SETUP 2 — turunkan role ke authenticated');
  await q(`select set_config('role', 'authenticated', true);`);
  console.log('OK — role sekarang authenticated (bukan lagi pemilik tabel).');

  // ═══ UJI #0 — kontrol positif ═══
  cetakLangkah('UJI #0 — kontrol positif (accounting lihat laporan sendiri)');
  const siapa0 = await jadiSebagai('uji.id_accounting');
  console.log('auth.uid() =', siapa0);
  const r0 = await q(`select count(*)::int as n from public.report where form_key = 'accounting';`);
  const n0 = r0.rows[0].n;
  console.log('kontrol_positif =', n0);
  hasilAkhir.push({
    nomor: '0 (kontrol)',
    skenario: "accounting select report where form_key='accounting' (punya sendiri)",
    harapan: '1',
    mentah: `auth.uid()=${siapa0}; count=${n0}`,
    lolos: siapa0 !== null && n0 === 1,
  });

  if (siapa0 === null || n0 !== 1) {
    console.log('\n🛑 UJI #0 GAGAL — BERHENTI DI SINI SESUAI INSTRUKSI. Tidak lanjut ke uji lain.');
    console.log(
      n0 === 0
        ? 'kontrol_positif = 0 kemungkinan berarti GRANT untuk role authenticated BELUM TERPASANG — jalur baca mati untuk semua orang.'
        : '',
    );
  } else {
    // ═══ UJI #1 ═══
    cetakLangkah('UJI #1 — pusat lihat report accounting (harap 0)');
    const s1 = await jadiSebagai('uji.id_sabrina');
    console.log('auth.uid() =', s1);
    const r1 = await q(`select id, form_key, author_id from public.report where form_key = 'accounting';`);
    console.log(r1.rows);
    hasilAkhir.push({
      nomor: '1',
      skenario: "pusat select report where form_key='accounting'",
      harapan: '0 baris',
      mentah: `auth.uid()=${s1}; baris=${JSON.stringify(r1.rows)}`,
      lolos: s1 !== null && r1.rows.length === 0,
    });

    // ═══ UJI #2 ═══
    cetakLangkah('UJI #2 — ceo lihat report accounting (harap ada baris)');
    const s2 = await jadiSebagai('uji.id_putri');
    console.log('auth.uid() =', s2);
    const r2 = await q(`select id, form_key, author_id from public.report where form_key = 'accounting';`);
    console.log(r2.rows);
    hasilAkhir.push({
      nomor: '2',
      skenario: "ceo select report where form_key='accounting'",
      harapan: '>= 1 baris',
      mentah: `auth.uid()=${s2}; baris=${JSON.stringify(r2.rows)}`,
      lolos: s2 !== null && r2.rows.length >= 1,
    });

    // ═══ UJI #4 ═══
    cetakLangkah('UJI #4 — karyawan (toyib) select report (harap cuma milik sendiri)');
    const s4 = await jadiSebagai('uji.id_toyib');
    console.log('auth.uid() =', s4);
    const r4 = await q(`
      select count(*)::int as jumlah_baris,
             bool_and(author_id = current_setting('uji.id_toyib')::uuid) as semua_milik_toyib
      from public.report;
    `);
    console.log(r4.rows[0]);
    hasilAkhir.push({
      nomor: '4',
      skenario: 'karyawan (toyib) select * from report',
      harapan: 'hanya laporan sendiri',
      mentah: `auth.uid()=${s4}; ${JSON.stringify(r4.rows[0])}`,
      lolos: s4 !== null && r4.rows[0].semua_milik_toyib === true,
    });

    // ═══ UJI #5 ═══
    cetakLangkah('UJI #5 — karyawan (toyib) insert report atas nama dadang (harap ditolak)');
    const s5 = await jadiSebagai('uji.id_toyib');
    console.log('auth.uid() =', s5);
    await q(`
      do $$
      begin
        insert into public.report (form_key, tanggal, author_id, data)
        values ('personal_marketing', (now() at time zone 'Asia/Jakarta')::date,
                current_setting('uji.id_dadang')::uuid, '{}');
        perform set_config('uji.hasil5', 'LOLOS_SALAH: insert berhasil (SEHARUSNYA DITOLAK)', true);
      exception
        when others then
          perform set_config('uji.hasil5', 'DITOLAK_BENAR: '||sqlerrm, true);
      end $$;
    `);
    const r5 = await q(`select current_setting('uji.hasil5') as hasil;`);
    console.log(r5.rows[0].hasil);
    hasilAkhir.push({
      nomor: '5',
      skenario: 'karyawan (toyib) insert report author_id = dadang',
      harapan: 'ditolak',
      mentah: `auth.uid()=${s5}; ${r5.rows[0].hasil}`,
      lolos: s5 !== null && r5.rows[0].hasil.startsWith('DITOLAK_BENAR'),
    });

    // ═══ UJI #6 ═══
    cetakLangkah('UJI #6 — pic_lokasi (dadang) update laporan Toyib (harap 0 baris)');
    const s6 = await jadiSebagai('uji.id_dadang');
    console.log('auth.uid() =', s6);
    const r6 = await q(`
      with u as (
        update public.report set data = '{"percobaan":true}'::jsonb
        where id = current_setting('uji.r_toyib')::uuid
        returning id
      )
      select count(*)::int as baris_terupdate from u;
    `);
    console.log(r6.rows[0]);
    hasilAkhir.push({
      nomor: '6',
      skenario: 'pic_lokasi (dadang) update laporan milik toyib',
      harapan: '0 baris terupdate',
      mentah: `auth.uid()=${s6}; ${JSON.stringify(r6.rows[0])}`,
      lolos: s6 !== null && r6.rows[0].baris_terupdate === 0,
    });

    // ═══ UJI #7 ═══
    cetakLangkah('UJI #7 — pic_lokasi (dadang) update laporan sendiri KEMARIN (harap 0 baris)');
    const s7 = await jadiSebagai('uji.id_dadang');
    console.log('auth.uid() =', s7);
    const r7 = await q(`
      with u as (
        update public.report set data = '{"percobaan":true}'::jsonb
        where id = current_setting('uji.r_dadang_kemarin')::uuid
        returning id
      )
      select count(*)::int as baris_terupdate from u;
    `);
    console.log(r7.rows[0]);
    hasilAkhir.push({
      nomor: '7',
      skenario: 'pic_lokasi (dadang) update laporan sendiri, tanggal kemarin',
      harapan: '0 baris terupdate (bukan tanggal hari ini)',
      mentah: `auth.uid()=${s7}; ${JSON.stringify(r7.rows[0])}`,
      lolos: s7 !== null && r7.rows[0].baris_terupdate === 0,
    });

    // ═══ UJI #8 ═══
    cetakLangkah('UJI #8 — pusat (sabrina) update decision jadi disetujui (harap 0 baris)');
    const s8 = await jadiSebagai('uji.id_sabrina');
    console.log('auth.uid() =', s8);
    const r8 = await q(`
      with u as (
        update public.decision set status = 'disetujui'
        where id = current_setting('uji.d_id')::uuid
        returning id
      )
      select count(*)::int as baris_terupdate from u;
    `);
    console.log(r8.rows[0]);
    hasilAkhir.push({
      nomor: '8',
      skenario: "pusat update decision set status='disetujui'",
      harapan: '0 baris terupdate',
      mentah: `auth.uid()=${s8}; ${JSON.stringify(r8.rows[0])}`,
      lolos: s8 !== null && r8.rows[0].baris_terupdate === 0,
    });

    // ═══ UJI #9 ═══
    cetakLangkah('UJI #9 — ceo (putri) update decision jadi disetujui (harap 1 baris)');
    const s9 = await jadiSebagai('uji.id_putri');
    console.log('auth.uid() =', s9);
    const r9 = await q(`
      with u as (
        update public.decision set status = 'disetujui'
        where id = current_setting('uji.d_id')::uuid
        returning id
      )
      select count(*)::int as baris_terupdate from u;
    `);
    console.log(r9.rows[0]);
    hasilAkhir.push({
      nomor: '9',
      skenario: "ceo update decision set status='disetujui'",
      harapan: '1 baris terupdate',
      mentah: `auth.uid()=${s9}; ${JSON.stringify(r9.rows[0])}`,
      lolos: s9 !== null && r9.rows[0].baris_terupdate === 1,
    });

    // ═══ UJI #11 ═══
    cetakLangkah('UJI #11 — karyawan (toyib) kirim laporan sama 2x hari sama (harap baris ke-2 ditolak)');
    const s11 = await jadiSebagai('uji.id_toyib');
    console.log('auth.uid() =', s11);
    await q(`
      do $$
      begin
        insert into public.report (form_key, tanggal, author_id, data)
        values ('personal_marketing', (now() at time zone 'Asia/Jakarta')::date,
                current_setting('uji.id_toyib')::uuid, '{}');
        perform set_config('uji.hasil11', 'LOLOS_SALAH: laporan kedua malah berhasil dibuat', true);
      exception
        when unique_violation then
          perform set_config('uji.hasil11', 'DITOLAK_BENAR (unique index): '||sqlerrm, true);
        when others then
          perform set_config('uji.hasil11', 'GAGAL_TAK_TERDUGA: '||sqlerrm, true);
      end $$;
    `);
    const r11 = await q(`select current_setting('uji.hasil11') as hasil;`);
    console.log(r11.rows[0].hasil);
    hasilAkhir.push({
      nomor: '11',
      skenario: 'karyawan (toyib) kirim personal_marketing 2x hari yang sama',
      harapan: 'baris kedua ditolak (unique index), baris tetap satu',
      mentah: `auth.uid()=${s11}; ${r11.rows[0].hasil}`,
      lolos: s11 !== null && r11.rows[0].hasil.startsWith('DITOLAK_BENAR'),
    });

    // ═══ UJI #12 ═══
    cetakLangkah('UJI #12 — kasam kirim security shift pagi lalu siang, hari sama (harap 2 baris)');
    const s12 = await jadiSebagai('uji.id_kasam');
    console.log('auth.uid() =', s12);
    await q(`
      do $$
      begin
        insert into public.report (form_key, tanggal, author_id, shift, data)
        values ('security', (now() at time zone 'Asia/Jakarta')::date, current_setting('uji.id_kasam')::uuid, 'pagi', '{}');
        insert into public.report (form_key, tanggal, author_id, shift, data)
        values ('security', (now() at time zone 'Asia/Jakarta')::date, current_setting('uji.id_kasam')::uuid, 'siang', '{}');
        perform set_config('uji.hasil12', 'BERHASIL_BENAR: dua shift, dua baris, tidak bentrok', true);
      exception
        when others then
          perform set_config('uji.hasil12', 'GAGAL_TAK_TERDUGA: '||sqlerrm, true);
      end $$;
    `);
    const r12 = await q(`select current_setting('uji.hasil12') as hasil;`);
    console.log(r12.rows[0].hasil);
    hasilAkhir.push({
      nomor: '12',
      skenario: 'security (kasam) kirim laporan shift pagi & siang, hari sama',
      harapan: 'dua baris, tidak bentrok',
      mentah: `auth.uid()=${s12}; ${r12.rows[0].hasil}`,
      lolos: s12 !== null && r12.rows[0].hasil.startsWith('BERHASIL_BENAR'),
    });

    // ═══ UJI #13 ═══
    cetakLangkah('UJI #13 — kontrol_marketing (fauzy) lihat report accounting (harap 0 baris)');
    const s13 = await jadiSebagai('uji.id_fauzy');
    console.log('auth.uid() =', s13);
    const r13 = await q(`select id, form_key, author_id from public.report where form_key = 'accounting';`);
    console.log(r13.rows);
    hasilAkhir.push({
      nomor: '13',
      skenario: "kontrol_marketing select report where form_key='accounting'",
      harapan: '0 baris',
      mentah: `auth.uid()=${s13}; baris=${JSON.stringify(r13.rows)}`,
      lolos: s13 !== null && r13.rows.length === 0,
    });

    // ═══ UJI #14 — anon ═══
    cetakLangkah('UJI #14 — belum login (anon) select report (harap 0 baris, auth.uid() HARUS NULL)');
    await q('reset role;');
    await q(`select set_config('role', 'anon', true);`);
    await q(`select set_config('request.jwt.claims', '', true);`);
    const s14r = await q('select auth.uid() as siapa;');
    const s14 = s14r.rows[0].siapa;
    console.log('auth.uid() =', s14, '(harus null)');
    const r14 = await q(`select id, form_key, author_id from public.report;`);
    console.log(r14.rows);
    hasilAkhir.push({
      nomor: '14',
      skenario: 'belum login (anon) select * from report',
      harapan: '0 baris (auth.uid() harus NULL, ini satu-satunya yang boleh NULL)',
      mentah: `auth.uid()=${s14}; baris=${JSON.stringify(r14.rows)}`,
      lolos: s14 === null && r14.rows.length === 0,
    });
  }
} catch (err) {
  console.error('\nERROR TAK TERDUGA:', err.message);
  hasilAkhir.push({
    nomor: '(error)',
    skenario: 'eksekusi skrip',
    harapan: '-',
    mentah: err.message,
    lolos: false,
  });
} finally {
  try {
    await q('rollback;');
    console.log('\n(ROLLBACK — semua data dummy dibatalkan, tidak ada yang tersimpan)');
  } catch (e) {
    console.error('Gagal rollback:', e.message);
  }
  await client.end();
}

// ═══ RINGKASAN ═══
console.log('\n\n══════════════════ RINGKASAN ══════════════════');
console.table(
  hasilAkhir.map((h) => ({
    '#': h.nomor,
    skenario: h.skenario,
    harapan: h.harapan,
    'hasil mentah': h.mentah,
    'lolos?': h.lolos ? 'LOLOS' : 'GAGAL',
  })),
);
