#!/usr/bin/env node
// Uji regresi ZONA WAKTU EKSPOR ABSENSI (dilaporkan user 31 Agustus 2026):
// layar menunjukkan 09.23 WIB, Excel menulis 02:23 -- selisih TEPAT 7 jam
// (UTC vs WIB) karena `new Date(r.waktu)` dikirim mentah ke ExcelJS, yang
// menyerialkan Date lewat getter UTC TANPA konversi zona waktu. Diperbaiki
// lewat `jamUntukExcel()` di lib/tanggal.ts (dipakai di
// app/api/ekspor/absensi/route.ts).
//
// Uji ini SUNGGUHAN lewat HTTP (bukan simulasi unit) -- lihat pola
// uji-ekspor-keuangan-curl.mjs: login sungguhan sebagai AKUN UJI - HRD Kadiv
// (uji4@koperumnas.local, role kadiv + divisi HRD -- lolos gerbang
// `bolehKadivHrd` yang sama dipakai Sabrina sungguhan), panggil endpoint
// ekspor absensi sungguhan, baca file .xlsx yang dikembalikan dengan
// ExcelJS, lalu bandingkan nilai di sel Excel dengan nilai yang akan tampil
// di layar (`jamWIB`) untuk INSTANT WIB yang SAMA PERSIS -- harus sama
// persis, sesuai permintaan eksplisit user.
//
// Diganti dari Sabrina sungguhan ke uji4 (7 September 2026, insiden
// Qasim/Ryan -- skrip uji tidak boleh menyentuh akun orang sungguhan, lihat
// docs/04-CATATAN-TEKNIS.md §7).
//
// Baris absensi dibuat SEMENTARA untuk AKUN UJI - Karyawan Resto
// (uji2@koperumnas.local, BUKAN dicari otomatis dari karyawan sungguhan
// lagi -- alasan sama di atas), lalu DIHAPUS di blok finally lewat `id`-nya
// sendiri (bukan sapuan user+tanggal) -- tidak menyentuh data presensi
// siapa pun yang sungguhan.

import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { Client as PgClient } from 'pg';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
const BASE_URL = process.env.UJI_BASE_URL ?? 'http://localhost:3000';

if (!supabaseUrl || !anonKey || !serviceRoleKey || !dbUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL wajib ada di .env.local');
  process.exit(1);
}

const db = new PgClient({ connectionString: dbUrl });
await db.connect();

// --- Jam WIB SUNGGUHAN yang diketahui, sama persis dengan gejala user (09:23 WIB) ---
const JAM_WIB = { jam: 9, menit: 23, detik: 44 };

let idBaris = null;
let idPenguji = null;
let admin = null;
try {
  // 1) AKUN UJI - Karyawan Resto (uji2@koperumnas.local) -- bukan karyawan
  //    sungguhan yang dicari otomatis lagi (diganti 7 September 2026, lihat
  //    catatan di atas). Buang dulu baris absensi uji lama miliknya hari
  //    ini kalau ada (sisa run sebelumnya yang gagal), supaya tidak bentrok
  //    dgn Map pivot (kunci user_id|tanggal di app/api/ekspor/absensi/route.ts).
  const { rows: penggunaRows } = await db.query("select id, nama from public.profile where nama = 'AKUN UJI - Karyawan Resto'");
  if (penggunaRows.length === 0) throw new Error('AKUN UJI - Karyawan Resto tidak ditemukan -- jalankan scripts/buat-akun-uji.mjs dulu.');
  const user = penggunaRows[0];
  await db.query(`delete from public.absensi where user_id = $1 and tanggal = (now() at time zone 'Asia/Jakarta')::date`, [user.id]);
  console.log(`Pakai AKUN UJI: ${user.nama} (baris absensi uji lama miliknya hari ini, kalau ada, sudah dibuang).`);

  const { rows: tglRows } = await db.query(`select (now() at time zone 'Asia/Jakarta')::date as t`);
  const tanggalWib = tglRows[0].t.toISOString().slice(0, 10);
  const bulan = tanggalWib.slice(0, 7);

  // Instant UTC utk 09:23:44 WIB (UTC = WIB - 7 jam) pada tanggal WIB hari ini.
  const [th, bl, hr] = tanggalWib.split('-').map(Number);
  const waktuUtc = new Date(Date.UTC(th, bl - 1, hr, JAM_WIB.jam - 7, JAM_WIB.menit, JAM_WIB.detik));

  // 2) Sisipkan baris absensi UJI langsung (bypass RLS -- koneksi pemilik tabel).
  const { rows: insertRows } = await db.query(
    `insert into public.absensi (user_id, tanggal, tipe, waktu, status, foto_path)
     values ($1, $2, 'masuk', $3, 'valid', '(uji-zona-waktu, tidak ada file sungguhan)')
     returning id;`,
    [user.id, tanggalWib, waktuUtc.toISOString()],
  );
  idBaris = insertRows[0].id;
  console.log(`Baris absensi uji dibuat (id=${idBaris}), waktu=${waktuUtc.toISOString()} (=${JAM_WIB.jam}:${String(JAM_WIB.menit).padStart(2, '0')} WIB).`);

  // 3) Login sungguhan sebagai AKUN UJI - HRD Kadiv (uji4@koperumnas.local,
  //    lolos gerbang `bolehKadivHrd` yang sama dipakai Sabrina sungguhan) --
  //    BUKAN Sabrina lagi (diganti 7 September 2026, lihat catatan di atas).
  const { rows: pengujiRows } = await db.query("select id from auth.users where email = 'uji4@koperumnas.local'");
  if (pengujiRows.length === 0) throw new Error('Akun uji4@koperumnas.local tidak ditemukan -- jalankan scripts/buat-akun-uji.mjs dulu.');
  idPenguji = pengujiRows[0].id;

  admin = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const passwordSementara = crypto.randomBytes(12).toString('base64url').slice(0, 16);
  const { error: errReset } = await admin.auth.admin.updateUserById(idPenguji, { password: passwordSementara });
  if (errReset) throw new Error(`Gagal reset password AKUN UJI: ${errReset.message}`);
  // profile.harus_ganti_password default TRUE (kolom, bukan trigger --
  // dicek langsung 7 September 2026, TIDAK ADA trigger apa pun di
  // auth.users) -- dimatikan sementara di sini supaya middleware tidak
  // mengalihkan panggilan API ini ke /ganti-password, dikembalikan ke true
  // di blok finally dan DIBUKTIKAN lewat baca ulang DB.
  await db.query('update public.profile set harus_ganti_password = false where id = $1;', [idPenguji]);

  const jar = new Map();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => Array.from(jar.entries()).map(([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => { for (const { name, value } of cookiesToSet) jar.set(name, value); },
    },
  });
  const { error: errLogin } = await supabase.auth.signInWithPassword({ email: 'uji4@koperumnas.local', password: passwordSementara });
  if (errLogin) throw new Error(`Login AKUN UJI gagal: ${errLogin.message}`);
  const cookieHeader = Array.from(jar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');

  // 4) Panggil endpoint ekspor absensi SUNGGUHAN lewat HTTP, baca file .xlsx sungguhan.
  const res = await fetch(`${BASE_URL}/api/ekspor/absensi?bulan=${bulan}`, { headers: { Cookie: cookieHeader }, redirect: 'manual' });
  const buf = Buffer.from(await res.arrayBuffer());
  if (res.status !== 200 || !res.headers.get('content-type')?.includes('spreadsheetml')) {
    throw new Error(`Ekspor gagal (status ${res.status}, content-type ${res.headers.get('content-type')}). Isi awal: ${buf.subarray(0, 300).toString('utf8')}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.worksheets[0];

  // Baris 1 = keterangan (jam masuk kebijakan + toleransi), baris 2 = header
  // kolom, data mulai baris 3 -- instruksi eksplisit user 31 Agustus 2026
  // ("angka yang menyentuh penilaian orang harus bisa ditelusuri tanpa
  // bertanya"), lihat app/api/ekspor/absensi/route.ts.
  const keterangan = String(sheet.getCell('A1').value ?? '');
  console.log(`Baris keterangan (A1): "${keterangan}"`);
  if (!/toleransi \d+ menit/i.test(keterangan)) {
    throw new Error(`Baris keterangan tidak menyebut toleransi dalam menit: "${keterangan}"`);
  }

  const headerTerlambat = String(sheet.getRow(2).getCell(5).value ?? '');
  console.log(`Header kolom terlambat (baris 2, kolom E): "${headerTerlambat}"`);
  if (!/toleransi \d+ menit/i.test(headerTerlambat)) {
    throw new Error(`Judul kolom "Terlambat" tidak menyebut toleransi: "${headerTerlambat}"`);
  }

  let barisDitemukan = null;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return; // baris 1 keterangan, baris 2 header
    if (row.getCell(1).value === user.nama) barisDitemukan = row;
  });
  if (!barisDitemukan) throw new Error(`Baris "${user.nama}" tidak ditemukan di sheet Excel yang diekspor.`);

  const selJamMasuk = barisDitemukan.getCell(4).value; // kolom 'Jam Masuk'
  if (!(selJamMasuk instanceof Date)) throw new Error(`Sel Jam Masuk bukan Date: ${JSON.stringify(selJamMasuk)}`);

  // Excel/ExcelJS membaca Date lewat getter UTC (tanpa konsep zona waktu) --
  // ini PERSIS cara Microsoft Excel akan menampilkan sel ini ke user, jadi
  // getUTCHours/getUTCMinutes di sini mensimulasikan "apa yang dilihat user
  // saat membuka file .xlsx".
  const jamExcelDitampilkan = `${String(selJamMasuk.getUTCHours()).padStart(2, '0')}:${String(selJamMasuk.getUTCMinutes()).padStart(2, '0')}`;
  const jamLayarSeharusnya = `${String(JAM_WIB.jam).padStart(2, '0')}:${String(JAM_WIB.menit).padStart(2, '0')}`;

  console.log(`\nJam di layar (WIB sungguhan)   : ${jamLayarSeharusnya}`);
  console.log(`Jam di Excel (dibaca spt user)  : ${jamExcelDitampilkan}`);

  if (jamExcelDitampilkan === jamLayarSeharusnya) {
    console.log('\n✅ LOLOS -- jam di Excel sama persis dengan jam di layar (WIB), bukan UTC.');
    process.exitCode = 0;
  } else {
    console.log('\n🛑 GAGAL -- jam di Excel TIDAK sama dengan jam di layar. Bug zona waktu belum tertutup.');
    process.exitCode = 1;
  }
} finally {
  // Bersihkan baris uji, tidak peduli lolos/gagal -- tidak boleh menyentuh
  // presensi sungguhan siapa pun.
  if (idBaris) {
    await db.query('delete from public.absensi where id = $1', [idBaris]);
    console.log(`\nBaris absensi uji (id=${idBaris}) dihapus.`);
  }
  // Kembalikan AKUN UJI ke keadaan semula -- password admin123 seragam +
  // harus_ganti_password=true, DIBUKTIKAN lewat baca ulang DB (bukan
  // dipercaya dari nilai kembalian -- pelajaran insiden Qasim/Ryan, 7
  // September 2026, lihat docs/04-CATATAN-TEKNIS.md §7).
  if (idPenguji && admin) {
    const { error: errPw } = await admin.auth.admin.updateUserById(idPenguji, { password: 'admin123' });
    if (errPw) console.error(`🛑 GAGAL mengembalikan password AKUN UJI ke admin123: ${errPw.message}`);
    await db.query('update public.profile set harus_ganti_password = true where id = $1;', [idPenguji]);
    const { rows: cekAkun } = await db.query(
      `select p.harus_ganti_password, u.updated_at, u.last_sign_in_at from public.profile p join auth.users u on u.id = p.id where p.id = $1`,
      [idPenguji],
    );
    const pulihSempurna = cekAkun[0]?.harus_ganti_password === true && new Date(cekAkun[0].updated_at) > new Date(cekAkun[0].last_sign_in_at);
    console.log(pulihSempurna
      ? 'AKUN UJI dikembalikan: password admin123 (dibuktikan lewat updated_at > last_sign_in_at), harus_ganti_password = true.'
      : `🛑 AKUN UJI BELUM PULIH SEPENUHNYA -- ${JSON.stringify(cekAkun[0])}.`);
  }
  await db.end();
}
