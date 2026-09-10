#!/usr/bin/env node
// Uji SUNGGUHAN (login HTTP nyata, BUKAN penyamaran JWT) untuk perbaikan
// celah eskalasi privilese role (migrasi 0050, 6 September 2026). Pola
// login sama persis dengan uji-ekspor-keuangan-curl.mjs: createServerClient
// dengan cookie jar in-memory, password direset sementara.
//
// AKUN UJI - Admin (uji6@koperumnas.local, role admin) mencoba:
//   1. Memberi DIRINYA SENDIRI role 'ceo'        -> HARUS DITOLAK
//   2. Memberi DIRINYA SENDIRI role 'accounting' -> HARUS DITOLAK
//   3. Memberi AKUN UJI - Tanpa Peran (uji5) role 'admin' -> HARUS DITOLAK
//   4. KONTROL POSITIF: memberi uji5 role 'karyawan' (baseline-nya SENGAJA
//      kosong -- lihat scripts/buat-akun-uji.mjs -- jadi insert-nya bersih
//      tanpa perlu dicabut dulu) -> HARUS BERHASIL
//
// Kontrol positif WAJIB ada -- tanpa itu, "semua ditolak" bisa berarti
// policy benar ATAU policy rusak total (mis. salah nama kolom bikin RLS
// selalu gagal). Kalau kontrol positif ikut gagal, seluruh hasil di atas
// tidak bisa dipercaya.
//
// Diganti dari Diki + Anne sungguhan ke uji6 + uji5 (7 September 2026,
// insiden Qasim/Ryan -- skrip uji tidak boleh menyentuh akun orang
// sungguhan, lihat docs/04-CATATAN-TEKNIS.md §7). uji6 dibuat KHUSUS untuk
// skrip ini -- satu-satunya kebutuhan role 'admin' yang ditemukan sisir
// scripts/, di luar lima akun yang diminta semula (dilaporkan terpisah).
// Versi Diki SEBELUMNYA juga tidak memeriksa {error} saat memulihkan
// password di blok finally -- diperbaiki di sini sekalian (baca ulang DB,
// bukan dipercaya dari nilai kembalian).

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

const db = new PgClient({ connectionString: dbUrl });
await db.connect();

const { rows: adminRows } = await db.query("select id from auth.users where email = 'uji6@koperumnas.local'");
if (adminRows.length === 0) throw new Error('Akun uji6@koperumnas.local tidak ditemukan -- jalankan scripts/buat-akun-uji.mjs dulu.');
const idAkunAdmin = adminRows[0].id;

const { rows: targetRows } = await db.query("select id from auth.users where email = 'uji5@koperumnas.local'");
if (targetRows.length === 0) throw new Error('Akun uji5@koperumnas.local tidak ditemukan -- jalankan scripts/buat-akun-uji.mjs dulu.');
const idAkunTarget = targetRows[0].id;

const admin = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const passwordSementara = crypto.randomBytes(12).toString('base64url').slice(0, 16);

const hasil = [];

try {
  const { error: errReset } = await admin.auth.admin.updateUserById(idAkunAdmin, { password: passwordSementara });
  if (errReset) throw new Error(`Gagal reset password AKUN UJI - Admin: ${errReset.message}`);
  // profile.harus_ganti_password default TRUE (kolom, BUKAN trigger -- tidak
  // ada trigger apa pun di auth.users, dicek langsung 7 September 2026) --
  // dimatikan sementara supaya middleware tidak mengalihkan panggilan ini
  // ke /ganti-password, dikembalikan di finally dan DIBUKTIKAN baca ulang DB.
  await db.query('update public.profile set harus_ganti_password = false where id = $1;', [idAkunAdmin]);

  const jar = new Map();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => Array.from(jar.entries()).map(([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => { for (const { name, value } of cookiesToSet) jar.set(name, value); },
    },
  });
  const { error: errLogin } = await supabase.auth.signInWithPassword({ email: 'uji6@koperumnas.local', password: passwordSementara });
  if (errLogin) throw new Error(`Login AKUN UJI - Admin gagal: ${errLogin.message}`);
  console.log('OK -- login AKUN UJI - Admin sungguhan berhasil.\n');

  async function coba(label, userId, role, harapan) {
    const { error } = await supabase.from('role').insert({ user_id: userId, role });
    const lolos = harapan === 'ditolak' ? Boolean(error) : !error;
    hasil.push({ label, harapan, hasilNyata: error ? `DITOLAK (${error.code ?? error.message})` : 'BERHASIL', lolos });
    // Bersihkan SEGERA kalau ternyata berhasil (baik yang diharapkan
    // berhasil maupun yang seharusnya ditolak tapi ternyata lolos) --
    // jangan menumpuk baris role hasil uji di database.
    if (!error) await db.query('delete from public.role where user_id = $1 and role = $2', [userId, role]);
  }

  await coba('AKUN UJI - Admin beri DIRINYA SENDIRI role ceo', idAkunAdmin, 'ceo', 'ditolak');
  await coba('AKUN UJI - Admin beri DIRINYA SENDIRI role accounting', idAkunAdmin, 'accounting', 'ditolak');
  await coba('AKUN UJI - Admin beri AKUN UJI - Tanpa Peran role admin', idAkunTarget, 'admin', 'ditolak');
  await coba('KONTROL POSITIF -- AKUN UJI - Admin beri AKUN UJI - Tanpa Peran role karyawan', idAkunTarget, 'karyawan', 'berhasil');

  console.table(hasil.map((h) => ({ Uji: h.label, Harapan: h.harapan, 'Hasil nyata': h.hasilNyata, 'Lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
  const semuaLolos = hasil.every((h) => h.lolos);
  console.log(semuaLolos ? '\n✅ SEMUA LOLOS -- daftar putih menahan role terkunci, kontrol positif membuktikan policy tidak cuma menolak semuanya.' : '\n🛑 ADA YANG GAGAL -- lihat tabel di atas.');
  process.exitCode = semuaLolos ? 0 : 1;
} finally {
  // Pastikan AKUN UJI - Tanpa Peran kembali PERSIS ke baseline-nya (TIDAK
  // ADA role sama sekali -- itu identitasnya, beda dari Anne dulu yang
  // baseline-nya 'karyawan'), apa pun hasil uji di atas.
  await db.query('delete from public.role where user_id = $1', [idAkunTarget]);

  const { error: errPw } = await admin.auth.admin.updateUserById(idAkunAdmin, { password: 'admin123' });
  if (errPw) console.error(`🛑 GAGAL mengembalikan password AKUN UJI - Admin ke admin123: ${errPw.message}`);
  await db.query('update public.profile set harus_ganti_password = true where id = $1;', [idAkunAdmin]);
  const { rows: cekAkun } = await db.query(
    `select p.harus_ganti_password, u.updated_at, u.last_sign_in_at from public.profile p join auth.users u on u.id = p.id where p.id = $1`,
    [idAkunAdmin],
  );
  const pulihSempurna = cekAkun[0]?.harus_ganti_password === true && new Date(cekAkun[0].updated_at) > new Date(cekAkun[0].last_sign_in_at);
  console.log(pulihSempurna
    ? '\nDibersihkan: AKUN UJI - Tanpa Peran kembali tanpa role, AKUN UJI - Admin dikembalikan (dibuktikan lewat updated_at > last_sign_in_at).'
    : `\n🛑 AKUN UJI - Admin BELUM PULIH SEPENUHNYA -- ${JSON.stringify(cekAkun[0])}.`);
  await db.end();
}
