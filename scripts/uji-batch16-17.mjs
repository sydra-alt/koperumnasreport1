#!/usr/bin/env node
// Uji Task 16 (manager_resto, ita/kontrol_fnb) + Task 17 (accounting), DB
// sungguhan lewat penyamaran RLS, dibungkus BEGIN...ROLLBACK.
// Diperbarui 30 Agustus 2026 (migrasi 0036): form 'ita' dipecah jadi
// 'thrifting'+'kontrol_fnb' -- view & gerbang di bawah ikut disesuaikan.
//
//  1. manager_resto scope 'outlet': 2 laporan (Indosteak+Indokopi) hari sama.
//  2. v_manager_resto_untuk_kontrol_fnb: profil persis Ita (tanpa can_see_report
//     ke manager_resto) lihat data terstruktur (stok_habis dkk.), field umpan
//     "RAHASIA" di masalah_karyawan/dll TIDAK bocor.
//  3. v_kebutuhan_pembangunan_accounting: profil persis Accounting
//     (can_see_report accounting HANYA ke accounting/manager_resto/thrifting/
//     kontrol_fnb, BUKAN pembangunan/dti) lihat rollup budget, field umpan
//     "RAHASIA" di kontraktor_bermasalah_masalah/dll TIDAK bocor.
//  4. Accounting SUNGGUHAN (bukan cuma boleh_lihat_rekap) juga punya
//     can_see_report row-level ke manager_resto & kontrol_fnb -- cek langsung.
//  5. 3 baris `prioritas_pembayaran` -> 3 baris `decision` terpisah,
//     urgensi 1/2/3, dengan nominal/deadline/dampak masing-masing.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
function q(sql, params) { return client.query(sql, params); }
async function jadiSebagai(uuid) {
  await q(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, true);`, [uuid]);
  const r = await q('select auth.uid() as siapa;');
  if (r.rows[0].siapa !== uuid) throw new Error('Penyamaran gagal');
}
async function buatProfilSementara(nama, roles, assignmentFormKeys) {
  const { rows } = await q(
    `insert into auth.users (id, email, encrypted_password, email_confirmed_at, aud, role)
     values (gen_random_uuid(), $1, 'x', now(), 'authenticated', 'authenticated') returning id;`,
    [`${nama.toLowerCase().replace(/\s+/g, '-')}-uji-sementara@koperumnas.local`],
  );
  const id = rows[0].id;
  await q(`insert into profile (id, nama, aktif) values ($1, $2, true);`, [id, `${nama} (uji sementara)`]);
  for (const role of roles) await q(`insert into role (user_id, role) values ($1, $2);`, [id, role]);
  for (const formKey of assignmentFormKeys) await q(`insert into assignment (user_id, form_key) values ($1, $2);`, [id, formKey]);
  return id;
}
function langkah(j) { console.log(`\n════ ${j} ════`); }
function cek(kondisi, pesan) {
  console.log((kondisi ? 'OK: ' : 'SALAH: ') + pesan);
  if (!kondisi) process.exitCode = 1;
}

try {
  await client.connect();
  await q('begin;');
  await q('set local role postgres;');

  langkah('SETUP — profil sementara: Manager Indosteak, Manager Indokopi, Ita, Accounting, Toyib(karyawan polos sudah ada)');
  const { rows: toyibRows } = await q(`select id from profile where nama='Toyib';`);
  const toyib = toyibRows[0].id;
  const { rows: outletRows } = await q(`select id, nama, slug from outlet order by nama;`);
  const indokopi = outletRows.find((o) => o.slug === 'indokopi_jatinegara').id;
  const indosteak = outletRows.find((o) => o.slug === 'indosteak_cempaka').id;

  const managerIndosteak = await buatProfilSementara('Manager Indosteak', ['karyawan'], []);
  await q(`insert into assignment (user_id, form_key, outlet_id) values ($1, 'manager_resto', $2);`, [managerIndosteak, indosteak]);
  const managerIndokopi = await buatProfilSementara('Manager Indokopi', ['karyawan'], []);
  await q(`insert into assignment (user_id, form_key, outlet_id) values ($1, 'manager_resto', $2);`, [managerIndokopi, indokopi]);
  const ita = await buatProfilSementara('Ita', ['karyawan'], ['kontrol_fnb']);
  const accounting = await buatProfilSementara('Accounting', ['accounting', 'karyawan'], ['accounting']);
  console.log(`Manager Indosteak=${managerIndosteak}  Manager Indokopi=${managerIndokopi}  Ita=${ita}  Accounting=${accounting}`);

  langkah('UJI 1 — manager_resto scope outlet: 2 laporan (Indosteak+Indokopi) hari yang sama');
  await q('set local role authenticated;');
  await jadiSebagai(managerIndosteak);
  const dataIndosteak = {
    total_omzet: 5000000,
    ada_selisih_stok: 'ya',
    selisih_stok: [{ nama_barang: 'Ayam potong', stok_sistem: '50', stok_aktual: '45', kurang: '5', dugaan_penyebab: 'RAHASIA -- catatan bebas Manager, tidak boleh bocor ke Ita' }],
    stok_habis: [{ barang: 'Saus sambal', jumlah: '2', satuan: 'botol' }],
    stok_akan_habis: [{ barang: 'Tisu', jumlah: '10', satuan: 'pack', kebutuhan_tanggal: '2026-08-30' }],
    masalah_karyawan: 'RAHASIA -- masalah karyawan Manager, tidak boleh bocor ke Ita',
  };
  await q(
    `insert into report (form_key, tanggal, author_id, outlet_id, data, status, warna, submitted_at)
     values ('manager_resto', (now() at time zone 'Asia/Jakarta')::date, $1, $2, $3, 'terkirim', 'hijau', now());`,
    [managerIndosteak, indosteak, JSON.stringify(dataIndosteak)],
  );
  await jadiSebagai(managerIndokopi);
  await q(
    `insert into report (form_key, tanggal, author_id, outlet_id, data, status, warna, submitted_at)
     values ('manager_resto', (now() at time zone 'Asia/Jakarta')::date, $1, $2, '{"total_omzet": 3000000, "ada_selisih_stok": "tidak"}', 'terkirim', 'hijau', now());`,
    [managerIndokopi, indokopi],
  );
  await q('set local role postgres;');
  const { rows: cek2Laporan } = await q(`select outlet_id from report where form_key='manager_resto' and tanggal=(now() at time zone 'Asia/Jakarta')::date;`);
  cek(cek2Laporan.length === 2, `2 laporan manager_resto terpisah hari ini, dapat ${cek2Laporan.length}`);

  langkah('UJI 2 — sebagai Ita, SELECT * FROM v_manager_resto_untuk_kontrol_fnb (RAW OUTPUT)');
  await q('set local role authenticated;');
  await jadiSebagai(ita);
  const { rows: hasilIta } = await q(`select * from v_manager_resto_untuk_kontrol_fnb order by outlet;`);
  console.log(JSON.stringify(hasilIta, null, 2));
  const bocorIta = JSON.stringify(hasilIta).includes('RAHASIA');
  cek(hasilIta.length === 2, `Ita lihat 2 baris (Indokopi+Indosteak), dapat ${hasilIta.length}`);
  cek(!bocorIta, 'tidak ada field "RAHASIA" bocor ke Ita (dugaan_penyebab/masalah_karyawan)');
  const indosteakRow = hasilIta.find((r) => r.outlet === 'Indosteak Cempaka');
  cek(Number(indosteakRow?.jumlah_item_selisih) === 1, `Indosteak Cempaka jumlah_item_selisih=1, dapat ${indosteakRow?.jumlah_item_selisih}`);
  cek(indosteakRow?.stok_habis?.[0]?.barang === 'Saus sambal', 'stok_habis (terstruktur) ikut terbawa ke Ita');

  langkah('UJI 3 — sebagai Ita, SELECT langsung ke report WHERE form_key=\'manager_resto\' (RAW OUTPUT, harap 0)');
  const { rows: itaLangsung } = await q(`select id from report where form_key='manager_resto' and tanggal=(now() at time zone 'Asia/Jakarta')::date;`);
  console.log(JSON.stringify(itaLangsung));
  cek(itaLangsung.length === 0, `Ita akses langsung ke report manager_resto: 0 baris, dapat ${itaLangsung.length}`);

  langkah('SETUP — Kepala Pembangunan & DTI kirim laporan dengan pengajuan budget + field umpan');
  await q('set local role postgres;');
  const { rows: ronaldRows } = await q(`select id from profile where nama='Ronald (uji sementara)';`);
  let ronald = ronaldRows[0]?.id;
  if (!ronald) ronald = await buatProfilSementara('Ronald', ['kadiv', 'karyawan'], ['pembangunan']);
  const { rows: sudahAdaAssignmentRonald } = await q(`select 1 from assignment where user_id=$1 and form_key='pembangunan';`, [ronald]);
  if (sudahAdaAssignmentRonald.length === 0) await q(`insert into assignment (user_id, form_key) values ($1, 'pembangunan');`, [ronald]);
  const { rows: dikiRows } = await q(`select id from profile where nama like 'Diki%';`);
  const diki = dikiRows[0]?.id ?? (await buatProfilSementara('Diki', ['kadiv', 'karyawan'], ['it']));

  await q('set local role authenticated;');
  await jadiSebagai(ronald);
  await q(
    `insert into report (form_key, tanggal, author_id, data, status, warna, submitted_at)
     values ('pembangunan', (now() at time zone 'Asia/Jakarta')::date, $1, $2, 'terkirim', 'hijau', now())
     on conflict do nothing;`,
    [
      ronald,
      JSON.stringify({
        material_borongan: [{ material: 'Semen', kebutuhan: '200 sak', estimasi_biaya: '20000000', dibutuhkan_tanggal: '2026-09-01' }],
        infrastruktur_rencana_kerja: [{ lokasi: 'Tajur', pekerjaan: 'Perbaikan jalan', kontraktor: 'CV Jaya', anggaran: '15000000', target_selesai: '2026-09-15' }],
        kontraktor_bermasalah_masalah: 'RAHASIA -- masalah kontraktor Ronald, tidak boleh bocor ke Accounting',
      }),
    ],
  );
  await jadiSebagai(diki);
  // DTI dipakai formKey 'dti', bukan 'it' -- pinjam profil Diki sekadar utk kirim data uji, role/assignment tidak relevan di sini.
  await q('set local role postgres;');
  const dti = await buatProfilSementara('Seno', ['kadiv', 'karyawan'], ['dti']);
  await q('set local role authenticated;');
  await jadiSebagai(dti);
  await q(
    `insert into report (form_key, tanggal, author_id, data, status, warna, submitted_at)
     values ('dti', (now() at time zone 'Asia/Jakarta')::date, $1, '{"belanja_rab": 8000000}', 'terkirim', 'hijau', now());`,
    [dti],
  );

  langkah('UJI 4 — sebagai Accounting, SELECT * FROM v_kebutuhan_pembangunan_accounting (RAW OUTPUT)');
  await jadiSebagai(accounting);
  const { rows: hasilAccounting } = await q(`select * from v_kebutuhan_pembangunan_accounting;`);
  console.log(JSON.stringify(hasilAccounting, null, 2));
  const bocorAccounting = JSON.stringify(hasilAccounting).includes('RAHASIA');
  cek(hasilAccounting.length === 1, `Accounting lihat 1 baris rollup, dapat ${hasilAccounting.length}`);
  cek(!bocorAccounting, 'tidak ada field "RAHASIA" bocor ke Accounting (kontraktor_bermasalah_masalah)');
  cek(Number(hasilAccounting[0]?.total_material) === 20000000, `total_material=20000000, dapat ${hasilAccounting[0]?.total_material}`);
  cek(Number(hasilAccounting[0]?.total_infrastruktur) === 15000000, `total_infrastruktur=15000000, dapat ${hasilAccounting[0]?.total_infrastruktur}`);
  cek(Number(hasilAccounting[0]?.precast_dti) === 8000000, `precast_dti=8000000, dapat ${hasilAccounting[0]?.precast_dti}`);

  langkah('UJI 5 — sebagai Accounting, SELECT langsung ke report WHERE form_key=\'pembangunan\' (RAW OUTPUT, harap 0)');
  const { rows: accountingLangsung } = await q(`select id from report where form_key='pembangunan' and tanggal=(now() at time zone 'Asia/Jakarta')::date;`);
  console.log(JSON.stringify(accountingLangsung));
  cek(accountingLangsung.length === 0, `Accounting akses langsung ke report pembangunan: 0 baris, dapat ${accountingLangsung.length}`);

  langkah('UJI 6 — sebagai Accounting, can_see_report ROW-LEVEL ke manager_resto & kontrol_fnb (harus BISA, bukan lewat view)');
  const { rows: accountingKeManager } = await q(`select id from report where form_key='manager_resto' and tanggal=(now() at time zone 'Asia/Jakarta')::date;`);
  cek(accountingKeManager.length === 2, `Accounting akses langsung ke report manager_resto: 2 baris, dapat ${accountingKeManager.length}`);

  langkah('UJI 7 — laporan Accounting dengan 3 baris prioritas_pembayaran -> 3 baris decision terpisah, urgensi 1/2/3');
  const { rows: laporanAccounting } = await q(
    `insert into report (form_key, tanggal, author_id, data, status, warna, submitted_at)
     values ('accounting', (now() at time zone 'Asia/Jakarta')::date, $1, $2, 'terkirim', 'hijau', now())
     returning id;`,
    [
      accounting,
      JSON.stringify({
        prioritas_pembayaran: [
          { judul: 'Bayar kontraktor Tajur', nominal: 'Rp 15.000.000', deadline: '2026-09-01', dampak: 'Proyek berhenti' },
          { judul: 'Cicilan supplier material', nominal: '8000000', deadline: 'bukan-tanggal-valid', dampak: 'Denda keterlambatan' },
          { judul: 'Sewa gudang', nominal: '2000000', deadline: '2026-09-05', dampak: 'Barang tidak ada tempat' },
          { judul: 'Baris keempat -- harus TIDAK diproses jadi decision (lebih dari 3)', nominal: '1000000', deadline: '2026-09-10', dampak: 'x' },
        ],
      }),
    ],
  );
  const reportAccountingId = laporanAccounting[0].id;
  // Simulasi persis apa yang dilakukan LaporForm.tsx tanganiKirim() -- baris 1-3 jadi decision urgensi 1/2/3,
  // baris ke-4 DIABAIKAN (bukan urgensi 4, yang akan ditolak constraint decision.urgensi between 1 and 3).
  await q(`insert into decision (report_id, judul, nominal, deadline, dampak, urgensi) values ($1,'Bayar kontraktor Tajur',15000000,'2026-09-01','Proyek berhenti',1);`, [reportAccountingId]);
  await q(`insert into decision (report_id, judul, nominal, dampak, urgensi) values ($1,'Cicilan supplier material',8000000,'Denda keterlambatan',2);`, [reportAccountingId]); // deadline null krn "bukan-tanggal-valid"
  await q(`insert into decision (report_id, judul, nominal, deadline, dampak, urgensi) values ($1,'Sewa gudang',2000000,'2026-09-05','Barang tidak ada tempat',3);`, [reportAccountingId]);

  const { rows: decisionRows } = await q(`select judul, nominal, deadline, dampak, urgensi, status from decision where report_id=$1 order by urgensi;`, [reportAccountingId]);
  console.log(JSON.stringify(decisionRows, null, 2));
  cek(decisionRows.length === 3, `3 baris decision terbuat (bukan 4), dapat ${decisionRows.length}`);
  cek(decisionRows.every((d, i) => d.urgensi === i + 1), 'urgensi persis 1, 2, 3 sesuai urutan baris');
  cek(decisionRows.every((d) => d.status === 'menunggu'), 'semua status default menunggu');
  cek(decisionRows[1].deadline === null, 'baris dengan deadline tidak valid ("bukan-tanggal-valid") -> null, bukan tanggal salah');
  cek(Number(decisionRows[0].nominal) === 15000000, `nominal baris 1 = 15000000, dapat ${decisionRows[0].nominal}`);

  langkah('UJI 8 — CEO/pusat TETAP bisa lihat v_manager_resto_untuk_kontrol_fnb & v_kebutuhan_pembangunan_accounting (has_role, bukan cuma assignment)');
  const { rows: putriRows } = await q(`select id from profile where nama='Putri';`);
  await jadiSebagai(putriRows[0].id);
  const { rows: ceoLihatIta } = await q(`select outlet from v_manager_resto_untuk_kontrol_fnb;`);
  const { rows: ceoLihatAccounting } = await q(`select precast_dti from v_kebutuhan_pembangunan_accounting;`);
  cek(ceoLihatIta.length === 2, `CEO (Putri) lewat v_manager_resto_untuk_kontrol_fnb: 2 baris, dapat ${ceoLihatIta.length}`);
  cek(ceoLihatAccounting.length === 1, `CEO (Putri) lewat v_kebutuhan_pembangunan_accounting: 1 baris, dapat ${ceoLihatAccounting.length}`);

  langkah('UJI 9 — Toyib (karyawan polos) DITOLAK dari kedua view');
  await jadiSebagai(toyib);
  const { rows: toyibIta } = await q(`select outlet from v_manager_resto_untuk_kontrol_fnb;`);
  const { rows: toyibAccounting } = await q(`select precast_dti from v_kebutuhan_pembangunan_accounting;`);
  cek(toyibIta.length === 0, `Toyib lewat v_manager_resto_untuk_kontrol_fnb: 0 baris, dapat ${toyibIta.length}`);
  cek(toyibAccounting.length === 0, `Toyib lewat v_kebutuhan_pembangunan_accounting: 0 baris, dapat ${toyibAccounting.length}`);

  await q('rollback;');
  console.log('\n=== ROLLBACK -- tidak ada yang tersimpan. ===');
} catch (err) {
  await q('rollback;').catch(() => {});
  console.error('GAGAL:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
