#!/usr/bin/env node
// Cikal bakal Task 23 (halaman admin, "buat user baru lewat Edge Function/Route
// Handler karena butuh service_role"). Skrip ini adalah versi CLI-nya dulu —
// app/api/admin/user/route.ts nanti akan memakai logika createUser + isi
// profile/role yang sama, dipanggil dari UI alih-alih dari daftar akun.json.
//
// Baca daftar akun dari scripts/akun.json (dipakai ulang untuk 36 karyawan
// nanti, bukan cuma 7 akun uji), idempoten — email yang sudah ada dilewati.
//
// SUPABASE_SERVICE_ROLE_KEY dibaca dari .env.local dan TIDAK PERNAH ditulis
// ke file lain / log / commit. Kunci ini melewati seluruh RLS.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Password sementara SERAGAM 'admin123' (instruksi eksplisit user, 30
// Agustus 2026) -- AMAN hanya karena `profile.harus_ganti_password` (default
// true, migrasi 0034_paksa_ganti_password.sql) memaksa setiap akun ganti
// password lewat /ganti-password sebelum bisa membuka halaman apa pun
// (proxy.ts). Jangan pernah mengubah password seragam ini tanpa memastikan
// paksaan gantinya masih aktif -- lihat docs/PROGRESS.md.
const PASSWORD_SEMENTARA = 'admin123';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL dan/atau SUPABASE_SERVICE_ROLE_KEY tidak ada di .env.local');
  process.exit(1);
}
if (!dbUrl) {
  console.error('SUPABASE_DB_URL tidak ada di .env.local (dibutuhkan untuk isi profile/role)');
  process.exit(1);
}

const daftarPath = path.join(__dirname, 'akun.json');
const daftarAkun = JSON.parse(readFileSync(daftarPath, 'utf8'));

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const db = new Client({ connectionString: dbUrl });
await db.connect();

console.log(`Password sementara untuk semua akun BARU: ${PASSWORD_SEMENTARA} (sengaja seragam, lihat PROGRESS.md)`);
console.log('');

// ── 1. Cek email mana yang sudah ada, biar idempoten ──────────────────────
const emailList = daftarAkun.map((a) => a.email);
const { rows: sudahAda } = await db.query(
  'select email from auth.users where email = any($1)',
  [emailList],
);
const emailSudahAda = new Set(sudahAda.map((r) => r.email));

// ── 2. Buat akun yang belum ada ────────────────────────────────────────────
for (const akun of daftarAkun) {
  if (emailSudahAda.has(akun.email)) {
    console.log(`${akun.email} — sudah ada, dilewati`);
    continue;
  }
  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: akun.email,
    password: PASSWORD_SEMENTARA,
    email_confirm: true,
  });
  if (error) {
    console.error(`${akun.email} — GAGAL dibuat: ${error.message}`);
    continue;
  }
  console.log(`${akun.email} — dibuat`);
}

// ── 3. Isi profile + role untuk SEMUA akun di daftar (baru maupun lama) ──
console.log('');
console.log('Mengisi profile + role...');
for (const akun of daftarAkun) {
  await db.query(
    `insert into public.profile (id, nama, jabatan, divisi)
     select id, $2, $3, $4 from auth.users where email = $1
     on conflict (id) do update
       set nama = excluded.nama, jabatan = excluded.jabatan, divisi = excluded.divisi`,
    [akun.email, akun.nama, akun.jabatan, akun.divisi],
  );
  for (const role of akun.roles) {
    await db.query(
      `insert into public.role (user_id, role)
       select id, $2 from auth.users where email = $1
       on conflict do nothing`,
      [akun.email, role],
    );
  }
}

// ── 4. CEK ──────────────────────────────────────────────────────────────
console.log('');
console.log('CEK -- nama, divisi, peran:');
const { rows: cek } = await db.query(`
  select p.nama, p.divisi, array_agg(r.role order by r.role) as peran
  from public.profile p
  left join public.role r on r.user_id = p.id
  group by p.nama, p.divisi
  order by p.nama;
`);
console.table(cek);

await db.end();
