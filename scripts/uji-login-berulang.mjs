#!/usr/bin/env node
// Uji BERULANG (10 September 2026) untuk bug "kadang gagal login, refresh
// baru bisa" -- race cookie sesi @supabase/ssr: signInWithPassword menulis
// cookie lewat storage adapter, tapi `router.push()` (App Router, client-
// side) bisa menavigasi -- atau menyajikan cache Router dari SEBELUM login
// -- sebelum proxy.ts sungguh membaca cookie baru itu, jadi ditendang balik
// ke /masuk. Munculnya ACAK (tergantung timing), jadi HARUS diuji berulang,
// bukan sekali -- satu kali lolos tidak membuktikan apa-apa.
//
// Dua alur diuji, N kali beruntun, TIAP kali dengan browser context BARU
// (Playwright, setara "sudah logout total" -- tidak ada cookie tersisa):
//   1. /masuk -- AKUN UJI - Karyawan Resto (uji2), password TETAP (bukan
//      dipaksa ganti), murni menguji race sign-in -> halaman utama.
//   2. /ganti-password -- uji2 di-reset ke admin123+harus_ganti_password=
//      true SEBELUM tiap putaran, jalani alur penuh: masuk (dipaksa ganti)
//      -> submit password baru -> klik "Lanjutkan" di layar konfirmasi ->
//      harus mendarat di '/', BUKAN balik ke /masuk atau /ganti-password.
//
// GAGAL = URL akhir bukan '/' dalam batas waktu wajar. TIDAK PERNAH
// mengubah password akun sungguhan -- cuma uji2 (akun uji khusus).
//
// Pemakaian: node scripts/uji-login-berulang.mjs [jumlahPutaran]
// (default 20, sesuai instruksi -- naikkan ke 50 kalau versi SEBELUM
// perbaikan tidak menunjukkan kegagalan sama sekali dalam 20 putaran).

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
const BASE_URL = process.env.UJI_BASE_URL ?? 'http://localhost:3000';
const N = Number(process.argv[2] ?? 20);

const EMAIL = 'uji2@koperumnas.local';
const PASSWORD_TETAP = 'Uji-Login-Berulang-2026';

const db = new PgClient({ connectionString: dbUrl });
await db.connect();
const admin = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { rows } = await db.query('select id from auth.users where email = $1', [EMAIL]);
if (rows.length === 0) throw new Error(`${EMAIL} tidak ditemukan -- jalankan scripts/buat-akun-uji.mjs dulu.`);
const idAkun = rows[0].id;

async function tandaiSudahGantiPassword() {
  const { error } = await admin.auth.admin.updateUserById(idAkun, { password: PASSWORD_TETAP });
  if (error) throw new Error(`Gagal set password tetap: ${error.message}`);
  await db.query('update public.profile set harus_ganti_password = false where id = $1', [idAkun]);
}

async function tandaiBelumGantiPassword() {
  const { error } = await admin.auth.admin.updateUserById(idAkun, { password: 'admin123' });
  if (error) throw new Error(`Gagal set admin123: ${error.message}`);
  await db.query('update public.profile set harus_ganti_password = true where id = $1', [idAkun]);
}

async function ujiMasukSekali(browser) {
  const context = await browser.newContext(); // setara logout total -- tanpa cookie
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/masuk`);
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD_TETAP);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500); // beri waktu wajar utk navigasi selesai
    const urlAkhir = new URL(page.url()).pathname;
    return urlAkhir === '/';
  } finally {
    await context.close();
  }
}

async function ujiGantiPasswordSekali(browser) {
  await tandaiBelumGantiPassword();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(`${BASE_URL}/masuk`);
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill('admin123');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL(/\/ganti-password/, { timeout: 10000 });

    const passwordBaru = `Uji-Ganti-${Date.now()}`;
    await page.locator('input[type="password"]').nth(0).fill(passwordBaru);
    await page.locator('input[type="password"]').nth(1).fill(passwordBaru);
    await page.getByRole('button', { name: 'Simpan & Lanjutkan' }).click();
    // Toleran terhadap DUA bentuk UI -- versi SEBELUM perbaikan (10
    // September 2026) langsung router.push tanpa layar konfirmasi; versi
    // SESUDAH menampilkan tombol "Lanjutkan" dulu. Uji ini soal race cookie
    // (Tugas 1), bukan soal ada/tidaknya layar konfirmasi (Tugas 2) -- kalau
    // tombolnya muncul, klik; kalau tidak muncul dalam waktu wajar, anggap
    // versi lama (langsung pindah halaman).
    const tombolLanjutkan = page.getByRole('button', { name: 'Lanjutkan' });
    try {
      await tombolLanjutkan.waitFor({ state: 'visible', timeout: 3000 });
      await tombolLanjutkan.click();
    } catch {
      // versi lama -- tidak ada layar konfirmasi, lanjut cek URL langsung.
    }
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    const urlAkhir = new URL(page.url()).pathname;
    return urlAkhir === '/';
  } finally {
    await context.close();
  }
}

try {
  const browser = await chromium.launch();

  console.log(`\n═══ UJI 1: /masuk, ${N}x beruntun (browser context baru tiap kali) ═══`);
  await tandaiSudahGantiPassword();
  let gagalMasuk = 0;
  for (let i = 1; i <= N; i++) {
    const ok = await ujiMasukSekali(browser);
    if (!ok) gagalMasuk++;
    process.stdout.write(ok ? '.' : 'X');
  }
  console.log(`\n/masuk: ${N - gagalMasuk}/${N} berhasil langsung, ${gagalMasuk} GAGAL (ditendang balik ke /masuk).`);

  console.log(`\n═══ UJI 2: /ganti-password, ${N}x beruntun ═══`);
  let gagalGanti = 0;
  for (let i = 1; i <= N; i++) {
    const ok = await ujiGantiPasswordSekali(browser);
    if (!ok) gagalGanti++;
    process.stdout.write(ok ? '.' : 'X');
  }
  console.log(`\n/ganti-password: ${N - gagalGanti}/${N} berhasil langsung, ${gagalGanti} GAGAL.`);

  await browser.close();

  console.log(`\n═══ RINGKASAN (N=${N}) ═══`);
  console.log(`/masuk          : ${gagalMasuk} gagal dari ${N}`);
  console.log(`/ganti-password : ${gagalGanti} gagal dari ${N}`);
  process.exitCode = gagalMasuk === 0 && gagalGanti === 0 ? 0 : 1;
} finally {
  // Pulihkan uji2 ke baseline admin123 + harus_ganti_password=true.
  const { error: errPw } = await admin.auth.admin.updateUserById(idAkun, { password: 'admin123' });
  if (errPw) console.error(`🛑 GAGAL memulihkan password uji2: ${errPw.message}`);
  await db.query('update public.profile set harus_ganti_password = true where id = $1', [idAkun]);
  const { rows: cek } = await db.query('select harus_ganti_password from public.profile where id = $1', [idAkun]);
  console.log(cek[0]?.harus_ganti_password === true ? '\nuji2 dipulihkan ke baseline (admin123, harus_ganti_password=true).' : '\n🛑 uji2 BELUM PULIH.');
  await db.end();
}
