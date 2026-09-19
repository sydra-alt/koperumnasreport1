#!/usr/bin/env node
// 🛑🛑 BAHAYA -- NAMA FILE INI MENYESATKAN: BUKAN untuk akun uji, BUKAN alat pemulih. 🛑🛑
// Mereset password SEMUA akun di akun.json (40+ KARYAWAN SUNGGUHAN, database produksi) ke 'admin123'
// TANPA menyentuh harus_ganti_password -- yang sudah pernah ganti password akan bisa dimasuki siapa pun
// yang tahu 'admin123'. Karena itu skrip ini MENOLAK jalan tanpa flag eksplisit di bawah.
// Untuk memulihkan akun UJI saja: node scripts/pulihkan-akun-uji.mjs
// ⚠️ Terapkan password seragam 'admin123' ke SEMUA akun di scripts/akun.json
// -- akun.json sekarang berisi 40+ KARYAWAN SUNGGUHAN, bukan "7 akun uji"
// seperti header ini sebelumnya menyebut (istilah dari 30 Agustus 2026, saat
// rosternya masih 7 akun uji coba-coba -- DIPERBAIKI 7 September 2026 karena
// komentar salah lebih berbahaya daripada tidak ada komentar: orang
// berikutnya bisa percaya ini scoped ke segelintir akun lalu menjalankannya
// tanpa pikir panjang, padahal menyamakan password SEMUA karyawan sekaligus
// ke satu nilai yang diketahui bersama).
// profile.harus_ganti_password sudah otomatis true untuk setiap akun lewat
// DEFAULT kolom (migrasi 0034_paksa_ganti_password.sql, diverifikasi
// terpisah) -- skrip ini CUMA menyamakan passwordnya, bukan mengubah flag
// (sudah benar dari migrasi).
//
// Password SEBELUM ini (dari scripts/set-password.mjs, unik per akun) tidak
// berlaku lagi setelah ini dijalankan.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FLAG_BAHAYA = '--saya-paham-ini-mereset-password-SEMUA-karyawan-sungguhan';
if (!process.argv.includes(FLAG_BAHAYA)) {
  console.error(`DITOLAK. Skrip ini mereset password SEMUA akun di akun.json (karyawan sungguhan) ke 'admin123'.
Untuk memulihkan akun UJI saja jalankan: node scripts/pulihkan-akun-uji.mjs
Kalau memang itu yang dimaksud, tambahkan flag: ${FLAG_BAHAYA}`);
  process.exit(1);
}
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

const daftarAkun = JSON.parse(readFileSync(path.join(__dirname, 'akun.json'), 'utf8'));
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const db = new Client({ connectionString: dbUrl });
await db.connect();

console.log(`Menyamakan password ${daftarAkun.length} akun di akun.json ke "admin123" (KARYAWAN SUNGGUHAN)...\n`);

let berhasil = 0;
for (const akun of daftarAkun) {
  const { rows } = await db.query('select id from auth.users where email = $1', [akun.email]);
  if (rows.length === 0) {
    console.log(`${akun.email.padEnd(30)}  TIDAK DITEMUKAN -- dilewati`);
    continue;
  }
  const { error } = await supabaseAdmin.auth.admin.updateUserById(rows[0].id, { password: 'admin123' });
  if (error) {
    console.log(`${akun.email.padEnd(30)}  GAGAL: ${error.message}`);
    continue;
  }
  const { rows: cek } = await db.query('select harus_ganti_password from public.profile where id = $1', [rows[0].id]);
  console.log(`${akun.email.padEnd(30)}  OK -- harus_ganti_password=${cek[0]?.harus_ganti_password}`);
  berhasil++;
}

console.log(`\nSelesai -- ${berhasil}/${daftarAkun.length} akun.`);
await db.end();
