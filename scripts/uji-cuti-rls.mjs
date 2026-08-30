#!/usr/bin/env node
// Uji RLS/RPC Cuti (migrasi 0025_cuti.sql, 0026_cuti_insert_guard.sql).
// Pola sama skrip lain sesi ini: pg.Client satu sesi, BEGIN/ROLLBACK,
// auth.uid() dicek ulang tiap ganti persona (lihat uji-presensi-rls.mjs).
//
// Fokus khusus skrip ini: gerbang tinjau cuti SENGAJA BEDA dari absensi
// (koreksi 1, 30 Agustus 2026) -- ceo + is_hrd_kadiv() SAJA, TANPA 'pusat'.
// Kasam dipinjam dengan role 'pusat' DAN 'kadiv' SEKALIGUS (divisi tetap
// DTI, bukan HRD) supaya SATU persona membuktikan DUA hal negatif sekaligus:
// 'pusat' saja tidak cukup, dan 'kadiv' divisi selain HRD juga tidak cukup.
// Fauzy dipinjam kadiv+HRD (persis pola uji-presensi-rls.mjs) utk sisi positif.
//
// Juga menguji celah yang ditemukan sendiri sebelum sempat di-commit:
// cuti_insert awalnya cuma memeriksa user_id, bukan status -- diperbaiki di
// 0026 supaya karyawan tidak bisa insert baris berstatus 'disetujui' sendiri.

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
      id_kasam   uuid := (select id from auth.users where email='kasam@koperumnas.local');
      id_putri   uuid := (select id from auth.users where email='putri@koperumnas.local');
      id_fauzy   uuid := (select id from auth.users where email='fauzy@koperumnas.local');
    begin
      -- Kasam: pinjam 'pusat' + 'kadiv' sekaligus (divisi TETAP DTI) -- persona negatif ganda.
      insert into public.role (user_id, role) values (id_kasam, 'pusat'), (id_kasam, 'kadiv');
      -- Fauzy: pinjam 'kadiv' + divisi HRD -- persona positif (pola sama uji-presensi-rls.mjs).
      insert into public.role (user_id, role) values (id_fauzy, 'kadiv');
      update public.profile set divisi = 'HRD' where id = id_fauzy;

      perform set_config('uji.id_toyib', id_toyib::text, true);
      perform set_config('uji.id_kasam', id_kasam::text, true);
      perform set_config('uji.id_putri', id_putri::text, true);
      perform set_config('uji.id_fauzy', id_fauzy::text, true);
    end $$;
  `);
  await q(`select set_config('role', 'authenticated', true);`);

  // #1 -- toyib ajukan cuti (status default 'diajukan') -- harus berhasil
  const s1 = await jadiSebagai('uji.id_toyib');
  await q(`
    insert into public.cuti (id, user_id, tanggal_mulai, tanggal_selesai, jenis, keterangan)
    values ('11111111-1111-1111-1111-111111111111', current_setting('uji.id_toyib')::uuid, current_date, current_date + 1, 'sakit', 'uji RLS -- demam');
  `);
  const r1 = await q(`select status from public.cuti where id = '11111111-1111-1111-1111-111111111111';`);
  catat(1, "toyib insert cuti (status default 'diajukan')", "1 baris, status='diajukan'", `auth.uid()=${s1}; status=${r1.rows[0]?.status}`, s1 !== null && r1.rows[0]?.status === 'diajukan');

  // #2 -- celah yang diperbaiki 0026: toyib coba insert LANGSUNG berstatus 'disetujui' -- harus ditolak
  await q(`
    do $$
    begin
      insert into public.cuti (id, user_id, tanggal_mulai, tanggal_selesai, jenis, status)
      values (gen_random_uuid(), current_setting('uji.id_toyib')::uuid, current_date, current_date, 'cuti', 'disetujui');
      perform set_config('uji.h2', 'LOLOS_SALAH: insert status disetujui berhasil', true);
    exception when others then
      perform set_config('uji.h2', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h2 = (await q(`select current_setting('uji.h2') as h;`)).rows[0].h;
  catat(2, "toyib insert cuti dengan status='disetujui' langsung (celah 0026)", 'ditolak', h2, h2.startsWith('DITOLAK_BENAR'));

  // #3 -- toyib select baris sendiri
  const r3 = await q(`select count(*)::int as n from public.cuti where id = '11111111-1111-1111-1111-111111111111';`);
  catat(3, 'toyib select cuti milik sendiri', '1 baris', `n=${r3.rows[0].n}`, r3.rows[0].n === 1);

  // #4 -- karyawan lain (belum dipinjami role apa pun) tidak lihat punya toyib
  const s4 = await jadiSebagai('uji.id_kasam');
  const r4 = await q(`select count(*)::int as n from public.cuti where id = '11111111-1111-1111-1111-111111111111';`);
  catat(4, 'karyawan biasa (kasam, sebelum dipinjami role) select cuti milik toyib', '0 baris', `auth.uid()=${s4}; n=${r4.rows[0].n}`, s4 !== null && r4.rows[0].n === 0);

  // #5 -- koreksi 1: 'pusat' + kadiv divisi BUKAN HRD -- TETAP ditolak (dua kondisi negatif sekaligus)
  const r5 = await q(`select count(*)::int as n from public.cuti where id = '11111111-1111-1111-1111-111111111111';`);
  // (Kasam sudah dipinjami 'pusat'+'kadiv' divisi DTI di blok do$$ atas -- jadi_sebagai tidak perlu diulang, auth.uid() sudah kasam)
  catat(5, "kasam berperan 'pusat'+'kadiv' (divisi DTI, BUKAN HRD) select cuti milik toyib", '0 baris (pusat saja tidak cukup)', `auth.uid()=${s4}; n=${r5.rows[0].n}`, r5.rows[0].n === 0);

  // #6 -- kadiv + divisi HRD (Fauzy dipinjam) -- harus lihat
  const s6 = await jadiSebagai('uji.id_fauzy');
  const r6 = await q(`select count(*)::int as n from public.cuti where id = '11111111-1111-1111-1111-111111111111';`);
  catat(6, 'kadiv+divisi HRD (fauzy) select cuti milik toyib', '1 baris', `auth.uid()=${s6}; n=${r6.rows[0].n}`, s6 !== null && r6.rows[0].n === 1);

  // #7 -- ceo (putri) -- harus lihat
  const s7 = await jadiSebagai('uji.id_putri');
  const r7 = await q(`select count(*)::int as n from public.cuti where id = '11111111-1111-1111-1111-111111111111';`);
  catat(7, 'ceo (putri) select cuti milik toyib', '1 baris', `auth.uid()=${s7}; n=${r7.rows[0].n}`, s7 !== null && r7.rows[0].n === 1);

  // #8 -- tidak ada policy update biasa -- bahkan pemiliknya sendiri tidak bisa update langsung
  const s8 = await jadiSebagai('uji.id_toyib');
  const r8 = await q(`
    with u as (
      update public.cuti set status = 'disetujui' where id = '11111111-1111-1111-1111-111111111111' returning id
    ) select count(*)::int as n from u;
  `);
  catat(8, 'toyib update status cuti miliknya sendiri langsung (bukan RPC)', '0 baris terupdate', `auth.uid()=${s8}; n=${r8.rows[0].n}`, s8 !== null && r8.rows[0].n === 0);

  // #9 -- putuskan_cuti(): toyib (karyawan biasa) ditolak
  await q(`
    do $$
    begin
      perform public.putuskan_cuti('11111111-1111-1111-1111-111111111111', true, 'coba paksa');
      perform set_config('uji.h9', 'LOLOS_SALAH: rpc berhasil', true);
    exception when others then
      perform set_config('uji.h9', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h9 = (await q(`select current_setting('uji.h9') as h;`)).rows[0].h;
  catat(9, 'toyib (karyawan biasa) panggil putuskan_cuti()', 'ditolak', `auth.uid()=${s8}; ${h9}`, h9.startsWith('DITOLAK_BENAR'));

  // #10 -- putuskan_cuti(): kasam berperan 'pusat'+'kadiv'(DTI) -- TETAP ditolak
  const s10 = await jadiSebagai('uji.id_kasam');
  await q(`
    do $$
    begin
      perform public.putuskan_cuti('11111111-1111-1111-1111-111111111111', true, 'coba paksa pusat');
      perform set_config('uji.h10', 'LOLOS_SALAH: rpc berhasil', true);
    exception when others then
      perform set_config('uji.h10', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h10 = (await q(`select current_setting('uji.h10') as h;`)).rows[0].h;
  catat(10, "kasam berperan 'pusat'+'kadiv'(DTI) panggil putuskan_cuti()", 'ditolak', `auth.uid()=${s10}; ${h10}`, s10 !== null && h10.startsWith('DITOLAK_BENAR'));

  // #11 -- putuskan_cuti(): fauzy (kadiv+HRD) berhasil menyetujui
  const s11 = await jadiSebagai('uji.id_fauzy');
  await q(`select public.putuskan_cuti('11111111-1111-1111-1111-111111111111', true, 'disetujui, surat diterima');`);
  const r11 = await q(`select status, disetujui_oleh, catatan_keputusan from public.cuti where id = '11111111-1111-1111-1111-111111111111';`);
  catat(
    11,
    'kadiv+divisi HRD (fauzy) panggil putuskan_cuti(disetujui=true)',
    "status='disetujui', disetujui_oleh=fauzy",
    `auth.uid()=${s11}; ${JSON.stringify(r11.rows[0])}`,
    s11 !== null && r11.rows[0].status === 'disetujui' && r11.rows[0].disetujui_oleh === s11,
  );

  // #12 -- marketing_bulanan_untuk(): hari yang tercakup cuti disetujui TIDAK dihitung hari_wajib
  // (butuh pte_mulai_berlaku terisi supaya hari_wajib > 0 sama sekali -- diisi SEMENTARA di transaksi ini saja;
  // cuti digeser ke satu HARI KERJA nyata yang <= hari ini dalam bulan berjalan -- generate_series
  // hari_wajib berhenti di hari ini, jadi tanggal harus benar-benar sudah lewat/hari ini, bukan besok)
  await q('reset role;');
  await q(`
    do $$
    declare
      awal_bulan date := date_trunc('month', current_date)::date;
      hari_kerja date;
    begin
      insert into public.policy (key, value) values ('pte_mulai_berlaku', to_jsonb(awal_bulan::text))
      on conflict (key) do update set value = to_jsonb(awal_bulan::text);
      update public.profile set mulai_kerja = awal_bulan - interval '1 year' where id = current_setting('uji.id_toyib')::uuid;

      select max(g)::date into hari_kerja
      from generate_series(awal_bulan, current_date, interval '1 day') g
      where to_jsonb(extract(isodow from g)::int) <@ (select value from policy where key='workdays');

      perform set_config('uji.hari_kerja', hari_kerja::text, true);
      update public.cuti set tanggal_mulai = hari_kerja, tanggal_selesai = hari_kerja
        where id = '11111111-1111-1111-1111-111111111111';
    end $$;
  `);
  await q(`select set_config('role', 'authenticated', true);`);
  await jadiSebagai('uji.id_putri');
  const r12 = await q(`select hari_wajib, hari_bolong from public.marketing_bulanan_untuk() where user_id = current_setting('uji.id_toyib')::uuid;`);
  await q('reset role;');
  const r12sebelum = await q(`
    select count(*)::int as n from generate_series(date_trunc('month', current_date)::date, current_date, interval '1 day') g
    where to_jsonb(extract(isodow from g)::int) <@ (select value from policy where key='workdays');
  `);
  const hariKerjaDipakai = (await q(`select current_setting('uji.hari_kerja') as h;`)).rows[0].h;
  catat(
    12,
    `marketing_bulanan_untuk(): hari kerja ${hariKerjaDipakai} (cuti disetujui toyib) dikecualikan dari hari_wajib`,
    `hari_wajib = ${r12sebelum.rows[0].n} - 1 (satu hari kerja dikecualikan)`,
    `hari_wajib=${r12.rows[0]?.hari_wajib}, hari_bolong=${r12.rows[0]?.hari_bolong}, workday_penuh=${r12sebelum.rows[0].n}`,
    r12.rows[0] && r12.rows[0].hari_wajib === r12sebelum.rows[0].n - 1,
  );
  await q(`select set_config('role', 'authenticated', true);`);
} catch (err) {
  console.error('ERROR TAK TERDUGA:', err.message);
  catat('(error)', 'eksekusi skrip', '-', err.message, false);
} finally {
  try {
    await q('reset role;');
    await q('rollback;');
    console.log('\n(ROLLBACK -- semua data uji dibatalkan, termasuk policy pte_mulai_berlaku)');
  } catch (e) {
    console.error('Gagal rollback:', e.message);
  }
  await client.end();
}

console.table(hasil.map((h) => ({ '#': h.nomor, skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.length === 12 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
