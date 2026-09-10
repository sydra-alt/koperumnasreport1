#!/usr/bin/env node
// Pemeriksaan MENYELURUH (10 September 2026, insiden "sebagian akun tidak
// bisa login lagi setelah ganti password") -- untuk SETIAP akun di
// auth.users, coba login SUNGGUHAN (bukan penyamaran) dengan password
// 'admin123', SEGERA logout kalau berhasil. TIDAK PERNAH mengubah password
// ATAU harus_ganti_password siapa pun -- murni baca (SELECT profil) + satu
// percobaan sign-in + sign-out per akun.
//
// Baca hasilnya:
//   BISA  + harus_ganti_password=true  -> belum pernah dipakai, NORMAL.
//   BISA  + harus_ganti_password=false -> JANGGAL. Flag bilang "sudah
//           ganti password", tapi admin123 (password AWAL) masih berlaku --
//           bukti password barunya TIDAK PERNAH benar-benar tersimpan
//           (atau flag-nya menyala lewat jalur lain tanpa perubahan
//           password sungguhan -- lihat catatan di laporan).
//   TIDAK BISA -> sudah punya password sendiri yang berbeda, WAJAR.
//
// Login memakai cookie jar in-memory per akun (createServerClient), TIDAK
// PERNAH persisten -- begitu dicoba, langsung signOut() (scope 'global',
// mencabut sesi di server) sebelum lanjut ke akun berikutnya. Jeda kecil
// antar percobaan supaya tidak memicu rate-limit Supabase Auth untuk email
// yang berbeda-beda dalam waktu singkat.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createServerClient } from '@supabase/ssr';
import { Client as PgClient } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!supabaseUrl || !anonKey || !dbUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_DB_URL wajib ada di .env.local');
  process.exit(1);
}

const db = new PgClient({ connectionString: dbUrl });
await db.connect();

const { rows: akun } = await db.query(`
  select p.nama, u.email, p.harus_ganti_password, u.last_sign_in_at
  from auth.users u
  join public.profile p on p.id = u.id
  order by p.nama
`);
await db.end();

function tunggu(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cobaLogin(email) {
  const jar = new Map();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => Array.from(jar.entries()).map(([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => { for (const { name, value } of cookiesToSet) jar.set(name, value); },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: 'admin123' });
  if (error) {
    return { berlaku: false, keterangan: error.message };
  }
  // Berhasil -- BUANG SEGERA. signOut() default scope 'global' mencabut
  // sesi ini di server, bukan cuma menghapus cookie lokal.
  const { error: errSignOut } = await supabase.auth.signOut();
  return { berlaku: true, keterangan: errSignOut ? `TERSAMBUNG TAPI GAGAL SIGNOUT: ${errSignOut.message}` : '' };
}

const hasil = [];
console.log(`Memeriksa ${akun.length} akun -- mencoba admin123 lewat HTTP sungguhan, langsung logout kalau berhasil...\n`);

for (const a of akun) {
  const { berlaku, keterangan } = await cobaLogin(a.email);
  const janggal = berlaku && a.harus_ganti_password === false;
  hasil.push({
    Nama: a.nama,
    Email: a.email,
    'admin123 berlaku?': berlaku ? (janggal ? 'BISA ⚠️ JANGGAL' : 'BISA') : 'TIDAK BISA',
    harus_ganti_password: a.harus_ganti_password,
    'Terakhir masuk': a.last_sign_in_at ? new Date(a.last_sign_in_at).toISOString() : '(belum pernah)',
  });
  if (keterangan && !berlaku) {
    // Bedakan "ditolak krn password salah" (normal) dari kegagalan lain
    // (rate limit, jaringan) yang HARUS terlihat, bukan disamakan begitu
    // saja dengan "sudah ganti password sendiri".
    if (!/invalid login credentials/i.test(keterangan)) {
      hasil[hasil.length - 1]['admin123 berlaku?'] = `ERROR: ${keterangan}`;
    }
  }
  await tunggu(300); // jeda kecil, hindari rate-limit Auth utk email berbeda beruntun
}

console.table(hasil);

const janggalList = hasil.filter((h) => String(h['admin123 berlaku?']).includes('JANGGAL'));
console.log(`\nTotal akun diperiksa: ${hasil.length}`);
console.log(`Akun JANGGAL (admin123 masih berlaku PADAHAL harus_ganti_password=false): ${janggalList.length}`);
if (janggalList.length > 0) {
  console.log('\n🛑 BUKTI NYATA penulisan password gagal untuk akun berikut (flag bilang "sudah ganti", tapi password awal masih hidup):');
  console.table(janggalList);
} else {
  console.log('\n✅ Tidak ada akun dengan kombinasi JANGGAL -- tidak ada bukti kegagalan penulisan password lewat cek ini.');
}
