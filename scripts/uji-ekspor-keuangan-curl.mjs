#!/usr/bin/env node
// Uji HTTP SUNGGUHAN (bukan penyamaran RLS di Postgres) -- AKUN UJI - HRD
// Kadiv (uji4@koperumnas.local, role kadiv + divisi HRD -- BUKAN
// ceo/accounting) memanggil endpoint ekspor keuangan langsung lewat HTTP,
// harus ditolak 403 OLEH KODE ROUTE HANDLER-nya sendiri (bukan cuma
// tombolnya disembunyikan di layar). Instruksi eksplisit user, bukan
// dilonggarkan ke penyamaran RLS seperti skrip lain sesi ini -- kasus ini
// butuh sesi cookie sungguhan.
//
// Diganti dari Sabrina sungguhan ke uji4 (7 September 2026, insiden
// Qasim/Ryan -- skrip uji tidak boleh menyentuh akun orang sungguhan, lihat
// docs/04-CATATAN-TEKNIS.md §7). Versi Sabrina SEBELUMNYA tidak pernah
// mengembalikan passwordnya sama sekali -- tidak ada blok finally, cuma
// komentar "password lama tidak berlaku lagi" -- pelanggaran ganda (akun
// sungguhan + tidak ada pemulihan) yang baru ketahuan lewat sisir skrip ini.
//
// Kenapa ini baru bisa dikerjakan sekarang (skrip serupa di Task 23/reset-
// password selalu ditunda ke CHECKPOINT 4, "butuh replikasi cookie
// @supabase/ssr yang rumit lewat curl mentah"): daripada MENEBAK format
// cookie @supabase/ssr sendiri (berisiko salah diam-diam), skrip ini
// memakai LIBRARY-NYA SENDIRI (createServerClient dengan cookie jar in-
// memory) untuk login sungguhan lalu MENANGKAP persis Set-Cookie yang
// ditulisnya -- bukan hasil reka-reka format.
//
// Password AKUN UJI di-reset di sini lalu DIKEMBALIKAN ke admin123 +
// harus_ganti_password=true di blok finally, DIBUKTIKAN lewat baca ulang
// dari DB -- bukan dipercaya dari nilai kembalian.

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

const { rows } = await db.query("select id from auth.users where email = 'uji4@koperumnas.local'");
if (rows.length === 0) {
  console.error('Akun uji4@koperumnas.local tidak ditemukan -- jalankan scripts/buat-akun-uji.mjs dulu.');
  process.exit(1);
}
const idPenguji = rows[0].id;

const admin = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
let hasil = [];
let semuaLolos = false;

try {
  // 1) Reset password AKUN UJI SAJA, matikan harus_ganti_password sementara
  //    supaya middleware tidak mengalihkan panggilan API ini ke
  //    /ganti-password (kolom defaultnya true).
  const passwordBaru = crypto.randomBytes(12).toString('base64url').slice(0, 16);
  const { error: errReset } = await admin.auth.admin.updateUserById(idPenguji, { password: passwordBaru });
  if (errReset) throw new Error(`Gagal reset password AKUN UJI: ${errReset.message}`);
  await db.query('update public.profile set harus_ganti_password = false where id = $1;', [idPenguji]);
  console.log('Password AKUN UJI direset sementara utk uji ini.');

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

  const { error: errLogin } = await supabase.auth.signInWithPassword({ email: 'uji4@koperumnas.local', password: passwordBaru });
  if (errLogin) throw new Error(`Login AKUN UJI gagal: ${errLogin.message}`);
  const cookieHeader = Array.from(jar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
  console.log(`OK -- login AKUN UJI sungguhan berhasil, ${jar.size} cookie sesi ditangkap.`);

  // 3) Panggil endpoint keuangan SEBAGAI AKUN UJI lewat HTTP sungguhan.
  async function panggil(nama, path) {
    const res = await fetch(`${BASE_URL}${path}`, { headers: { Cookie: cookieHeader }, redirect: 'manual' });
    return { nama, status: res.status, contentType: res.headers.get('content-type') };
  }

  const keuangan = await panggil('Ekspor KEUANGAN (harus DITOLAK)', '/api/ekspor/keuangan?bulan=2026-08');
  hasil.push({ ...keuangan, harapan: '403', lolos: keuangan.status === 403 });

  // Kontrol positif -- AKUN UJI (kadiv+HRD) SEHARUSNYA BISA ekspor absensi,
  // membuktikan sesi/cookie-nya sungguh valid (bukan kebetulan selalu ditolak
  // krn cookie salah format sama sekali).
  const absensi = await panggil('Kontrol -- Ekspor absensi (harus BOLEH, kadiv+HRD)', '/api/ekspor/absensi?bulan=2026-08');
  hasil.push({ ...absensi, harapan: '200', lolos: absensi.status === 200 && absensi.contentType?.includes('spreadsheetml') });

  console.table(hasil.map((h) => ({ skenario: h.nama, harapan: h.harapan, 'status nyata': h.status, 'content-type': h.contentType, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
  semuaLolos = hasil.every((h) => h.lolos);
  console.log(semuaLolos ? '\n✅ SEMUA LOLOS -- endpoint keuangan menolak AKUN UJI sungguhan lewat HTTP, endpoint lain tetap bisa (bukan salah cookie).' : '\n🛑 ADA YANG GAGAL');
} finally {
  // Kembalikan AKUN UJI ke keadaan semula -- password admin123 seragam +
  // harus_ganti_password=true, DIBUKTIKAN lewat baca ulang DB (versi
  // sebelumnya TIDAK PERNAH memulihkan Sabrina sama sekali -- ditemukan
  // lewat sisir skrip 7 September 2026, lihat docs/04-CATATAN-TEKNIS.md §7).
  const { error: errPw } = await admin.auth.admin.updateUserById(idPenguji, { password: 'admin123' });
  if (errPw) console.error(`🛑 GAGAL mengembalikan password AKUN UJI ke admin123: ${errPw.message}`);
  await db.query('update public.profile set harus_ganti_password = true where id = $1;', [idPenguji]);
  const { rows: cekAkun } = await db.query(
    `select p.harus_ganti_password, u.updated_at, u.last_sign_in_at from public.profile p join auth.users u on u.id = p.id where p.id = $1`,
    [idPenguji],
  );
  const pulihSempurna = cekAkun[0]?.harus_ganti_password === true && new Date(cekAkun[0].updated_at) > new Date(cekAkun[0].last_sign_in_at);
  console.log(pulihSempurna
    ? 'AKUN UJI dikembalikan: password admin123 (dibuktikan lewat updated_at > last_sign_in_at), harus_ganti_password = true.'
    : `🛑 AKUN UJI BELUM PULIH SEPENUHNYA -- ${JSON.stringify(cekAkun[0])}.`);
  await db.end();
}

process.exit(semuaLolos ? 0 : 1);
