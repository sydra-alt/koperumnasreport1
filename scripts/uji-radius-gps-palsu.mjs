#!/usr/bin/env node
// Uji radius presensi dengan koordinat GPS PALSU ~150 km dari titik absen,
// lewat browser SUNGGUHAN (Playwright, Chromium) yang meng-override
// geolocation persis mekanisme Chrome DevTools Sensors panel
// (Emulation.setGeolocationOverride via CDP) -- instruksi eksplisit user,
// diminta dua kali sebelumnya, belum pernah dijawab dengan bukti nyata.
//
// Dadang dipakai (penugasan_absen di "Lokasi Uji", migrasi 0032,
// -6.982980702734919, 107.63522500320248) -- posisi PALSU digeser ~150 km
// ke utara (1 derajat lintang ~= 111.32 km).
//
// Dua skenario, policy.absen_di_luar_radius DIUBAH SEMENTARA lalu
// DIKEMBALIKAN (transaksi terpisah, bukan BEGIN/ROLLBACK karena Playwright
// perlu koneksi HTTP nyata ke server yang membaca policy dari koneksi LAIN):
//   1. 'izinkan_dengan_tanda' (NILAI PRODUKSI SAAT INI) -- harap DITANDAI
//      🟡, TIDAK diterima diam-diam tanpa peringatan.
//   2. 'tolak' -- harap DITOLAK KERAS, tidak bisa lanjut sama sekali.

import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const BASE_URL = process.env.UJI_BASE_URL ?? 'http://localhost:3000';
const EMAIL = 'dadang@koperumnas.local';
const DADANG_ID = 'f43d8ddb-beb1-4597-8906-ada139e7327b';
// Password SEMENTARA khusus uji ini -- BUKAN admin123, supaya tidak
// tertukar dengan kredensial 7 akun uji yang sebenarnya. Dikembalikan
// (password + harus_ganti_password) ke keadaan semula di blok finally.
const PASSWORD_UJI = 'uji-radius-sementara-2026';

// Lokasi Uji (migrasi 0032) + ~150 km ke utara (murni offset lintang).
const LOKASI_ASLI = { lat: -6.982980702734919, lon: 107.63522500320248 };
const POSISI_PALSU = { latitude: LOKASI_ASLI.lat + 150 / 111.32, longitude: LOKASI_ASLI.lon };

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function setPolicy(nilai) {
  await db.query(`update policy set value = to_jsonb($1::text) where key = 'absen_di_luar_radius';`, [nilai]);
}
const { rows: policyAsli } = await db.query(`select value from policy where key = 'absen_di_luar_radius';`);
const nilaiAsli = policyAsli[0].value.replace(/"/g, '');
console.log(`policy.absen_di_luar_radius SAAT INI (produksi): "${nilaiAsli}"\n`);

// Set password uji sementara untuk Dadang lewat Auth Admin API (satu-satunya
// jalur resmi -- lihat scripts/set-password.mjs) supaya Playwright bisa
// login sungguhan lewat /masuk, bukan penyamaran JWT.
{
  const { error } = await admin.auth.admin.updateUserById(DADANG_ID, { password: PASSWORD_UJI });
  if (error) throw new Error(`Gagal set password uji Dadang: ${error.message}`);
  await db.query(`update profile set harus_ganti_password = false where id = $1;`, [DADANG_ID]);
  console.log('Password uji sementara Dadang berhasil diset, harus_ganti_password dikosongkan sementara.\n');
}

const hasil = [];
function catat(nomor, skenario, harapan, mentah, lolos) {
  hasil.push({ nomor, skenario, harapan, mentah, lolos });
}

async function jalankanSkenario(nomorUji, labelPolicy) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ geolocation: POSISI_PALSU, permissions: ['geolocation'] });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/masuk`);
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Kata sandi').fill(PASSWORD_UJI);
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
      const ditandai = teksSetelah.includes('🟡') && /luar jangkauan|di luar radius|ditandai/i.test(teksSetelah);
      catat(
        nomorUji,
        `[izinkan_dengan_tanda] Absen dari posisi ~150km (jarak dihitung ${jarakMeter}m) -- HARUS ditandai 🟡, bukan diterima diam-diam`,
        'layar menampilkan 🟡 + peringatan luar radius, tombol "Lanjutkan Absen" (bukan langsung ke kamera tanpa peringatan)',
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
  console.log('════ SKENARIO 1 -- policy.absen_di_luar_radius = "izinkan_dengan_tanda" (NILAI PRODUKSI SAAT INI) ════\n');
  await jalankanSkenario(1, 'izinkan_dengan_tanda');

  console.log('════ SKENARIO 2 -- policy.absen_di_luar_radius = "tolak" (diubah sementara utk uji ini) ════\n');
  await setPolicy('tolak');
  await jalankanSkenario(2, 'tolak');
} finally {
  await setPolicy(nilaiAsli);
  const { rows: cekKembali } = await db.query(`select value from policy where key = 'absen_di_luar_radius';`);
  console.log(`policy.absen_di_luar_radius DIKEMBALIKAN ke nilai produksi: ${cekKembali[0].value}`);

  // Kembalikan Dadang ke keadaan semula -- password admin123 seragam +
  // harus_ganti_password=true, sama seperti 6 akun uji lainnya (batch
  // keamanan password sebelumnya).
  const { error: errPw } = await admin.auth.admin.updateUserById(DADANG_ID, { password: 'admin123' });
  if (errPw) console.error(`GAGAL mengembalikan password Dadang ke admin123: ${errPw.message}`);
  await db.query(`update profile set harus_ganti_password = true where id = $1;`, [DADANG_ID]);
  console.log('Akun Dadang dikembalikan: password admin123, harus_ganti_password = true.');

  await db.end();
}

console.table(hasil.map((h) => ({ '#': h.nomor, skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.length === 2 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS -- sistem TIDAK menerima koordinat palsu 150km tanpa peringatan/penolakan' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
