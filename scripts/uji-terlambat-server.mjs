#!/usr/bin/env node
// Uji migrasi 0059 + 0060 + 0061 -- keterlambatan, acuan jam masuk, hari kerja,
// dan status radius dihitung SERVER. Semua di dalam satu transaksi yang SELALU
// di-ROLLBACK (tidak ada data uji tersimpan). Ketiga migrasi dijalankan ulang
// di dalam transaksi ini (idempotent: create or replace), jadi skrip ini bisa
// dipakai SEBELUM migrasi diterapkan (dry-run) maupun sesudahnya.
//
// Pola sama uji-presensi-rls.mjs: pg.Client satu sesi, penyamaran
// `set role authenticated` + request.jwt.claims.
//
// Kalender uji (WIB = UTC+7): 2026-09-12 Sabtu, 09-13 Minggu, 09-14 Senin,
// 09-15 Selasa. Jam UTC = jam WIB - 7.

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
  hasil.push({ nomor, skenario, harapan, mentah: String(mentah), lolos });
}

async function sebagaiOwner() {
  await q('reset role');
  await q(`select set_config('request.jwt.claims', '', true)`);
}
async function sebagaiKaryawan(uid) {
  await q(`select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role','authenticated')::text, true)`, [uid]);
  await q(`select set_config('role', 'authenticated', true)`);
}
// Jalankan satu statement di dalam savepoint yang SELALU dibatalkan.
async function coba(sql, params) {
  await q('savepoint s');
  try {
    const r = await q(sql, params);
    await q('rollback to s');
    return { ok: true, row: r.rows[0] };
  } catch (e) {
    await q('rollback to s');
    return { ok: false, err: e.message };
  }
}
async function hitung(p, waktuUtcIso) {
  return (await q(`select public.hitung_terlambat_menit($1::uuid, $2::uuid, $3::timestamptz) as n`, [p.uid, p.titik, waktuUtcIso])).rows[0].n;
}
async function acuan(p, tanggal) {
  return (await q(`select public.jam_masuk_acuan($1::uuid, $2::uuid, $3::date) as j`, [p.uid, p.titik, tanggal])).rows[0].j;
}
async function pasangan(namaTitik, tunggal = false) {
  const r = await q(
    `select pa.user_id as uid, pa.lokasi_absen_id as titik, la.latitude, la.longitude, la.radius_meter, la.outlet_id
     from public.penugasan_absen pa
     join public.lokasi_absen la on la.id = pa.lokasi_absen_id
     join public.profile p on p.id = pa.user_id and p.aktif
     where la.nama = $1 and pa.jam_masuk is null
       and not exists (select 1 from public.cuti c where c.user_id = pa.user_id)
       and not exists (select 1 from public.absensi a where a.user_id = pa.user_id and a.tanggal = (now() at time zone 'Asia/Jakarta')::date)
       and ($2::boolean is false or (select count(*) from public.penugasan_absen x where x.user_id = pa.user_id) = 1)
     limit 1`,
    [namaTitik, tunggal],
  );
  if (r.rowCount === 0) throw new Error(`Tidak ada karyawan uji untuk titik ${namaTitik}.`);
  return r.rows[0];
}
// Haversine JS -- salinan lib/absen.ts (jarakHaversineMeter), untuk uji paritas.
function haversineJs(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

try {
  await client.connect();
  await q('begin;');

  for (const berkas of ['0059_terlambat_dihitung_server.sql', '0060_acuan_jam_masuk_jadwal_outlet.sql', '0061_status_radius_dihitung_server.sql']) {
    const sqlMigrasi = readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', berkas), 'utf8')
      .replace(/^\s*begin;\s*$/im, '')
      .replace(/^\s*commit;\s*$/im, '');
    await q(sqlMigrasi);
  }

  const K = await pasangan('Kantor Pusat'); // titik TANPA outlet -> policy
  const S = await pasangan('Indosteak cempaka putih'); // outlet buka 7 hari 09:00-22:00
  const I = await pasangan('Indokopi (Jatinegara)'); // outlet, Sabtu-Minggu 24 jam

  // ══ A. Titik tanpa outlet (Kantor Pusat): policy.jam_masuk 08:00 + policy.workdays ══
  cek('KP Senin 14:59, acuan 08:00 + toleransi 15', '404 (kasus asli Putri)', await hitung(K, '2026-09-14T07:59:00Z'), (await hitung(K, '2026-09-14T07:59:00Z')) === 404);
  cek('KP Senin 08:15 (tepat batas toleransi)', '0', await hitung(K, '2026-09-14T01:15:00Z'), (await hitung(K, '2026-09-14T01:15:00Z')) === 0);
  cek('KP Senin 08:16', '1', await hitung(K, '2026-09-14T01:16:00Z'), (await hitung(K, '2026-09-14T01:16:00Z')) === 1);
  cek('KP Senin 07:30 (sebelum jam masuk)', '0, bukan negatif', await hitung(K, '2026-09-14T00:30:00Z'), (await hitung(K, '2026-09-14T00:30:00Z')) === 0);
  cek('KP Sabtu 14:59 (Sabtu ada di policy.workdays)', '404', await hitung(K, '2026-09-12T07:59:00Z'), (await hitung(K, '2026-09-12T07:59:00Z')) === 404);
  const kMinggu = await hitung(K, '2026-09-13T07:59:00Z');
  cek('KP Minggu 14:59 (di luar policy.workdays)', 'null (tidak dinilai)', kMinggu, kMinggu === null);
  const kDini = await hitung(K, '2026-09-13T20:00:00Z');
  cek('KP 2026-09-13 20:00 UTC = Senin 03:00 WIB (hari ditentukan WIB, bukan UTC)', '0 (Senin), BUKAN null', kDini, kDini === 0);
  cek('KP acuan = policy.jam_masuk', '08:00', await acuan(K, '2026-09-14'), (await acuan(K, '2026-09-14')) === '08:00');

  // ══ B. Outlet dengan jadwal_operasional ═══════════════════════════════════
  cek('Indosteak Senin: acuan = jam_buka jadwal', '09:00', await acuan(S, '2026-09-14'), (await acuan(S, '2026-09-14')) === '09:00');
  cek('Indosteak Senin 14:59 (acuan 09:00 + 15)', '344', await hitung(S, '2026-09-14T07:59:00Z'), (await hitung(S, '2026-09-14T07:59:00Z')) === 344);
  cek('Indosteak Senin 09:15 (batas toleransi)', '0', await hitung(S, '2026-09-14T02:15:00Z'), (await hitung(S, '2026-09-14T02:15:00Z')) === 0);
  cek('Indosteak MINGGU 14:59 -- dinilai (buka 7 hari), walau policy.workdays Sen-Sab', '344, BUKAN null', await hitung(S, '2026-09-13T07:59:00Z'), (await hitung(S, '2026-09-13T07:59:00Z')) === 344);
  cek('Indokopi Senin 09:16', '1', await hitung(I, '2026-09-14T02:16:00Z'), (await hitung(I, '2026-09-14T02:16:00Z')) === 1);
  const iSabtu = await hitung(I, '2026-09-12T07:59:00Z');
  cek('Indokopi SABTU 14:59 (buka 24 jam, tanpa override)', 'null (tidak dinilai)', iSabtu, iSabtu === null);
  const iMinggu = await hitung(I, '2026-09-13T07:59:00Z');
  cek('Indokopi MINGGU 14:59 (buka 24 jam, tanpa override)', 'null (tidak dinilai)', iMinggu, iMinggu === null);
  cek('Indokopi Sabtu: acuan', 'null', await acuan(I, '2026-09-12'), (await acuan(I, '2026-09-12')) === null);

  // Override per orang menang atas jadwal, termasuk di hari 24 jam.
  await q(`update public.penugasan_absen set jam_masuk = '10:00' where user_id = $1 and lokasi_absen_id = $2`, [I.uid, I.titik]);
  cek('Indokopi Sabtu 24 jam DENGAN override 10:00, masuk 10:16', '1', await hitung(I, '2026-09-12T03:16:00Z'), (await hitung(I, '2026-09-12T03:16:00Z')) === 1);
  await q(`update public.penugasan_absen set jam_masuk = '13:00' where user_id = $1 and lokasi_absen_id = $2`, [S.uid, S.titik]);
  cek('Indosteak override 13:00 mengalahkan jadwal 09:00, masuk 13:16', '1', await hitung(S, '2026-09-14T06:16:00Z'), (await hitung(S, '2026-09-14T06:16:00Z')) === 1);
  await q(`update public.penugasan_absen set jam_masuk = null where lokasi_absen_id in ($1, $2) and user_id in ($3, $4)`, [I.titik, S.titik, I.uid, S.uid]);

  // Jadwal outlet diubah di dalam transaksi ini (dibatalkan di akhir).
  await q(`delete from public.jadwal_operasional where outlet_id = $1 and hari_iso = 7`, [S.outlet_id]);
  const sTutupMinggu = await hitung(S, '2026-09-13T07:59:00Z');
  cek('Indosteak dgn baris Minggu DIHAPUS (outlet terjadwal, hari itu tidak ada)', 'null (bukan hari kerja)', sTutupMinggu, sTutupMinggu === null);
  cek('...Senin tetap dinilai', '344', await hitung(S, '2026-09-14T07:59:00Z'), (await hitung(S, '2026-09-14T07:59:00Z')) === 344);
  await q(`update public.jadwal_operasional set jam_buka = null where outlet_id = $1 and hari_iso = 1`, [S.outlet_id]);
  const sKosong = await hitung(S, '2026-09-14T07:59:00Z');
  cek('Indosteak Senin: baris ada tapi jam_buka kosong & bukan 24 jam', 'null (tidak ada acuan)', sKosong, sKosong === null);
  await q(`delete from public.jadwal_operasional where outlet_id = $1`, [S.outlet_id]);
  cek('Outlet TANPA jadwal sama sekali -> jatuh ke policy.jam_masuk', '404 (Senin 14:59, acuan 08:00)', await hitung(S, '2026-09-14T07:59:00Z'), (await hitung(S, '2026-09-14T07:59:00Z')) === 404);
  const sPolMinggu = await hitung(S, '2026-09-13T07:59:00Z');
  cek('...dan policy.workdays (Minggu tidak dinilai)', 'null', sPolMinggu, sPolMinggu === null);

  // ══ C. Cuti (Kantor Pusat) ═════════════════════════════════════════════════
  await q(`insert into public.cuti (user_id, tanggal_mulai, tanggal_selesai, jenis, status) values ($1,'2026-09-15','2026-09-16','sakit','disetujui')`, [K.uid]);
  const c1 = await hitung(K, '2026-09-15T07:59:00Z');
  cek('cuti disetujui 15-16 Sep, masuk 15 Sep 14:59', 'null', c1, c1 === null);
  const c2 = await hitung(K, '2026-09-16T07:59:00Z');
  cek('hari terakhir cuti (16 Sep) masih tertutup (inklusif)', 'null', c2, c2 === null);
  cek('sehari SETELAH cuti (17 Sep) dihitung lagi', '404', await hitung(K, '2026-09-17T07:59:00Z'), (await hitung(K, '2026-09-17T07:59:00Z')) === 404);
  await q(`update public.cuti set status = 'diajukan' where user_id = $1`, [K.uid]);
  cek('cuti DIAJUKAN tidak membebaskan', '404', await hitung(K, '2026-09-15T07:59:00Z'), (await hitung(K, '2026-09-15T07:59:00Z')) === 404);
  await q(`update public.cuti set status = 'ditolak' where user_id = $1`, [K.uid]);
  cek('cuti DITOLAK tidak membebaskan', '404', await hitung(K, '2026-09-15T07:59:00Z'), (await hitung(K, '2026-09-15T07:59:00Z')) === 404);
  await q(`delete from public.cuti where user_id = $1`, [K.uid]);

  // ══ D. Trigger -- jalur klien (menyamar) ══════════════════════════════════
  // Pakai Kantor Pusat: orangnya bertitik satu; koordinat = titik itu sendiri.
  const P = await pasangan('Kantor Pusat', true);
  const titikLain = (await q(`select id from public.lokasi_absen where id <> $1 and aktif limit 1`, [P.titik])).rows[0].id;
  const derajatPerMeter = 1 / 111195;
  const masuk = (lat, lon, ekstra = {}) => ({
    sql: `insert into public.absensi (user_id, tanggal, tipe, waktu, lokasi_absen_id, latitude, longitude, status, jarak_meter, foto_path, terlambat_menit, keputusan_hrd, disetujui_oleh)
          values ($1, coalesce($5::date, (now() at time zone 'Asia/Jakarta')::date), coalesce($6::text, 'masuk')::absen_tipe, coalesce($7::timestamptz, now()), $2, $3, $4, coalesce($8::text, 'valid')::absen_status, $9, 'uji/x.jpg', $10, $11::text::absen_keputusan, $12)
          returning tanggal::text as tanggal, waktu, tipe, terlambat_menit, status::text as status, jarak_meter, keputusan_hrd::text as keputusan_hrd, disetujui_oleh`,
    params: [P.uid, ekstra.titik ?? P.titik, lat, lon, ekstra.tanggal ?? null, ekstra.tipe ?? null, ekstra.waktu ?? null, ekstra.status ?? null, ekstra.jarak ?? null, ekstra.terlambat ?? null, ekstra.keputusan ?? null, ekstra.setuju ?? null],
  });
  const harapanMenit = (await q(`select public.hitung_terlambat_menit($1::uuid, $2::uuid, now()) as n`, [P.uid, P.titik])).rows[0].n;
  await sebagaiKaryawan(P.uid);
  cek('penyamaran aktif', `auth.uid() = ${P.uid}`, (await q(`select auth.uid() as s`)).rows[0].s, (await q(`select auth.uid() as s`)).rows[0].s === P.uid);

  const hariIniWib = (await q(`select ((now() at time zone 'Asia/Jakarta')::date)::text as d`)).rows[0].d;
  const mm = masuk(P.latitude, P.longitude, { tanggal: '2020-01-01', waktu: '2020-01-01T01:00:00Z', terlambat: 0 });
  const d1 = await coba(mm.sql, mm.params);
  cek('klien mengirim tanggal=2020-01-01', `tanggal tersimpan = hari ini WIB (${hariIniWib})`, d1.row?.tanggal ?? d1.err, d1.ok && d1.row.tanggal === hariIniWib);
  const selisihDetik = d1.ok ? Math.abs(Date.now() - new Date(d1.row.waktu).getTime()) / 1000 : 9999;
  cek('klien mengirim waktu=2020-01-01', 'waktu tersimpan = jam server (selisih < 60 dtk)', `selisih ${selisihDetik.toFixed(1)} dtk`, selisihDetik < 60);
  cek('klien mengirim terlambat_menit=0 (curang)', `tersimpan = hitungan server (${harapanMenit}), bukan 0`, d1.row?.terlambat_menit, d1.ok && d1.row.terlambat_menit === harapanMenit);

  const mt = masuk(P.latitude, P.longitude, { titik: titikLain });
  const dTitik = await coba(mt.sql, mt.params);
  cek('klien memakai titik yang TIDAK ditugaskan', 'ditolak', dTitik.ok ? 'LOLOS_SALAH: berhasil' : `DITOLAK_BENAR: ${dTitik.err}`, !dTitik.ok);

  const mp = masuk(P.latitude, P.longitude, { tipe: 'pulang', terlambat: 999 });
  const dPulang = await coba(mp.sql, mp.params);
  cek("tipe 'pulang' dengan terlambat_menit=999 dari klien", 'null', dPulang.row?.terlambat_menit, dPulang.ok && dPulang.row.terlambat_menit === null);

  const dFungsi = await coba(`select public.hitung_terlambat_menit($1::uuid, $2::uuid, now())`, [P.uid, P.titik]);
  cek('authenticated memanggil hitung_terlambat_menit() langsung', 'ditolak (EXECUTE dicabut)', dFungsi.ok ? 'LOLOS_SALAH' : `DITOLAK_BENAR: ${dFungsi.err}`, !dFungsi.ok);

  // ══ E. Status radius & jarak dihitung server ═════════════════════════════
  const r = Number(P.radius_meter);
  const dekat = masuk(P.latitude, P.longitude, { status: 'di_luar_radius', jarak: 99999 });
  const e1 = await coba(dekat.sql, dekat.params);
  cek('di titik persis, klien mengaku status=di_luar_radius & jarak=99999', "status 'valid', jarak ~0", e1.ok ? `${e1.row.status}, ${e1.row.jarak_meter?.toFixed(3)} m` : e1.err, e1.ok && e1.row.status === 'valid' && e1.row.jarak_meter < 1);

  const jauh = masuk(P.latitude + 0.01, P.longitude, { status: 'valid', jarak: 0 });
  const e2 = await coba(jauh.sql, jauh.params);
  cek('~1,1 km dari titik, klien mengaku status=valid & jarak=0 (GPS jujur tapi status dipalsukan)', "status 'di_luar_radius', jarak 1000-1200 m", e2.ok ? `${e2.row.status}, ${e2.row.jarak_meter?.toFixed(1)} m` : e2.err, e2.ok && e2.row.status === 'di_luar_radius' && e2.row.jarak_meter > 1000 && e2.row.jarak_meter < 1200);
  const jarakJs = haversineJs(P.latitude + 0.01, P.longitude, P.latitude, P.longitude);
  cek('paritas haversine server vs lib/absen.ts', 'selisih < 0,01 m', e2.ok ? `${Math.abs(e2.row.jarak_meter - jarakJs).toExponential(2)} m` : e2.err, e2.ok && Math.abs(e2.row.jarak_meter - jarakJs) < 0.01);

  const dalam = masuk(P.latitude + (r * 0.5) * derajatPerMeter, P.longitude, { status: 'di_luar_radius' });
  const e3 = await coba(dalam.sql, dalam.params);
  cek(`separuh radius (${(r * 0.5).toFixed(0)} m dari radius ${r} m)`, "status 'valid'", e3.ok ? e3.row.status : e3.err, e3.ok && e3.row.status === 'valid');
  const luar = masuk(P.latitude + (r * 1.5) * derajatPerMeter, P.longitude, { status: 'valid' });
  const e4 = await coba(luar.sql, luar.params);
  cek(`1,5x radius (${(r * 1.5).toFixed(0)} m)`, "status 'di_luar_radius'", e4.ok ? e4.row.status : e4.err, e4.ok && e4.row.status === 'di_luar_radius');

  const mh = masuk(P.latitude, P.longitude, { status: 'manual_hrd' });
  const e5 = await coba(mh.sql, mh.params);
  cek("klien mengirim status='manual_hrd'", 'ditolak KERAS (bukan ditimpa diam-diam; perilaku 0027 terjaga)', e5.ok ? `LOLOS_SALAH: tersimpan sebagai ${e5.row.status}` : `DITOLAK_BENAR: ${e5.err}`, !e5.ok && e5.err.includes('tidak boleh dikirim'));

  const kh = masuk(P.latitude + 0.01, P.longitude, { keputusan: 'diterima', setuju: P.uid });
  const e6 = await coba(kh.sql, kh.params);
  cek("klien mengirim keputusan_hrd='diterima' + disetujui_oleh (menyetujui diri sendiri)", 'ditolak RLS absensi_insert (0027), tidak dinormalkan diam-diam', e6.ok ? `LOLOS_SALAH: tersimpan (${e6.row.keputusan_hrd})` : `DITOLAK_BENAR: ${e6.err}`, !e6.ok && e6.err.includes('row-level security'));

  const mn = masuk(null, null);
  const nl = await coba(mn.sql, mn.params);
  cek('koordinat kosong', 'ditolak', nl.ok ? 'LOLOS_SALAH' : `DITOLAK_BENAR: ${nl.err}`, !nl.ok);

  // Kebijakan 'tolak' ditegakkan server.
  await sebagaiOwner();
  await q(`update public.policy set value = '"tolak"' where key = 'absen_di_luar_radius'`);
  await sebagaiKaryawan(P.uid);
  const t1 = await coba(jauh.sql, jauh.params);
  cek("policy.absen_di_luar_radius='tolak', kirim dari ~1,1 km", 'ditolak server', t1.ok ? 'LOLOS_SALAH' : `DITOLAK_BENAR: ${t1.err}`, !t1.ok);
  const t2 = await coba(dekat.sql, dekat.params);
  cek("...tetapi di titik persis tetap diterima", "status 'valid'", t2.ok ? t2.row.status : t2.err, t2.ok && t2.row.status === 'valid');

  // ══ F. Jalur owner/skrip (tanpa JWT) TIDAK ditimpa ═══════════════════════
  await sebagaiOwner();
  const mo = masuk(P.latitude + 0.01, P.longitude, { tanggal: '2020-01-01', status: 'valid', jarak: 5, terlambat: 77 });
  const f1 = await coba(mo.sql, mo.params);
  cek('insert tanpa JWT (owner/skrip)', 'tidak ditimpa: 2020-01-01, valid, jarak 5, terlambat 77', f1.ok ? `${f1.row.tanggal}, ${f1.row.status}, ${f1.row.jarak_meter}, ${f1.row.terlambat_menit}` : f1.err, f1.ok && f1.row.tanggal === '2020-01-01' && f1.row.status === 'valid' && f1.row.jarak_meter === 5 && f1.row.terlambat_menit === 77);

  const pt = await q(`select count(*)::int as n from public.presensi_untuk_tanggal('2026-09-14')`);
  cek('presensi_untuk_tanggal() masih bisa dipanggil', '>= 1 baris', `n=${pt.rows[0].n}`, pt.rows[0].n >= 1);
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
console.log(`\n${hasil.length - gagal}/${hasil.length} lolos. Semua perubahan di-ROLLBACK.`);
process.exit(gagal === 0 ? 0 : 1);
