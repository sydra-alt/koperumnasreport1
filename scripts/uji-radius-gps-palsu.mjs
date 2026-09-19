#!/usr/bin/env node
// ⚠️⚠️ PERINGATAN -- SKRIP INI MENULIS SUNGGUHAN KE DATABASE YANG JUGA PRODUKSI (26 orang) ⚠️⚠️
// TIDAK bisa di-ROLLBACK (server yang diuji membaca lewat koneksi lain, jadi transaksi mustahil).
// Yang diubah: password + profile.harus_ganti_password akun uji5 -- HANYA akun uji, tabel: auth.users, profile.
// KEBIJAKAN PRODUKSI (policy.absen_di_luar_radius) TIDAK LAGI DIUBAH (19 September 2026): dulu skrip ini
// meng-UPDATE policy di database bersama -- kalau mati di tengah, semua karyawan kena kebijakan uji.
// Sekarang kebijakan dan titik uji disuntikkan di BROWSER lewat intersepsi respons REST (Playwright route).
// Dipulihkan otomatis di finally DAN saat Ctrl-C/galat (scripts/_pengaman-uji.mjs). Kalau proses
// DIMATIKAN PAKSA (kill -9): jalankan `node scripts/pulihkan-akun-uji.mjs` SEBELUM akun uji dipakai lagi.
//
// Uji radius presensi dengan koordinat GPS PALSU ~150 km dari titik absen,
// lewat browser SUNGGUHAN (Playwright, Chromium) yang meng-override
// geolocation persis mekanisme Chrome DevTools Sensors panel
// (Emulation.setGeolocationOverride via CDP) -- instruksi eksplisit user,
// diminta dua kali sebelumnya, belum pernah dijawab dengan bukti nyata.
//
// AKUN UJI - Tanpa Peran (uji5@koperumnas.local) dipakai -- BUKAN Dadang
// sungguhan lagi (diganti 7 September 2026, insiden Qasim/Ryan: skrip uji
// tidak boleh pernah menyentuh akun orang sungguhan, lihat
// docs/04-CATATAN-TEKNIS.md §7 dan scripts/buat-akun-uji.mjs). Posisi PALSU
// digeser ~150 km ke utara dari titik uji (1 derajat lintang ~= 111.32 km).
//
// Dua skenario. Kebijakan (policy.absen_di_luar_radius) dan titik absen uji
// SAMA SEKALI TIDAK ditulis ke database -- browser meminta `policy` dan
// `penugasan_absen` lewat REST, dan Playwright mengganti RESPONS-nya:
//   - policy: nilai absen_di_luar_radius diganti sesuai skenario
//   - penugasan_absen: diganti satu titik SINTETIS (bukan lokasi siapa pun --
//     "Lokasi Uji" lama sengaja dihapus di migrasi 0054 karena itu koordinat
//     rumah CEO, dan uji5 tidak punya titik absen lagi)
// Skrip ini berhenti SEBELUM kamera, tidak pernah insert ke `absensi`.
//   1. 'izinkan_dengan_tanda' (nilai produksi normal) -- harap DITANDAI
//      (layar "Di luar jangkauan" + "ditandai", rail kuning -- BUKAN emoji
//      di teks, koreksi 7 September 2026), TIDAK diterima diam-diam tanpa
//      peringatan.
//   2. 'tolak' -- harap DITOLAK KERAS, tidak bisa lanjut sama sekali.

import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { Client } from 'pg';
import { pasangPemulih } from './_pengaman-uji.mjs';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const BASE_URL = process.env.UJI_BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'uji5@koperumnas.local';
const db0 = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await db0.connect();
const { rows: uji5Rows } = await db0.query("select id from auth.users where email = $1", [EMAIL]);
if (uji5Rows.length === 0) throw new Error(`${EMAIL} tidak ditemukan -- jalankan scripts/buat-akun-uji.mjs dulu.`);
const AKUN_UJI_ID = uji5Rows[0].id;
await db0.end();
// Password SEMENTARA khusus uji ini -- BUKAN admin123, supaya tidak
// tertukar dengan kredensial akun uji standar. Dikembalikan (password +
// harus_ganti_password) ke keadaan semula di blok finally, DIBUKTIKAN lewat
// baca ulang DB (bukan dipercaya dari nilai kembalian) -- pelajaran insiden
// Qasim/Ryan.
const PASSWORD_UJI = 'uji-radius-sementara-2026';

// Titik uji SINTETIS (bukan lokasi siapa pun) -- hanya disuntikkan ke respons
// REST di browser, tidak pernah ditulis ke database. Posisi PALSU = ~150 km ke
// utara dari titik ini (murni offset lintang).
const TITIK_UJI = { lat: -6.1754, lon: 106.8272 };
const POSISI_PALSU = { latitude: TITIK_UJI.lat + 150 / 111.32, longitude: TITIK_UJI.lon };

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Bentuk persis select di lib/api/absensi.ts useTitikAbsenSaya.
const PENUGASAN_UJI = [
  {
    jam_masuk: null,
    jam_pulang: null,
    lokasi_absen: {
      id: '00000000-0000-4000-8000-0000000000a5',
      nama: 'Titik Uji (sintetis, hanya di browser)',
      latitude: TITIK_UJI.lat,
      longitude: TITIK_UJI.lon,
      radius_meter: 200,
      aktif: true,
    },
  },
];

// Ganti respons REST di sisi browser. Header dikopi tanpa content-encoding /
// content-length karena body diganti (CORS + tipe konten tetap dipertahankan).
async function pasangIntersepsi(context, nilaiPolicy) {
  const balas = async (route, ubah) => {
    const resp = await route.fetch();
    const headers = { ...resp.headers() };
    delete headers['content-encoding'];
    delete headers['content-length'];
    await route.fulfill({ status: resp.status(), headers, body: JSON.stringify(ubah(await resp.json())) });
  };
  await context.route('**/rest/v1/policy*', (route) =>
    balas(route, (rows) => rows.map((r) => (r.key === 'absen_di_luar_radius' ? { ...r, value: nilaiPolicy } : r))),
  );
  await context.route('**/rest/v1/penugasan_absen*', (route) => balas(route, () => PENUGASAN_UJI));
}

// Pemulihan akun uji -- idempoten, DIDAFTARKAN SEBELUM password diubah supaya
// tidak ada celah "sudah berubah tapi belum terdaftar". Dipanggil dari finally
// DAN dari penangan sinyal/galat. Dibuktikan lewat baca ulang DB, bukan dipercaya
// dari nilai kembalian (pelajaran insiden Qasim/Ryan, 7 September 2026).
const pulihkan = pasangPemulih('uji-radius-gps-palsu', async () => {
  const { error: errPw } = await admin.auth.admin.updateUserById(AKUN_UJI_ID, { password: 'admin123' });
  if (errPw) console.error(`🛑 GAGAL mengembalikan password AKUN UJI ke admin123: ${errPw.message}`);
  await db.query(`update profile set harus_ganti_password = true where id = $1;`, [AKUN_UJI_ID]);
  const { rows: cekAkun } = await db.query(
    `select p.harus_ganti_password, u.updated_at, u.last_sign_in_at from public.profile p join auth.users u on u.id = p.id where p.id = $1`,
    [AKUN_UJI_ID],
  );
  const pulihSempurna = cekAkun[0]?.harus_ganti_password === true && new Date(cekAkun[0].updated_at) > new Date(cekAkun[0].last_sign_in_at);
  console.log(pulihSempurna
    ? 'AKUN UJI dikembalikan: password admin123 (dibuktikan lewat updated_at > last_sign_in_at), harus_ganti_password = true.'
    : `🛑 AKUN UJI BELUM PULIH SEPENUHNYA -- ${JSON.stringify(cekAkun[0])}. Jalankan: node scripts/pulihkan-akun-uji.mjs`);
  await db.end();
});

const hasil = [];
function catat(nomor, skenario, harapan, mentah, lolos) {
  hasil.push({ nomor, skenario, harapan, mentah, lolos });
}

async function jalankanSkenario(nomorUji, labelPolicy) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ geolocation: POSISI_PALSU, permissions: ['geolocation'] });
  await pasangIntersepsi(context, labelPolicy);
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/masuk`);
    await page.getByLabel('Email').fill(EMAIL);
    // getByLabel('Kata sandi') mulai bentrok dengan tombol "Tampilkan kata
    // sandi" (fitur show/hide password ditambah belakangan, di luar cakupan
    // sisir skrip ini) -- selector persis type=password, ditemukan saat
    // verifikasi migrasi akun uji 7 September 2026.
    await page.locator('input[type="password"]').fill(PASSWORD_UJI);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(`${BASE_URL}/`, { timeout: 15000 });

    await page.goto(`${BASE_URL}/absen`);

    // Layar persetujuan privasi presensi muncul sekali per akun (fitur 30
    // Agustus 2026) -- klik kalau muncul. PENTING: isVisible() TIDAK
    // menunggu (cuma snapshot sesaat) -- dengan kompilasi Turbopack
    // dev-mode pertama kali yang bisa lambat, itu membuatnya salah
    // melaporkan "belum ada" lalu langsung dilewati. Pakai waitFor()
    // (auto-wait sungguhan) dibungkus try/catch untuk kasus "memang sudah
    // pernah setuju, layar ini tidak akan pernah muncul".
    const tombolSetuju = page.getByRole('button', { name: 'Saya mengerti dan setuju' });
    try {
      await tombolSetuju.waitFor({ state: 'visible', timeout: 30000 });
      await tombolSetuju.click();
    } catch {
      // layar privasi tidak muncul -- anggap sudah pernah disetujui sebelumnya.
    }

    await page.getByRole('button', { name: /Absen Masuk/ }).click({ timeout: 30000 });

    // Layar "konfirmasi_titik" -- tunjukkan jarak yang SUNGGUHAN dihitung dari koordinat palsu.
    await page.getByText('meter', { exact: false }).first().waitFor({ timeout: 15000 });
    const teksJarak = await page.locator('main').innerText();
    const jarakMatch = teksJarak.match(/([\d.,]+)\s*meter/);
    const jarakMeter = jarakMatch ? Number(jarakMatch[1].replace(/[.,]/g, '')) : null;
    console.log(`[${labelPolicy}] Jarak yang dihitung app dari posisi palsu: ${jarakMeter} meter`);

    await page.getByRole('button', { name: 'Lanjutkan' }).click();
    await page.waitForTimeout(1500); // biarkan layar berikutnya render sepenuhnya
    const teksSetelah = await page.locator('main').innerText();
    console.log(`[${labelPolicy}] Layar setelah "Lanjutkan":\n${teksSetelah}\n`);

    // Ditulis ke os.tmpdir(), BUKAN root repo -- ini artefak bukti uji sekali
    // pakai, jangan sampai nyangkut di git status.
    await page.screenshot({ path: path.join(os.tmpdir(), `uji-radius-${labelPolicy}.png`) });
    console.log(`[${labelPolicy}] Screenshot: ${path.join(os.tmpdir(), `uji-radius-${labelPolicy}.png`)}`);

    if (labelPolicy === 'izinkan_dengan_tanda') {
      // Uji ini SEBELUMNYA mengharap literal emoji 🟡 di teks layar -- UI
      // TIDAK PERNAH menulis emoji itu (status "ditandai" disampaikan lewat
      // warna `rail-kuning`, bukan karakter di teks), jadi assertion lama
      // ini gagal walau UI-nya benar. Diperbaiki 7 September 2026 (instruksi
      // eksplisit user: "perbaiki ujinya, jangan UI-nya") -- cek teks NYATA
      // yang ditulis app/absen/page.tsx layar 'luar_radius_tanda': judul "Di
      // luar jangkauan", badan "akan ditandai untuk diperiksa HRD", dan
      // tombol "Lanjutkan Absen" (BUKAN langsung ke kamera tanpa peringatan).
      const ditandai = /di luar jangkauan/i.test(teksSetelah) && /ditandai/i.test(teksSetelah) && teksSetelah.includes('Lanjutkan Absen');
      catat(
        nomorUji,
        `[izinkan_dengan_tanda] Absen dari posisi ~150km (jarak dihitung ${jarakMeter}m) -- HARUS ditandai, bukan diterima diam-diam`,
        'layar menampilkan "Di luar jangkauan" + "ditandai" + tombol "Lanjutkan Absen" (bukan langsung ke kamera tanpa peringatan)',
        `jarak=${jarakMeter}m; teks="${teksSetelah.slice(0, 200)}..."`,
        jarakMeter !== null && jarakMeter > 100000 && ditandai,
      );
    } else {
      const ditolak = /tidak bisa dilakukan|hubungi HRD|Coba Lagi/i.test(teksSetelah) && !teksSetelah.includes('Lanjutkan Absen');
      catat(
        nomorUji,
        `[tolak] Absen dari posisi ~150km (jarak dihitung ${jarakMeter}m) -- HARUS ditolak keras, tidak ada jalan lanjut ke kamera`,
        'layar menampilkan penolakan keras, TIDAK ADA tombol "Lanjutkan Absen"',
        `jarak=${jarakMeter}m; teks="${teksSetelah.slice(0, 200)}..."`,
        jarakMeter !== null && jarakMeter > 100000 && ditolak,
      );
    }
  } catch (err) {
    catat(nomorUji, `[${labelPolicy}] eksekusi skenario`, '-', `ERROR: ${err.message}`, false);
  } finally {
    await browser.close();
  }
}

try {
  // Set password uji sementara utk AKUN UJI lewat Auth Admin API (satu-satunya
  // jalur resmi -- lihat scripts/set-password.mjs) supaya Playwright bisa
  // login sungguhan lewat /masuk, bukan penyamaran JWT.
  const { error } = await admin.auth.admin.updateUserById(AKUN_UJI_ID, { password: PASSWORD_UJI });
  if (error) throw new Error(`Gagal set password uji: ${error.message}`);
  await db.query(`update profile set harus_ganti_password = false where id = $1;`, [AKUN_UJI_ID]);
  console.log('Password uji sementara berhasil diset, harus_ganti_password dikosongkan sementara.\n');

  console.log('════ SKENARIO 1 -- policy.absen_di_luar_radius = "izinkan_dengan_tanda" (disuntikkan di browser) ════\n');
  await jalankanSkenario(1, 'izinkan_dengan_tanda');

  console.log('════ SKENARIO 2 -- policy.absen_di_luar_radius = "tolak" (disuntikkan di browser) ════\n');
  await jalankanSkenario(2, 'tolak');
} finally {
  await pulihkan();
}

console.table(hasil.map((h) => ({ '#': h.nomor, skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.length === 2 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS -- sistem TIDAK menerima koordinat palsu 150km tanpa peringatan/penolakan' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
