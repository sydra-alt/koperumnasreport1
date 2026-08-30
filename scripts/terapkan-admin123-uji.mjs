#!/usr/bin/env node
// Terapkan password seragam 'admin123' ke 7 akun uji (instruksi eksplisit
// user, item 6, 30 Agustus 2026) -- SAMA seperti 39 akun asli nanti.
// profile.harus_ganti_password sudah otomatis true untuk ketujuhnya lewat
// DEFAULT kolom (migrasi 0034_paksa_ganti_password.sql, diverifikasi
// terpisah) -- skrip ini CUMA menyamakan passwordnya, bukan mengubah flag
// (sudah benar dari migrasi).
//
// Password SEBELUM ini (dari scripts/set-password.mjs, unik per akun) tidak
// berlaku lagi untuk ketujuhnya setelah ini dijalankan.

import { readFileSync } from 'node:fs';
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

const daftarAkun = JSON.parse(readFileSync(path.join(__dirname, 'akun.json'), 'utf8'));
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const db = new Client({ connectionString: dbUrl });
await db.connect();

console.log('Menyamakan password 7 akun uji ke "admin123" (harus_ganti_password sudah true lewat DEFAULT kolom)...\n');

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
