#!/usr/bin/env node
// ⚠️ MENULIS SUNGGUHAN ke database yang juga PRODUKSI: reset password + profile.harus_ganti_password HANYA untuk
// akun uji (uji<angka>@ / uji-*@koperumnas.local). Jangan dijalankan sembarangan: akun uji yang sengaja diset
// harus_ganti_password=false (mis. uji-ceo untuk login uji manual) akan dikembalikan ke baseline.
// PEMULIH akun uji -- jalankan kalau skrip uji "live" mati paksa di tengah jalan
// (kill -9, listrik mati) dan meninggalkan akun uji dengan password sementara.
//
// ⚠️ SCOPE SENGAJA SEMPIT: HANYA akun dengan email uji<angka>@koperumnas.local
// dan uji-*@koperumnas.local (akun buatan scripts/buat-akun-uji.mjs). TIDAK
// menyentuh satu pun akun karyawan sungguhan. Jangan melebarkan pola ini --
// scripts/terapkan-admin123-uji.mjs (namanya menyesatkan) mereset SEMUA akun di
// akun.json dan BUKAN alat pemulih.
//
// Yang dikembalikan per akun uji: password 'admin123' + profile.harus_ganti_password
// = true (baseline dari scripts/buat-akun-uji.mjs). Juga MELAPORKAN (tidak mengubah)
// policy.absen_di_luar_radius, sebagai pemeriksaan bahwa tidak ada uji yang
// meninggalkan kebijakan produksi berubah.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  const { rows: akun } = await db.query(
    `select id, email from auth.users where email ~ '^uji([0-9]+|-[a-z]+)@koperumnas\\.local$' order by email`,
  );
  if (akun.length === 0) throw new Error('Tidak ada akun uji ditemukan -- jalankan scripts/buat-akun-uji.mjs.');
  let gagal = 0;
  for (const a of akun) {
    const { error } = await admin.auth.admin.updateUserById(a.id, { password: 'admin123' });
    if (error) {
      console.log(`${a.email.padEnd(28)} GAGAL: ${error.message}`);
      gagal++;
      continue;
    }
    await db.query('update public.profile set harus_ganti_password = true where id = $1', [a.id]);
    const { rows } = await db.query('select harus_ganti_password from public.profile where id = $1', [a.id]);
    const ok = rows[0]?.harus_ganti_password === true;
    if (!ok) gagal++;
    console.log(`${a.email.padEnd(28)} ${ok ? 'OK -- admin123, harus_ganti_password=true' : 'BELUM PULIH'}`);
  }
  const { rows: pol } = await db.query(`select value from public.policy where key = 'absen_di_luar_radius'`);
  console.log(`\npolicy.absen_di_luar_radius = ${JSON.stringify(pol[0]?.value)} (nilai produksi normal: "izinkan_dengan_tanda")`);
  console.log(gagal === 0 ? `\n${akun.length} akun uji dipulihkan.` : `\n🛑 ${gagal} akun belum pulih.`);
  process.exitCode = gagal === 0 ? 0 : 1;
} finally {
  await db.end();
}
