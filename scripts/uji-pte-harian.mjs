#!/usr/bin/env node
// Uji PTE Harian versi poin (migrasi 0057_pte_harian.sql, 18 September 2026):
// write-once setelah lewat hari (RLS mengizinkan pemilik menulis datanya
// sendiri, trigger yang menolak begitu tanggalnya sudah lewat WIB),
// koreksi_pte_harian() cuma bisa dipakai ceo/HRD kadiv dengan alasan wajib
// dan tercatat lengkap di pte_koreksi_log (siapa/kapan/dari apa ke apa),
// whitelist kolom yang boleh dikoreksi, dan label undangan per unit
// (unit_bisnis, lewat outlet.unit_kode) -- Indokopi/Indosteak terisi,
// unit lain (termasuk Thrifting) sengaja null.

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

  await q(`
    do $$
    declare
      id_toyib uuid := (select id from auth.users where email='toyib@koperumnas.local');
      id_putri uuid := (select id from auth.users where email='putri@koperumnas.local');
    begin
      perform set_config('uji.id_toyib', id_toyib::text, true);
      perform set_config('uji.id_putri', id_putri::text, true);
    end $$;
  `);
  await q(`select set_config('role', 'authenticated', true);`);

  // #1 -- toyib bikin pte_harian HARI INI milik sendiri -- RLS mengizinkan.
  const s1 = await jadiSebagai('uji.id_toyib');
  const r1 = await q(`
    insert into public.pte_harian (user_id, tanggal, poin_digital, poin_undangan, poin_review, poin_kesaksian, poin_total)
    values (current_setting('uji.id_toyib')::uuid, (now() at time zone 'Asia/Jakarta')::date, 10, 10, 0, 0, 20)
    returning id;
  `);
  const idHariIni = r1.rows[0].id;
  catat(1, 'toyib insert pte_harian HARI INI milik sendiri', 'berhasil (RLS pemilik)', `auth.uid()=${s1}; id=${idHariIni}`, Boolean(idHariIni));

  // #2 -- toyib UPDATE baris HARI INI miliknya sendiri -- masih hari yang sama, harus tetap boleh.
  await q(`update public.pte_harian set poin_total = 30 where id = '${idHariIni}';`);
  const r2 = await q(`select poin_total from public.pte_harian where id = '${idHariIni}';`);
  catat(2, 'toyib update baris HARI INI (belum lewat hari)', 'berhasil, poin_total=30', JSON.stringify(r2.rows[0]), r2.rows[0]?.poin_total === 30);

  // #3 -- pte_harian_item ikut bisa ditulis untuk baris hari ini.
  await q(`insert into public.pte_harian_item (pte_harian_id, jenis, urutan, nama, kontak) values ('${idHariIni}', 'undangan', 1, 'Budi', '0812xxxx');`);
  const r3 = await q(`select count(*)::int as n from public.pte_harian_item where pte_harian_id = '${idHariIni}';`);
  catat(3, 'insert pte_harian_item untuk baris hari ini', '1 baris tersimpan', JSON.stringify(r3.rows[0]), r3.rows[0].n === 1);

  // #4 -- baris KEMARIN (simulasi data lama) -- insert langsung boleh (bukan jalur normal, tapi trigger memang cuma menjaga UPDATE/DELETE, bukan INSERT baris lama).
  const r4 = await q(`
    insert into public.pte_harian (user_id, tanggal, poin_total)
    values (current_setting('uji.id_toyib')::uuid, (now() at time zone 'Asia/Jakarta')::date - interval '1 day', 15)
    returning id;
  `);
  const idKemarin = r4.rows[0].id;
  catat(4, 'insert pte_harian bertanggal KEMARIN (simulasi baris lama)', 'berhasil (insert tidak dijaga, cuma update/delete)', `id=${idKemarin}`, Boolean(idKemarin));

  // #5 -- toyib coba UPDATE baris KEMARIN langsung -- HARUS DITOLAK (write-once).
  await q(`
    do $$
    begin
      update public.pte_harian set poin_total = 99 where id = '${idKemarin}';
      perform set_config('uji.h5', 'LOLOS_SALAH: baris kemarin berhasil diubah langsung', true);
    exception when others then
      perform set_config('uji.h5', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h5 = (await q(`select current_setting('uji.h5') as h;`)).rows[0].h;
  catat(5, 'toyib update LANGSUNG baris kemarin (bukan lewat koreksi_pte_harian)', 'ditolak trigger write-once', h5, h5.startsWith('DITOLAK_BENAR'));

  // #6 -- insert pte_harian_item BARU di bawah parent kemarin -- HARUS DITOLAK juga.
  await q(`
    do $$
    begin
      insert into public.pte_harian_item (pte_harian_id, jenis, urutan, nama) values ('${idKemarin}', 'review', 1, 'Siti');
      perform set_config('uji.h6', 'LOLOS_SALAH: item baru masuk ke baris kemarin', true);
    exception when others then
      perform set_config('uji.h6', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h6 = (await q(`select current_setting('uji.h6') as h;`)).rows[0].h;
  catat(6, 'insert pte_harian_item baru di bawah parent KEMARIN', 'ditolak trigger write-once', h6, h6.startsWith('DITOLAK_BENAR'));

  // #7 -- toyib (bukan ceo/HRD kadiv) coba koreksi_pte_harian -- HARUS DITOLAK.
  await q(`
    do $$
    begin
      perform public.koreksi_pte_harian('${idKemarin}'::uuid, '{"poin_total": 99}'::jsonb, 'uji: salah ketik');
      perform set_config('uji.h7', 'LOLOS_SALAH: toyib bisa koreksi', true);
    exception when others then
      perform set_config('uji.h7', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h7 = (await q(`select current_setting('uji.h7') as h;`)).rows[0].h;
  catat(7, 'toyib (bukan ceo/HRD kadiv) panggil koreksi_pte_harian', 'ditolak: tidak berhak', h7, h7.startsWith('DITOLAK_BENAR'));

  // #8 -- putri (ceo) koreksi_pte_harian TANPA alasan -- HARUS DITOLAK.
  const s8 = await jadiSebagai('uji.id_putri');
  await q(`
    do $$
    begin
      perform public.koreksi_pte_harian('${idKemarin}'::uuid, '{"poin_total": 99}'::jsonb, '');
      perform set_config('uji.h8', 'LOLOS_SALAH: alasan kosong diterima', true);
    exception when others then
      perform set_config('uji.h8', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h8 = (await q(`select current_setting('uji.h8') as h;`)).rows[0].h;
  catat(8, 'ceo koreksi_pte_harian dengan alasan KOSONG', 'ditolak: alasan wajib', `auth.uid()=${s8}; ${h8}`, h8.startsWith('DITOLAK_BENAR'));

  // #9 -- putri (ceo) koreksi_pte_harian dengan kolom TIDAK di whitelist -- HARUS DITOLAK.
  await q(`
    do $$
    begin
      perform public.koreksi_pte_harian('${idKemarin}'::uuid, '{"user_id": "${s8}"}'::jsonb, 'uji: coba ganti pemilik');
      perform set_config('uji.h9', 'LOLOS_SALAH: kolom di luar whitelist diterima', true);
    exception when others then
      perform set_config('uji.h9', 'DITOLAK_BENAR: '||sqlerrm, true);
    end $$;
  `);
  const h9 = (await q(`select current_setting('uji.h9') as h;`)).rows[0].h;
  catat(9, 'ceo koreksi_pte_harian dengan kolom di luar whitelist (user_id)', 'ditolak: kolom tidak boleh', h9, h9.startsWith('DITOLAK_BENAR'));

  // #10 -- putri (ceo) koreksi_pte_harian YANG BENAR -- berhasil, tercatat lengkap di pte_koreksi_log.
  await q(`select public.koreksi_pte_harian('${idKemarin}'::uuid, '{"poin_total": 99}'::jsonb, 'uji: salah hitung, dikoreksi manual');`);
  const r10a = await q(`select poin_total from public.pte_harian where id = '${idKemarin}';`);
  const r10b = await q(`select actor_id, alasan, sebelum->>'poin_total' as poin_sebelum, sesudah->>'poin_total' as poin_sesudah from public.pte_koreksi_log where pte_harian_id = '${idKemarin}';`);
  const cocok10 =
    r10a.rows[0]?.poin_total === 99 &&
    r10b.rows[0]?.actor_id === s8 &&
    r10b.rows[0]?.alasan?.includes('salah hitung') &&
    r10b.rows[0]?.poin_sebelum === '15' &&
    r10b.rows[0]?.poin_sesudah === '99';
  catat(10, 'ceo koreksi_pte_harian yang benar -- poin berubah + tercatat lengkap (siapa/dari apa ke apa)', 'poin_total=99, log lengkap', JSON.stringify({ ...r10a.rows[0], ...r10b.rows[0] }), cocok10);

  // #11 -- toyib (bukan ceo/HRD kadiv) TIDAK bisa baca pte_koreksi_log sama sekali.
  const s11 = await jadiSebagai('uji.id_toyib');
  const r11 = await q(`select count(*)::int as n from public.pte_koreksi_log;`);
  catat(11, 'toyib (karyawan biasa) select pte_koreksi_log', '0 baris (RLS ceo/HRD kadiv saja)', `auth.uid()=${s11}; n=${r11.rows[0].n}`, r11.rows[0].n === 0);

  // #12 -- label undangan per unit: Indokopi/Indosteak terisi, unit lain (termasuk Thrifting) null.
  const r12 = await q(`
    select o.nama, u.label_undangan
    from public.outlet o join public.unit_bisnis u on u.kode = o.unit_kode
    order by o.nama;
  `);
  const petaLabel = Object.fromEntries(r12.rows.map((r) => [r.nama, r.label_undangan]));
  const cocok12 =
    petaLabel['Indokopi Jatinegara'] === 'Undangan Customer Datang' &&
    petaLabel['Indokopi Lite Kemayoran'] === 'Undangan Customer Datang' &&
    petaLabel['Indosteak Cempaka'] === 'Undangan Customer Makan' &&
    petaLabel['Indosteak Pekansari'] === 'Undangan Customer Makan';
  catat(12, 'label undangan per outlet (lewat unit_bisnis)', 'Indokopi=Customer Datang, Indosteak=Customer Makan', JSON.stringify(petaLabel), cocok12);

  const r13 = await q(`select kode, label_undangan from public.unit_bisnis where kode in ('koperumnas', 'dti_precast', 'rukost', 'thrifting');`);
  const semuaNull = r13.rows.every((r) => r.label_undangan === null);
  catat(13, 'unit di luar Indokopi/Indosteak (Koperumnas/DTI-Precast/Rukost/Thrifting) -- label_undangan null', '4 baris, semuanya null', JSON.stringify(r13.rows), r13.rows.length === 4 && semuaNull);
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
const semuaLolos = hasil.length === 13 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
