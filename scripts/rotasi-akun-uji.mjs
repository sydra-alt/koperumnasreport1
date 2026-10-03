#!/usr/bin/env node
// ⚠️ ALAT: menulis ke database PRODUKSI -- mengganti password SEMUA akun uji (akun_uji = true).
// Rotasi password akun uji (3 Oktober 2026) -- HANYA akun dengan
// profile.akun_uji = true (uji-ceo, uji1..uji6). Akun karyawan sungguhan
// TIDAK PERNAH disentuh (keputusan CEO: password awal tetap selama
// pengembangan, lihat CLAUDE.md "Go-live checklist").
//
// Per akun: password acak baru (24 karakter, crypto), ditulis ke berkas lokal
// di LUAR repo (scripts/_kredensial-uji.mjs), lalu dibuktikan dengan login
// sungguhan dan SEMUA sesinya dicabut (signOut scope global). Password tidak
// pernah dicetak.
//
// Jalankan: node scripts/rotasi-akun-uji.mjs --jalankan
import path from 'node:path';
import crypto from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { BERKAS_KREDENSIAL_UJI } from './_kredensial-uji.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
if (!process.argv.includes('--jalankan')) {
  console.error('Tambahkan --jalankan untuk merotasi password SEMUA akun uji (akun_uji = true).');
  process.exit(1);
}
const repoRoot = path.resolve(__dirname, '..');
if (path.resolve(BERKAS_KREDENSIAL_UJI).startsWith(repoRoot)) {
  console.error('Berkas kredensial harus DI LUAR repo.');
  process.exit(1);
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();
const { rows } = await db.query(`select u.id, u.email from auth.users u join public.profile p on p.id = u.id where p.akun_uji order by u.email`);
await db.end();

const kredensial = existsSync(BERKAS_KREDENSIAL_UJI) ? JSON.parse(readFileSync(BERKAS_KREDENSIAL_UJI, 'utf8')) : {};
let gagal = 0;
for (const a of rows) {
  const pw = crypto.randomBytes(18).toString('base64url'); // 24 karakter
  const { error } = await admin.auth.admin.updateUserById(a.id, { password: pw });
  if (error) {
    gagal++;
    console.error(`${a.email}: GAGAL set password (${error.message})`);
    continue;
  }
  kredensial[a.email] = pw;
  // Tulis segera (tidak kehilangan password kalau langkah berikut gagal).
  mkdirSync(path.dirname(BERKAS_KREDENSIAL_UJI), { recursive: true });
  writeFileSync(BERKAS_KREDENSIAL_UJI, JSON.stringify(kredensial, null, 2), { mode: 0o600 });
  // Bukti login + cabut SEMUA sesi (termasuk yang lama).
  const klien = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: errLogin } = await klien.auth.signInWithPassword({ email: a.email, password: pw });
  const { error: errOut } = errLogin ? { error: null } : await klien.auth.signOut({ scope: 'global' });
  const ok = !errLogin && !errOut;
  if (!ok) gagal++;
  console.log(`${a.email.padEnd(28)} ${ok ? 'password baru, login terbukti, semua sesi dicabut' : `MASALAH: ${errLogin?.message ?? errOut?.message}`}`);
}
console.log(`\n${rows.length} akun uji; berkas kredensial: ${BERKAS_KREDENSIAL_UJI}`);
process.exit(gagal > 0 ? 1 : 0);
