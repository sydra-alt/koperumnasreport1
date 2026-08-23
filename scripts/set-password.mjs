#!/usr/bin/env node
// Reset password ketujuh akun uji (scripts/akun.json) ke password ACAK
// BERBEDA per orang, lewat supabase.auth.admin.updateUserById() -- SATU-
// SATUNYA jalur resmi yang didukung Supabase untuk mengubah password orang
// lain. TIDAK PERNAH `update auth.users set encrypted_password = ...`
// langsung -- itu menyentuh format internal GoTrue yang tidak dijamin
// stabil lintas versi, dan bukan API yang didukung (instruksi user,
// 24 Agustus 2026, setelah versi SQL sebelumnya ditolak).
//
// Password dicetak SEKALI ke layar. TIDAK DITULIS ke file, log, atau commit
// mana pun -- salin ke pengelola password kamu SEKARANG. Kalau terlewat,
// jalankan ulang skrip ini; password lama otomatis diganti yang baru.

import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL dan/atau SUPABASE_SERVICE_ROLE_KEY tidak ada di .env.local');
  process.exit(1);
}
if (!dbUrl) {
  console.error('SUPABASE_DB_URL tidak ada di .env.local (dibutuhkan untuk mencari id user dari email -- BACA saja, tidak pernah menulis ke auth.users langsung)');
  process.exit(1);
}

const daftarAkun = JSON.parse(readFileSync(path.join(__dirname, 'akun.json'), 'utf8'));

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const db = new Client({ connectionString: dbUrl });
await db.connect();

/** 16 karakter dari crypto.randomBytes (bukan Math.random) -- base64url supaya aman diketik/disalin, tanpa karakter yang gampang tertukar. */
function buatPasswordAcak() {
  return crypto.randomBytes(12).toString('base64url').slice(0, 16);
}

console.log('Password BARU per akun -- CATAT SEKARANG ke pengelola password kamu.');
console.log('Tidak akan ditampilkan lagi dan TIDAK disimpan ke file mana pun.\n');

const hasil = [];
for (const akun of daftarAkun) {
  const { rows } = await db.query('select id from auth.users where email = $1', [akun.email]);
  if (rows.length === 0) {
    console.log(`${akun.email.padEnd(30)}  TIDAK DITEMUKAN -- dilewati`);
    continue;
  }

  const password = buatPasswordAcak();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(rows[0].id, { password });
  if (error) {
    console.log(`${akun.email.padEnd(30)}  GAGAL: ${error.message}`);
    continue;
  }

  console.log(`${akun.email.padEnd(30)}  ${password}`);
  hasil.push(akun.email);
}

console.log(`\nSelesai -- ${hasil.length}/${daftarAkun.length} akun berhasil di-set password barunya.`);
console.log('Password SEBELUM ini (apa pun itu) sudah tidak berlaku lagi untuk akun-akun di atas.');

await db.end();
