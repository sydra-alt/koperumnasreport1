#!/usr/bin/env node
// Perkakas verifikasi database — dipakai lewat `npm run db -- <file.sql | "SELECT ...">`.
// Konek LANGSUNG sebagai pemilik tabel (SUPABASE_DB_URL), MELEWATI SELURUH RLS.
// Cuma untuk migrasi & verifikasi skema — jangan dipakai untuk uji RLS
// (uji RLS wajib lewat penyamaran `set role authenticated`, lihat skrip Checkpoint 2).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

function sensor(teks) {
  // Jaring pengaman: kalau pesan error apa pun sampai memuat DSN, sensor dulu
  // sebelum dicetak — SUPABASE_DB_URL tidak boleh pernah tampil di layar/log.
  return teks.replace(/postgres(?:ql)?:\/\/\S+/gi, '[DSN disensor]');
}

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL tidak ditemukan di .env.local');
  process.exit(1);
}

const arg = process.argv[2];
if (!arg) {
  console.error('Pakai: npm run db -- <file.sql>  atau  npm run db -- "select ..."');
  process.exit(1);
}

const sql = arg.trim().toLowerCase().endsWith('.sql') ? readFileSync(arg, 'utf8') : arg;

const client = new Client({ connectionString: dbUrl });

try {
  await client.connect();
  const hasilMentah = await client.query(sql);
  const hasil = Array.isArray(hasilMentah) ? hasilMentah[hasilMentah.length - 1] : hasilMentah;

  if (hasil.command === 'SELECT') {
    if (hasil.rows.length > 0) {
      console.table(hasil.rows);
    } else {
      console.log('(0 baris)');
    }
  } else {
    console.log(`OK — ${hasil.command ?? 'selesai'}, rowCount=${hasil.rowCount}`);
  }
} catch (err) {
  console.error('ERROR:', sensor(err.message));
  process.exitCode = 1;
} finally {
  await client.end();
}
