#!/usr/bin/env node
// Uji PTE per orang (migrasi 0035_pte_per_orang.sql): wajib_pte=false
// mengecualikan hari_wajib/pte_berlaku HANYA utk orang itu (bukan semua),
// guard trigger menolak non-CEO mengubahnya langsung, dan setiap
// perubahan tercatat otomatis di pte_pengecualian_log (siapa/kapan/dari
// apa ke apa) TANPA perlu RPC terpisah -- trigger AFTER UPDATE menangkap
// jalur mana pun yang lolos guard.

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

  // SETUP -- pte_mulai_berlaku diisi SEMENTARA supaya hari_wajib > 0 sama sekali (nilai produksi asli TETAP null, hanya di transaksi ini).
  await q(`
    do $$
    declare
      id_toyib uuid := (select id from auth.users where email='toyib@koperumnas.local');
      id_kasam uuid := (select id from auth.users where email='kasam@koperumnas.local');
      id_putri uuid := (select id from auth.users where email='putri@koperumnas.local');
      awal_bulan date := date_trunc('month', current_date)::date;
    begin
      insert into public.policy (key, value) values ('pte_mulai_berlaku', to_jsonb(awal_bulan::text))
      on conflict (key) do update set value = to_jsonb(awal_bulan::text);
      update public.profile set mulai_kerja = awal_bulan - interval '1 year' where id in (id_toyib, id_kasam);
      perform set_config('uji.id_toyib', id_toyib::text, true);
      perform set_config('uji.id_kasam', id_kasam::text, true);
      perform set_config('uji.id_putri', id_putri::text, true);
    end $$;
  `);
  await q(`select set_config('role', 'authenticated', true);`);

  // #1 -- toyib (bukan CEO) coba matikan wajib_pte MILIKNYA SENDIRI langsung -- harus ditolak.
  const s1 = await jadiSebagai('uji.id_toyib');
  await q(`
    do $$
    begin
      update public.profile set wajib_pte = false where id = auth.uid();
      perform set_config('uji.h1', 'LOLOS_SALAH: wajib_pte berubah tanpa CEO', true);
    exception when others then
      perform set_config('uji.h1', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h1 = (await q(`select current_setting('uji.h1') as h;`)).rows[0].h;
  catat(1, 'toyib (bukan CEO) matikan wajib_pte miliknya sendiri langsung', 'ditolak', `auth.uid()=${s1}; ${h1}`, h1.startsWith('DITOLAK_BENAR'));

  // #2 -- ceo (putri) matikan wajib_pte Toyib, dengan alasan -- diizinkan, dan TERCATAT di pte_pengecualian_log otomatis.
  const s2 = await jadiSebagai('uji.id_putri');
  await q(`update public.profile set wajib_pte = false, alasan_bebas_pte = 'Uji -- cuti panjang di luar sistem' where id = current_setting('uji.id_toyib')::uuid;`);
  const r2log = await q(`select actor_id, wajib_pte_lama, wajib_pte_baru, alasan from public.pte_pengecualian_log where user_id = current_setting('uji.id_toyib')::uuid order by created_at desc limit 1;`);
  catat(
    2,
    'ceo (putri) matikan wajib_pte Toyib -- TERCATAT otomatis di pte_pengecualian_log (siapa/dari apa ke apa)',
    'actor=putri, lama=true, baru=false, alasan tercatat',
    `auth.uid()=${s2}; ${JSON.stringify(r2log.rows[0])}`,
    r2log.rows[0]?.actor_id === s2 && r2log.rows[0]?.wajib_pte_lama === true && r2log.rows[0]?.wajib_pte_baru === false && r2log.rows[0]?.alasan?.includes('cuti panjang'),
  );

  // #3 -- Toyib (wajib_pte=false) -- hari_wajib=0, pte_berlaku=false, HANYA untuk dia.
  const r3 = await q(`select pte_berlaku, wajib_pte, hari_wajib from public.marketing_bulanan_untuk() where user_id = current_setting('uji.id_toyib')::uuid;`);
  catat(3, 'Toyib setelah dikecualikan: pte_berlaku/hari_wajib', 'pte_berlaku=false, wajib_pte=false, hari_wajib=0', JSON.stringify(r3.rows[0]), r3.rows[0]?.pte_berlaku === false && r3.rows[0]?.wajib_pte === false && r3.rows[0]?.hari_wajib === 0);

  // #4 -- Kasam (wajib_pte TETAP true, TIDAK disentuh) -- hari_wajib TETAP > 0, TIDAK ikut kena.
  const r4 = await q(`select pte_berlaku, wajib_pte, hari_wajib from public.marketing_bulanan_untuk() where user_id = current_setting('uji.id_kasam')::uuid;`);
  catat(4, 'Kasam (TIDAK dikecualikan) -- pengecualian Toyib TIDAK ikut memengaruhi orang lain', 'pte_berlaku=true, wajib_pte=true, hari_wajib > 0', JSON.stringify(r4.rows[0]), r4.rows[0]?.pte_berlaku === true && r4.rows[0]?.wajib_pte === true && r4.rows[0]?.hari_wajib > 0);

  // #5 -- pengecualian dikembalikan (CEO menyalakan lagi) -- TERCATAT lagi sebagai baris KEDUA di log (bukan menimpa baris pertama).
  await q(`update public.profile set wajib_pte = true, alasan_bebas_pte = null where id = current_setting('uji.id_toyib')::uuid;`);
  const r5log = await q(`select count(*)::int as n from public.pte_pengecualian_log where user_id = current_setting('uji.id_toyib')::uuid;`);
  catat(5, 'CEO nyalakan lagi wajib_pte Toyib -- baris KEDUA di log (riwayat lengkap, bukan menimpa)', '2 baris riwayat', `n=${r5log.rows[0].n}`, r5log.rows[0].n === 2);

  // #6 -- karyawan biasa (bukan ceo) TIDAK bisa baca pte_pengecualian_log sama sekali.
  const s6 = await jadiSebagai('uji.id_kasam');
  const r6 = await q(`select count(*)::int as n from public.pte_pengecualian_log;`);
  catat(6, 'karyawan biasa (kasam) select pte_pengecualian_log', '0 baris (RLS ceo-saja)', `auth.uid()=${s6}; n=${r6.rows[0].n}`, r6.rows[0].n === 0);
} catch (err) {
  console.error('ERROR TAK TERDUGA:', err.message);
  catat('(error)', 'eksekusi skrip', '-', err.message, false);
} finally {
  try {
    await q('rollback;');
    console.log('\n(ROLLBACK -- semua data uji dibatalkan, termasuk policy pte_mulai_berlaku)');
  } catch (e) {
    console.error('Gagal rollback:', e.message);
  }
  await client.end();
}

console.table(hasil.map((h) => ({ '#': h.nomor, skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.length === 6 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
