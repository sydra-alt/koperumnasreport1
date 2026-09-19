#!/usr/bin/env node
// Uji migrasi 0062 (omzet POS di Silang-Cek) -- TRANSAKSIONAL: semua di dalam
// satu transaksi yang SELALU di-ROLLBACK (tidak ada data uji tersimpan, dan
// migrasinya sendiri TIDAK diterapkan permanen). Migrasi dijalankan ulang di
// dalam transaksi ini, jadi skrip ini bisa dipakai SEBELUM migrasi diterapkan.
//
// Menyamar sebagai akun sungguhan HANYA lewat set_config(request.jwt.claims)
// di dalam transaksi (tidak login, tidak mengubah apa pun di akun).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
const hasil = [];
const q = (sql, params) => client.query(sql, params);
let nomor = 0;
function cek(skenario, harapan, mentah, lolos) {
  nomor += 1;
  hasil.push({ nomor, skenario, harapan, mentah: typeof mentah === 'string' ? mentah : JSON.stringify(mentah), lolos });
}
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function sebagaiOwner() {
  await q('reset role');
  await q(`select set_config('request.jwt.claims', '', true)`);
}
async function sebagai(uid) {
  await q(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, true)`, [uid]);
  await q(`select set_config('role', 'authenticated', true)`);
}
async function coba(sql, params) {
  await q('savepoint s');
  try {
    const r = await q(sql, params);
    await q('rollback to s');
    return { ok: true, rows: r.rows, rowCount: r.rowCount };
  } catch (e) {
    await q('rollback to s');
    return { ok: false, err: e.message };
  }
}
const uid = async (email) => (await q(`select id from auth.users where email = $1`, [email])).rows[0]?.id;

try {
  await client.connect();
  await q('begin;');

  const sqlMigrasi = readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0062_omzet_pos_silang_cek.sql'), 'utf8')
    .replace(/^\s*begin;\s*$/im, '')
    .replace(/^\s*commit;\s*$/im, '');
  await q(sqlMigrasi);

  const ceo = await uid('uji-ceo@koperumnas.local');
  const akun = await uid('accounting@koperumnas.local');
  const pusat = await uid('sabrina@koperumnas.local');
  const karyawan = await uid('uji2@koperumnas.local');
  for (const [nama, v] of Object.entries({ ceo, akun, pusat, karyawan })) if (!v) throw new Error(`akun uji ${nama} tidak ditemukan`);

  const outlet = (await q(`select id, nama from public.outlet where aktif order by nama`)).rows;
  const [oCempaka, oJatinegara, oKemayoran, oPekansari] = [
    outlet.find((o) => o.nama === 'Indosteak Cempaka'),
    outlet.find((o) => o.nama === 'Indokopi Jatinegara'),
    outlet.find((o) => o.nama === 'Indokopi Lite Kemayoran'),
    outlet.find((o) => o.nama === 'Indosteak Pekansari'),
  ];
  if (![oCempaka, oJatinegara, oKemayoran, oPekansari].every(Boolean)) throw new Error('empat outlet uji tidak lengkap');

  const posA = '11111111-1111-4111-8111-111111111111'; // -> Cempaka
  const posB = '22222222-2222-4222-8222-222222222222'; // -> Jatinegara
  const posC = '33333333-3333-4333-8333-333333333333'; // TIDAK dipetakan (mis. outlet baru)
  const posD = '44444444-4444-4444-8444-444444444444'; // diabaikan (mis. thrifting)
  await q(`insert into public.outlet_pos_map (pos_outlet_id, outlet_id) values ($1,$2), ($3,$4)`, [posA, oCempaka.id, posB, oJatinegara.id]);
  await q(`insert into public.outlet_pos_map (pos_outlet_id, diabaikan, catatan) values ($1, true, 'thrifting -- bukan resto')`, [posD]);

  const H = (tanggal, n, uang, bersih, refund = 0) => ({ tanggal, jumlah_order: n, uang_diterima: uang, penjualan_bersih: bersih, refund });
  const payload = (ekstra = {}) => ({
    versi: 1,
    dihitung_pada: '2026-09-19T22:10:00.000Z',
    zona_waktu: 'Asia/Jakarta',
    dari: '2026-09-12',
    sampai: '2026-09-19',
    outlet: [
      { outlet_id: posA, nama: 'Indosteak Cempaka Putih', aktif: true, batas_hari: '04:00', batas_hari_terkonfirmasi: true, hari_bisnis_berjalan: '2026-09-19',
        hari: [H('2026-09-18', 40, 990000, 900000), H('2026-09-19', 3, 150000, 140000)] },
      { outlet_id: posB, nama: 'Indokopi Jatinegara', aktif: true, batas_hari: '04:00', batas_hari_terkonfirmasi: false, hari_bisnis_berjalan: '2026-09-19', hari: [] },
      { outlet_id: posC, nama: 'Outlet Baru', aktif: true, batas_hari: '04:00', batas_hari_terkonfirmasi: true, hari_bisnis_berjalan: '2026-09-19', hari: [H('2026-09-18', 1, 10000, 10000)] },
      { outlet_id: posD, nama: 'Bestie Thrift', aktif: true, batas_hari: '04:00', batas_hari_terkonfirmasi: true, hari_bisnis_berjalan: '2026-09-19', hari: [H('2026-09-18', 7, 700000, 700000)] },
    ],
    ...ekstra,
  });
  const mulaiLog = async () => (await q(`insert into public.sinkron_pos_log default values returning id`)).rows[0].id;
  const terapkan = async (p, logId) => (await q(`select public.terapkan_sinkron_pos($1::uuid, $2::jsonb) as r`, [logId ?? (await mulaiLog()), JSON.stringify(p)])).rows[0].r;

  // ══ A. Keadaan awal: belum ada sinkron ═══════════════════════════════════════
  await sebagai(ceo);
  let st = (await q(`select * from public.status_sinkron_pos()`)).rows[0];
  cek('belum pernah sinkron -> basi + belum pernah berhasil', 'basi=true, pernah_berhasil=false, maks 30', { basi: st.basi, pernah: st.pernah_berhasil, maks: st.maks_umur_jam }, st.basi === true && st.pernah_berhasil === false && st.maks_umur_jam === 30);
  let t3 = (await q(`select * from public.omzet_tiga_sumber_untuk_tanggal('2026-09-18')`)).rows;
  cek('belum pernah sinkron: outlet terpetakan -> belum_pernah_sinkron, semua angka POS NULL', 'Cempaka & Jatinegara belum_pernah_sinkron', t3.filter((r) => r.pos_status === 'belum_pernah_sinkron').map((r) => r.outlet).sort(),
    sama(t3.filter((r) => r.pos_status === 'belum_pernah_sinkron').map((r) => r.outlet).sort(), ['Indokopi Jatinegara', 'Indosteak Cempaka']) && t3.every((r) => r.pos_uang_diterima === null));
  cek('outlet tanpa pemetaan -> belum_dipetakan', 'Kemayoran & Pekansari', t3.filter((r) => r.pos_status === 'belum_dipetakan').map((r) => r.outlet).sort(),
    sama(t3.filter((r) => r.pos_status === 'belum_dipetakan').map((r) => r.outlet).sort(), ['Indokopi Lite Kemayoran', 'Indosteak Pekansari']));
  cek('SEMUA outlet aktif muncul (4), termasuk yang belum ada laporan', 4, t3.length, t3.length === 4);

  // ══ B. Hak akses ════════════════════════════════════════════════════════════
  await sebagaiOwner();
  await terapkan(payload());
  for (const [nama, id, boleh] of [['ceo', ceo, true], ['accounting', akun, true], ['pusat', pusat, false], ['karyawan', karyawan, false]]) {
    await sebagai(id);
    const n = (await q(`select count(*)::int as n from public.omzet_pos_harian`)).rows[0].n;
    const m = (await q(`select count(*)::int as n from public.outlet_pos_map`)).rows[0].n;
    const l = (await q(`select count(*)::int as n from public.sinkron_pos_log`)).rows[0].n;
    cek(`${nama}: baca omzet_pos_harian / outlet_pos_map / sinkron_pos_log`, boleh ? 'terbaca' : '0 baris', { omzet: n, peta: m, log: l },
      boleh ? n === 3 && m === 3 && l === 1 : n === 0 && m === 0 && l === 0);
  }
  await sebagai(ceo);
  for (const [label, sql] of [
    ['CEO menulis omzet_pos_harian (angka POS tidak boleh diketik)', `insert into public.omzet_pos_harian values ('${oCempaka.id}', '2026-09-01', 1, 1, 1, 0, now())`],
    ['CEO mengubah omzet_pos_harian', `update public.omzet_pos_harian set uang_diterima = 1`],
    ['CEO menghapus omzet_pos_harian', `delete from public.omzet_pos_harian`],
    ['CEO menulis sinkron_pos_log', `insert into public.sinkron_pos_log default values`],
    ['CEO mengubah sinkron_pos_log (memalsukan stempel)', `update public.sinkron_pos_log set selesai = now()`],
  ]) {
    const r = await coba(sql);
    cek(label, 'ditolak (permission denied)', r.ok ? 'LOLOS_SALAH' : r.err, !r.ok && /permission denied/.test(r.err));
  }
  const rf = await coba(`select public.terapkan_sinkron_pos(gen_random_uuid(), '{}'::jsonb)`);
  cek('CEO memanggil terapkan_sinkron_pos langsung', 'ditolak (EXECUTE hanya service_role)', rf.ok ? 'LOLOS_SALAH' : rf.err, !rf.ok && /permission denied/.test(rf.err));
  const rp = await coba(`insert into public.outlet_pos_map (pos_outlet_id, outlet_id) values ('55555555-5555-4555-8555-555555555555', '${oKemayoran.id}')`);
  cek('CEO boleh memetakan outlet (kelola pemetaan)', 'berhasil', rp.ok ? 'berhasil' : rp.err, rp.ok);
  await sebagai(karyawan);
  const rk = await coba(`insert into public.outlet_pos_map (pos_outlet_id, outlet_id) values ('55555555-5555-4555-8555-555555555555', '${oKemayoran.id}')`);
  cek('karyawan memetakan outlet', 'ditolak', rk.ok ? 'LOLOS_SALAH' : rk.err, !rk.ok);
  await sebagaiOwner();
  const xor1 = await coba(`insert into public.outlet_pos_map (pos_outlet_id, outlet_id, diabaikan) values ('66666666-6666-4666-8666-666666666666', '${oKemayoran.id}', true)`);
  const xor2 = await coba(`insert into public.outlet_pos_map (pos_outlet_id) values ('77777777-7777-4777-8777-777777777777')`);
  cek('pemetaan: terpetakan DAN diabaikan sekaligus ditolak; tidak dua-duanya juga ditolak', 'kedua ditolak', { a: xor1.ok, b: xor2.ok }, !xor1.ok && !xor2.ok);
  const dup = await coba(`insert into public.outlet_pos_map (pos_outlet_id, outlet_id) values ('88888888-8888-4888-8888-888888888888', '${oCempaka.id}')`);
  cek('satu outlet laporan tidak boleh dipetakan ke dua outlet POS', 'ditolak', dup.ok ? 'LOLOS_SALAH' : dup.err, !dup.ok);

  // ══ C. terapkan_sinkron_pos ═════════════════════════════════════════════════
  await sebagaiOwner();
  const rows = (await q(`select outlet_id, to_char(tanggal,'YYYY-MM-DD') tanggal, jumlah_order, uang_diterima::text, penjualan_bersih::text from public.omzet_pos_harian order by outlet_id, tanggal`)).rows;
  cek('sinkron pertama: hanya outlet TERPETAKAN yang disalin (Cempaka 2 hari); tak terpetakan dan diabaikan tidak masuk', 'tiga baris? tidak: 2 baris Cempaka', rows.map((r) => `${r.tanggal}:${r.uang_diterima}`),
    rows.length === 2 && rows.every((r) => r.outlet_id === oCempaka.id) && rows[0].uang_diterima === '990000');
  const petaA = (await q(`select nama_pos, batas_hari, batas_hari_terkonfirmasi, to_char(hari_bisnis_berjalan,'YYYY-MM-DD') as berjalan, disinkron_pada is not null as sync from public.outlet_pos_map where pos_outlet_id = $1`, [posA])).rows[0];
  cek('metadata batas hari + hari bisnis berjalan disalin dari POS ke pemetaan', "04:00, terkonfirmasi, berjalan 2026-09-19", petaA, petaA.batas_hari === '04:00' && petaA.batas_hari_terkonfirmasi === true && petaA.berjalan === '2026-09-19' && petaA.sync === true);
  const petaB = (await q(`select batas_hari_terkonfirmasi from public.outlet_pos_map where pos_outlet_id = $1`, [posB])).rows[0];
  cek('status "belum dikonfirmasi" ikut tersalin (Jatinegara)', 'false', petaB, petaB.batas_hari_terkonfirmasi === false);
  const log1 = (await q(`select status, jumlah_baris, outlet_tak_terpetakan, to_char(rentang_dari,'YYYY-MM-DD') dari from public.sinkron_pos_log order by mulai desc limit 1`)).rows[0];
  cek('log: berhasil, 2 baris, outlet tak terpetakan DICATAT (Outlet Baru, punya data) -- tidak dibuang diam-diam', 'berhasil, 2, [Outlet Baru]', { s: log1.status, n: log1.jumlah_baris, t: log1.outlet_tak_terpetakan },
    log1.status === 'berhasil' && log1.jumlah_baris === 2 && log1.outlet_tak_terpetakan.length === 1 && log1.outlet_tak_terpetakan[0].nama === 'Outlet Baru' && log1.outlet_tak_terpetakan[0].punya_data === true);
  cek('outlet yang diabaikan (thrifting) tidak dianggap "belum dipetakan"', 'tidak ada di daftar', log1.outlet_tak_terpetakan.map((o) => o.nama), !log1.outlet_tak_terpetakan.some((o) => o.nama === 'Bestie Thrift'));
  cek('status_sinkron_pos memuat jumlah belum dipetakan', 1, (await q(`select jumlah_belum_dipetakan from public.status_sinkron_pos()`)).rows[0].jumlah_belum_dipetakan, (await q(`select jumlah_belum_dipetakan from public.status_sinkron_pos()`)).rows[0].jumlah_belum_dipetakan === 1);

  await terapkan(payload());
  const n2 = (await q(`select count(*)::int as n from public.omzet_pos_harian`)).rows[0].n;
  cek('sinkron ulang dengan payload sama = idempoten (tidak menggandakan)', 2, n2, n2 === 2);

  // Hari yang hilang dari payload di dalam rentang dihapus; baris LEBIH TUA dari rentang tetap.
  await q(`insert into public.omzet_pos_harian values ($1, '2026-09-05', 9, 5, 5, 0, now())`, [oCempaka.id]);
  const p3 = payload();
  p3.outlet[0].hari = [H('2026-09-19', 3, 150000, 140000)];
  await terapkan(p3);
  const sisa = (await q(`select to_char(tanggal,'YYYY-MM-DD') t from public.omzet_pos_harian where outlet_id = $1 order by tanggal`, [oCempaka.id])).rows.map((r) => r.t);
  cek('hari 18 Sep hilang dari payload (mis. semua order di-void) -> dihapus; baris 5 Sep (di luar rentang) tetap', '["2026-09-05","2026-09-19"]', sisa, sama(sisa, ['2026-09-05', '2026-09-19']));
  await terapkan(payload());

  const buruk = [
    ['versi 2', { ...payload(), versi: 2 }],
    ['outlet bukan array', { ...payload(), outlet: {} }],
    ['dari > sampai', { ...payload(), dari: '2026-09-19', sampai: '2026-09-12' }],
    ['tanpa dihitung_pada', { ...payload(), dihitung_pada: null }],
    ['outlet_id bukan uuid', (() => { const p = payload(); p.outlet[0].outlet_id = 'bukan-uuid'; return p; })()],
    ['tanggal di luar rentang', (() => { const p = payload(); p.outlet[0].hari[0].tanggal = '2026-08-01'; return p; })()],
    ['hari tanpa tanggal', (() => { const p = payload(); delete p.outlet[0].hari[0].tanggal; return p; })()],
    ['batas_hari ngawur', (() => { const p = payload(); p.outlet[0].batas_hari = '4 pagi'; return p; })()],
    ['batas_hari kosong', (() => { const p = payload(); delete p.outlet[0].batas_hari; return p; })()],
    ['uang desimal (12.5)', (() => { const p = payload(); p.outlet[0].hari[0].uang_diterima = 12.5; return p; })()],
    ['jumlah_order negatif', (() => { const p = payload(); p.outlet[0].hari[0].jumlah_order = -1; return p; })()],
  ];
  for (const [label, p] of buruk) {
    const before = (await q(`select count(*)::int n, coalesce(sum(uang_diterima),0)::text s from public.omzet_pos_harian`)).rows[0];
    const r = await coba(`select public.terapkan_sinkron_pos((select id from public.sinkron_pos_log limit 1), $1::jsonb)`, [JSON.stringify(p)]);
    const after = (await q(`select count(*)::int n, coalesce(sum(uang_diterima),0)::text s from public.omzet_pos_harian`)).rows[0];
    cek(`payload buruk ditolak: ${label}`, 'exception + data tidak berubah', r.ok ? 'LOLOS_SALAH' : r.err.slice(0, 70), !r.ok && sama(before, after));
  }
  // Atomik: outlet pertama baik, outlet kedua buruk -> outlet pertama TIDAK ikut tersimpan.
  const pa = payload();
  pa.outlet[0].hari = [H('2026-09-18', 41, 111111, 100000), H('2026-09-19', 3, 150000, 140000)];
  pa.outlet[1].hari = [H('2026-09-18', -5, 1, 1)];
  const before = (await q(`select uang_diterima::text u from public.omzet_pos_harian where outlet_id = $1 and tanggal = '2026-09-18'`, [oCempaka.id])).rows[0].u;
  const ra = await coba(`select public.terapkan_sinkron_pos((select id from public.sinkron_pos_log limit 1), $1::jsonb)`, [JSON.stringify(pa)]);
  const after = (await q(`select uang_diterima::text u from public.omzet_pos_harian where outlet_id = $1 and tanggal = '2026-09-18'`, [oCempaka.id])).rows[0].u;
  cek('atomik: outlet ke-2 rusak -> perubahan outlet ke-1 dibatalkan juga', `tetap ${before}`, { ditolak: !ra.ok, sesudah: after }, !ra.ok && after === before);

  // ══ D. status_sinkron_pos: basi ══════════════════════════════════════════════
  await sebagaiOwner();
  await q(`update public.sinkron_pos_log set status = 'gagal', galat = 'x' where id <> (select id from public.sinkron_pos_log order by selesai desc nulls last limit 1)`);
  const umur = async (jam) => {
    await q(`update public.sinkron_pos_log set selesai = now() - make_interval(hours => $1) where status = 'berhasil'`, [jam]);
    return (await q(`select * from public.status_sinkron_pos()`)).rows[0];
  };
  st = await umur(1);
  cek('sinkron 1 jam lalu -> tidak basi', 'basi=false', { basi: st.basi, umur: Number(st.umur_jam).toFixed(1) }, st.basi === false);
  st = await umur(29);
  cek('29 jam (batas 30) -> tidak basi', 'basi=false', st.basi, st.basi === false);
  st = await umur(31);
  cek('31 jam -> BASI', 'basi=true', st.basi, st.basi === true);
  await q(`update public.policy set value = '10' where key = 'pos_sinkron_maks_umur_jam'`);
  st = await umur(11);
  cek('batas umur dibaca dari policy (diubah ke 10 jam): 11 jam -> basi', 'basi=true, maks 10', { basi: st.basi, maks: st.maks_umur_jam }, st.basi === true && st.maks_umur_jam === 10);
  await q(`update public.policy set value = '30' where key = 'pos_sinkron_maks_umur_jam'`);
  await umur(2);
  await q(`insert into public.sinkron_pos_log (status, selesai, galat) values ('gagal', now() - interval '10 minutes', 'POS menjawab HTTP 503')`);
  st = (await q(`select * from public.status_sinkron_pos()`)).rows[0];
  cek('percobaan terakhir GAGAL tetapi sinkron berhasil masih baru: basi=false, percobaan_status=gagal + pesan galat tersedia', 'gagal, tidak basi', { s: st.percobaan_status, g: st.percobaan_galat, basi: st.basi }, st.percobaan_status === 'gagal' && st.basi === false && st.percobaan_galat === 'POS menjawab HTTP 503');
  await q(`insert into public.sinkron_pos_log (status) values ('berjalan')`);
  st = (await q(`select * from public.status_sinkron_pos()`)).rows[0];
  cek('baris "berjalan" yang menggantung tidak dianggap percobaan selesai', 'tetap gagal', st.percobaan_status, st.percobaan_status === 'gagal');
  await q(`delete from public.sinkron_pos_log where status in ('gagal','berjalan') and galat is distinct from 'x' and status <> 'berhasil'`);

  // ══ E. omzet_tiga_sumber_untuk_tanggal ═══════════════════════════════════════
  await sebagaiOwner();
  await q(`update public.sinkron_pos_log set selesai = now() - interval '2 hours' where status = 'berhasil'`);
  const lap = async (form, outletId, tanggal, data) =>
    q(`insert into public.report (form_key, form_version, tanggal, author_id, outlet_id, data, status) values ($1, 1, $2, $3, $4, $5::jsonb, 'terkirim')`, [form, tanggal, ceo, outletId, JSON.stringify(data)]);
  // 18 Sep: Cempaka lengkap (manager 1.000.000, kontrol 1.000.000, POS 990.000); Jatinegara: hanya manager
  await lap('manager_resto', oCempaka.id, '2026-09-18', { total_omzet: 1000000 });
  await lap('kontrol_fnb', oCempaka.id, '2026-09-18', { omzet_sistem: 1000000 });
  await lap('manager_resto', oJatinegara.id, '2026-09-18', { total_omzet: 500000 });
  await lap('kontrol_fnb', oPekansari.id, '2026-09-18', { omzet_sistem: 300000 });
  // 19 Sep (hari bisnis berjalan): keduanya ada
  await lap('manager_resto', oCempaka.id, '2026-09-19', { total_omzet: 900000 });
  await lap('kontrol_fnb', oCempaka.id, '2026-09-19', { omzet_sistem: 900000 });
  await sebagai(ceo);
  const ambil = async (t) => Object.fromEntries((await q(`select * from public.omzet_tiga_sumber_untuk_tanggal($1::date)`, [t])).rows.map((r) => [r.outlet, r]));
  let d18 = await ambil('2026-09-18');
  const c = d18['Indosteak Cempaka'];
  cek('hari TUTUP (18 Sep) Cempaka: final, tiga angka + tiga selisih', 'final; 1.000.000 | 1.000.000 | 990.000; selisih 0 / 10.000 / 10.000',
    { st: c.pos_status, m: c.manager, k: c.kontrol, p: c.pos_uang_diterima, mk: c.selisih_manager_kontrol, mp: c.selisih_manager_pos, kp: c.selisih_kontrol_pos },
    c.pos_status === 'final' && String(c.manager) === '1000000' && String(c.kontrol) === '1000000' && String(c.pos_uang_diterima) === '990000' && String(c.selisih_manager_kontrol) === '0' && String(c.selisih_manager_pos) === '10000' && String(c.selisih_kontrol_pos) === '10000');
  cek('angka kedua (penjualan bersih) dan jumlah order ikut, batas hari 04:00', '900000, 40, 04:00', { b: c.pos_penjualan_bersih, n: c.pos_jumlah_order, h: c.pos_batas_hari }, String(c.pos_penjualan_bersih) === '900000' && c.pos_jumlah_order === 40 && c.pos_batas_hari === '04:00');
  const j = d18['Indokopi Jatinegara'];
  cek('Jatinegara: hanya Manager ada, POS terpetakan tanpa transaksi di 18 Sep -> "tanpa_transaksi" (BUKAN Rp 0); TIDAK ADA selisih apa pun', 'tanpa_transaksi; POS null; semua selisih null',
    { st: j.pos_status, p: j.pos_uang_diterima, s: [j.selisih_manager_kontrol, j.selisih_manager_pos, j.selisih_kontrol_pos] },
    j.pos_status === 'tanpa_transaksi' && j.pos_uang_diterima === null && j.selisih_manager_kontrol === null && j.selisih_manager_pos === null && j.selisih_kontrol_pos === null && String(j.manager) === '500000' && j.kontrol_fnb === null);
  cek('tanpa_transaksi tetap membawa batas hari (untuk teks layar)', '04:00, belum dikonfirmasi (false)', { h: j.pos_batas_hari, k: j.pos_batas_terkonfirmasi }, j.pos_batas_hari === '04:00' && j.pos_batas_terkonfirmasi === false);
  const pk = d18['Indosteak Pekansari'];
  cek('Pekansari: belum dipetakan, hanya Kontrol F&B ada -> POS null, selisih null', 'belum_dipetakan', { st: pk.pos_status, k: pk.kontrol_fnb, s: pk.selisih_kontrol_pos }, pk.pos_status === 'belum_dipetakan' && String(pk.kontrol_fnb) === '300000' && pk.selisih_kontrol_pos === null);
  const km = d18['Indokopi Lite Kemayoran'];
  cek('Kemayoran: tidak ada laporan sama sekali & belum dipetakan -> semua null (baris tetap ada)', 'null', { m: km.manager, k: km.kontrol_fnb, p: km.pos_uang_diterima }, km.manager === null && km.kontrol_fnb === null && km.pos_uang_diterima === null);

  const d19 = await ambil('2026-09-19');
  const c19 = d19['Indosteak Cempaka'];
  cek('hari BERJALAN (19 Sep = hari bisnis berjalan): angka POS tampil sebagai sementara, TIDAK ada selisih terhadap POS', "berjalan; POS 150.000; selisih POS null; selisih Manager-Kontrol 0 tetap ada",
    { st: c19.pos_status, p: c19.pos_uang_diterima, mp: c19.selisih_manager_pos, kp: c19.selisih_kontrol_pos, mk: c19.selisih_manager_kontrol },
    c19.pos_status === 'berjalan' && String(c19.pos_uang_diterima) === '150000' && c19.selisih_manager_pos === null && c19.selisih_kontrol_pos === null && String(c19.selisih_manager_kontrol) === '0');
  const d17 = await ambil('2026-09-17');
  cek('tanggal dalam cakupan sinkron tanpa baris (17 Sep) -> tanpa_transaksi', 'tanpa_transaksi', d17['Indosteak Cempaka'].pos_status, d17['Indosteak Cempaka'].pos_status === 'tanpa_transaksi');
  const d05 = await ambil('2026-09-10');
  cek('tanggal di LUAR cakupan sinkron (10 Sep < 12 Sep) tanpa baris -> belum_ada_data_pos (bukan "tanpa transaksi")', 'belum_ada_data_pos', d05['Indosteak Cempaka'].pos_status, d05['Indosteak Cempaka'].pos_status === 'belum_ada_data_pos');
  const d20 = await ambil('2026-09-20');
  cek('tanggal SETELAH hari bisnis berjalan (20 Sep) -> belum_dimulai', 'belum_dimulai', d20['Indosteak Cempaka'].pos_status, d20['Indosteak Cempaka'].pos_status === 'belum_dimulai');

  await sebagaiOwner();
  await q(`update public.sinkron_pos_log set selesai = now() - interval '40 hours' where status = 'berhasil'`);
  await sebagai(ceo);
  const basi = (await ambil('2026-09-18'))['Indosteak Cempaka'];
  cek('BASI (40 jam): angka POS DISEMBUNYIKAN (null), status basi, selisih terhadap POS null; ketikan tetap tampil', 'basi; POS null; selisih POS null; Manager 1.000.000',
    { st: basi.pos_status, p: basi.pos_uang_diterima, mp: basi.selisih_manager_pos, kp: basi.selisih_kontrol_pos, m: basi.manager },
    basi.pos_status === 'basi' && basi.pos_uang_diterima === null && basi.pos_penjualan_bersih === null && basi.selisih_manager_pos === null && basi.selisih_kontrol_pos === null && String(basi.manager) === '1000000' && String(basi.selisih_manager_kontrol) === '0');
  await sebagaiOwner();
  await q(`update public.sinkron_pos_log set selesai = now() - interval '1 hour' where status = 'berhasil'`);

  // Peran
  await sebagai(akun);
  const ak = (await ambil('2026-09-18'))['Indosteak Cempaka'];
  cek('accounting: angka POS terbaca (RLS 0062)', 'final', ak.pos_status, ak.pos_status === 'final' && String(ak.pos_uang_diterima) === '990000');
  await sebagai(pusat);
  const pu = (await ambil('2026-09-18'))['Indosteak Cempaka'];
  cek('pusat: TIDAK melihat angka POS (RLS menyembunyikan pemetaan -> belum_dipetakan, angka null)', 'belum_dipetakan; POS null', { st: pu.pos_status, p: pu.pos_uang_diterima }, pu.pos_status === 'belum_dipetakan' && pu.pos_uang_diterima === null);
  await sebagai(karyawan);
  const ka = (await ambil('2026-09-18'))['Indosteak Cempaka'];
  cek('karyawan biasa: tidak melihat POS', 'belum_dipetakan; POS null', { st: ka.pos_status, p: ka.pos_uang_diterima }, ka.pos_status === 'belum_dipetakan' && ka.pos_uang_diterima === null);

  // Fungsi lama tidak berubah
  await sebagai(ceo);
  const lama = (await q(`select * from public.selisih_resto_untuk_tanggal('2026-09-18')`)).rows;
  cek('selisih_resto_untuk_tanggal() lama tetap utuh (hanya pasangan lengkap: Cempaka)', '1 baris Cempaka', lama.map((r) => r.outlet), sama(lama.map((r) => r.outlet), ['Indosteak Cempaka']));
  await sebagaiOwner();
  const kunci = (await q(`select value #>> '{}' as v from public.policy where key = 'pos_sinkron_maks_umur_jam'`)).rows[0]?.v;
  cek('kunci policy pos_sinkron_maks_umur_jam = 30', '30', kunci, kunci === '30');
} catch (e) {
  console.error('GALAT UJI:', e.stack ?? e.message);
  hasil.push({ nomor: 'X', skenario: 'skrip', harapan: 'selesai tanpa galat', mentah: e.message, lolos: false });
} finally {
  try { await client.query('rollback;'); } catch { /* tidak ada transaksi aktif */ }
  await client.end();
}

let gagal = 0;
for (const h of hasil) {
  if (!h.lolos) gagal++;
  console.log(`${h.lolos ? 'LOLOS ' : 'GAGAL '} #${h.nomor} ${h.skenario}\n        harapan: ${h.harapan}\n        hasil  : ${h.mentah}`);
}
console.log(`\n${hasil.length - gagal}/${hasil.length} lolos. Semua perubahan (termasuk migrasi 0062) di-ROLLBACK.`);
process.exit(gagal === 0 ? 0 : 1);
