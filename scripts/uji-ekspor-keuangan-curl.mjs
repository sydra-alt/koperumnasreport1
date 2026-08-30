#!/usr/bin/env node
// Uji HTTP SUNGGUHAN (bukan penyamaran RLS di Postgres) -- Sabrina (pusat,
// BUKAN ceo/accounting) memanggil endpoint ekspor keuangan langsung lewat
// HTTP, harus ditolak 403 OLEH KODE ROUTE HANDLER-nya sendiri (bukan cuma
// tombolnya disembunyikan di layar). Instruksi eksplisit user, bukan
// dilonggarkan ke penyamaran RLS seperti skrip lain sesi ini -- kasus ini
// butuh sesi cookie sungguhan.
//
// Kenapa ini baru bisa dikerjakan sekarang (skrip serupa di Task 23/reset-
// password selalu ditunda ke CHECKPOINT 4, "butuh replikasi cookie
// @supabase/ssr yang rumit lewat curl mentah"): daripada MENEBAK format
// cookie @supabase/ssr sendiri (berisiko salah diam-diam), skrip ini
// memakai LIBRARY-NYA SENDIRI (createServerClient dengan cookie jar in-
// memory) untuk login sungguhan lalu MENANGKAP persis Set-Cookie yang
// ditulisnya -- bukan hasil reka-reka format.
//
// Password Sabrina di-reset SEKALI di sini (scoped ke SATU akun, bukan
// ketujuh-tujuhnya seperti scripts/set-password.mjs) supaya skrip ini
// bisa login -- password lama Sabrina (kalau ada yang sedang dipakai)
// otomatis tidak berlaku setelah ini, sama seperti efek set-password.mjs
// biasa.

import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { Client as PgClient } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;
const BASE_URL = process.env.UJI_BASE_URL ?? 'http://localhost:3000';

if (!supabaseUrl || !anonKey || !serviceRoleKey || !dbUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL wajib ada di .env.local');
  process.exit(1);
}

const db = new PgClient({ connectionString: dbUrl });
await db.connect();

const { rows } = await db.query("select id from auth.users where email = 'sabrina@koperumnas.local'");
if (rows.length === 0) {
  console.error('Akun sabrina@koperumnas.local tidak ditemukan.');
  process.exit(1);
}
const idSabrina = rows[0].id;
await db.end();

// 1) Reset password Sabrina SAJA (bukan 7 akun) -- pola sama set-password.mjs.
const admin = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const passwordBaru = crypto.randomBytes(12).toString('base64url').slice(0, 16);
const { error: errReset } = await admin.auth.admin.updateUserById(idSabrina, { password: passwordBaru });
if (errReset) {
  console.error('Gagal reset password Sabrina:', errReset.message);
  process.exit(1);
}
console.log('Password Sabrina direset sementara utk uji ini (tidak dicetak -- tidak perlu diingat siapa pun, cuma dipakai sekali di sini).');

// 2) Login sungguhan lewat createServerClient dgn cookie jar in-memory --
//    tangkap PERSIS Set-Cookie yang ditulis library, jangan ditebak sendiri.
const jar = new Map();
const supabase = createServerClient(supabaseUrl, anonKey, {
  cookies: {
    getAll: () => Array.from(jar.entries()).map(([name, value]) => ({ name, value })),
    setAll: (cookiesToSet) => {
      for (const { name, value } of cookiesToSet) jar.set(name, value);
    },
  },
});

const { error: errLogin } = await supabase.auth.signInWithPassword({ email: 'sabrina@koperumnas.local', password: passwordBaru });
if (errLogin) {
  console.error('Login Sabrina gagal:', errLogin.message);
  process.exit(1);
}
const cookieHeader = Array.from(jar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
console.log(`OK -- login Sabrina sungguhan berhasil, ${jar.size} cookie sesi ditangkap.`);

// 3) Panggil endpoint keuangan SEBAGAI SABRINA lewat HTTP sungguhan.
const hasil = [];
async function panggil(nama, path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Cookie: cookieHeader }, redirect: 'manual' });
  return { nama, status: res.status, contentType: res.headers.get('content-type') };
}

const keuangan = await panggil('Ekspor KEUANGAN (harus DITOLAK)', '/api/ekspor/keuangan?bulan=2026-08');
hasil.push({ ...keuangan, harapan: '403', lolos: keuangan.status === 403 });

// Kontrol positif -- Sabrina (pusat) SEHARUSNYA BISA ekspor absensi & marketing,
// membuktikan sesi/cookie-nya sungguh valid (bukan kebetulan selalu ditolak
// krn cookie salah format sama sekali).
const absensi = await panggil('Kontrol -- Ekspor absensi (harus BOLEH, pusat)', '/api/ekspor/absensi?bulan=2026-08');
hasil.push({ ...absensi, harapan: '200', lolos: absensi.status === 200 && absensi.contentType?.includes('spreadsheetml') });

console.table(hasil.map((h) => ({ skenario: h.nama, harapan: h.harapan, 'status nyata': h.status, 'content-type': h.contentType, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS -- endpoint keuangan menolak Sabrina sungguhan lewat HTTP, endpoint lain tetap bisa (bukan salah cookie).' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
