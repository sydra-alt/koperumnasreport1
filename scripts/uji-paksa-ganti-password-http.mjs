#!/usr/bin/env node
// Uji HTTP SUNGGUHAN (bukan penyamaran JWT), instruksi eksplisit user, 30
// Agustus 2026: login sebagai akun dengan harus_ganti_password=true lewat
// sesi cookie sungguhan (pola sama uji-ekspor-keuangan-curl.mjs --
// createServerClient + cookie jar in-memory, BUKAN menebak format cookie),
// coba buka /papan dan /terpusat langsung -- keduanya harus dialihkan ke
// /ganti-password oleh proxy.ts. Lalu benar-benar ganti password lewat
// /api/ganti-password, dan buktikan pengalihan BERHENTI setelahnya.
//
// AKUN UJI - Karyawan Resto (uji2@koperumnas.local) dipakai -- BUKAN Toyib
// sungguhan lagi (diganti 7 September 2026, insiden Qasim/Ryan: skrip uji
// tidak boleh menyentuh akun orang sungguhan, lihat
// docs/04-CATATAN-TEKNIS.md §7). Versi Toyib SEBELUMNYA mengganti password
// akun sungguhan lewat /api/ganti-password lalu TIDAK PERNAH memulihkannya
// otomatis -- cuma komentar "jalankan terapkan-admin123-uji.mjs lagi kalau
// perlu", yang gampang terlewat. Sekarang dipulihkan OTOMATIS di blok
// finally, DIBUKTIKAN lewat baca ulang DB.

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

const EMAIL = 'uji2@koperumnas.local';
const db = new PgClient({ connectionString: dbUrl });
await db.connect();
const { rows: akunRows } = await db.query('select id from auth.users where email = $1', [EMAIL]);
if (akunRows.length === 0) {
  console.error(`${EMAIL} tidak ditemukan -- jalankan scripts/buat-akun-uji.mjs dulu.`);
  process.exit(1);
}
const idAkun = akunRows[0].id;
const admin = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const hasil = [];
function catat(nomor, skenario, harapan, mentah, lolos) {
  hasil.push({ nomor, skenario, harapan, mentah, lolos });
}
let semuaLolos = false;

try {
  // 0) Pastikan AKUN UJI mulai dari admin123 + harus_ganti_password=true --
  //    keadaan yang diminta skenario ini -- TERLEPAS dari sisa run
  //    sebelumnya (idempoten, bukan berasumsi).
  const { error: errSiap } = await admin.auth.admin.updateUserById(idAkun, { password: 'admin123' });
  if (errSiap) throw new Error(`Gagal menyiapkan password awal AKUN UJI: ${errSiap.message}`);
  await db.query('update public.profile set harus_ganti_password = true where id = $1;', [idAkun]);

  // 1) Login SUNGGUHAN sebagai AKUN UJI (admin123, harus_ganti_password=true).
  const jar = new Map();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => Array.from(jar.entries()).map(([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) jar.set(name, value);
      },
    },
  });

  const { error: errLogin } = await supabase.auth.signInWithPassword({ email: EMAIL, password: 'admin123' });
  if (errLogin) throw new Error(`Login AKUN UJI gagal: ${errLogin.message}`);
  function cookieHeader() {
    return Array.from(jar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
  }
  console.log(`OK -- login AKUN UJI sungguhan (admin123) berhasil, ${jar.size} cookie sesi ditangkap.\n`);

  async function ambil(path) {
    return fetch(`${BASE_URL}${path}`, { headers: { Cookie: cookieHeader() }, redirect: 'manual' });
  }

  // 2) SEBELUM ganti password -- /papan dan /terpusat harus dialihkan ke /ganti-password.
  const rPapanSebelum = await ambil('/papan');
  const lokasiPapanSebelum = rPapanSebelum.headers.get('location') ?? '';
  catat(
    1,
    'GET /papan (SEBELUM ganti password)',
    'redirect (3xx) ke /ganti-password',
    `status=${rPapanSebelum.status}; location=${lokasiPapanSebelum}`,
    rPapanSebelum.status >= 300 && rPapanSebelum.status < 400 && lokasiPapanSebelum.includes('/ganti-password'),
  );

  const rTerpusatSebelum = await ambil('/terpusat');
  const lokasiTerpusatSebelum = rTerpusatSebelum.headers.get('location') ?? '';
  catat(
    2,
    'GET /terpusat (SEBELUM ganti password)',
    'redirect (3xx) ke /ganti-password',
    `status=${rTerpusatSebelum.status}; location=${lokasiTerpusatSebelum}`,
    rTerpusatSebelum.status >= 300 && rTerpusatSebelum.status < 400 && lokasiTerpusatSebelum.includes('/ganti-password'),
  );

  // 3) /ganti-password sendiri TIDAK boleh ikut dialihkan (kalau iya, redirect loop, halaman tidak pernah kebuka).
  const rHalamanGanti = await ambil('/ganti-password');
  catat(3, 'GET /ganti-password itu sendiri', 'TIDAK dialihkan (status 200)', `status=${rHalamanGanti.status}`, rHalamanGanti.status === 200);

  // 4) Ganti password SUNGGUHAN lewat /api/ganti-password (endpoint ini TIDAK BOLEH ikut kena redirect).
  const passwordBaru = `Uji-${Date.now()}-aman`;
  const rGanti = await fetch(`${BASE_URL}/api/ganti-password`, {
    method: 'POST',
    redirect: 'manual',
    headers: { Cookie: cookieHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: passwordBaru }),
  });
  const bodyGanti = await rGanti.json().catch(() => null);
  catat(4, 'POST /api/ganti-password dengan password baru yang valid', 'status 200, tidak dialihkan', `status=${rGanti.status}; body=${JSON.stringify(bodyGanti)}`, rGanti.status === 200);

  // 5) SETELAH ganti password -- sesi LAMA biasanya langsung tidak valid (Supabase
  // Auth mencabut sesi lain begitu password diganti -- itu SENDIRI perilaku
  // keamanan yang benar, bukan bug). Login ULANG dengan cookie jar BARU
  // memakai password BARU -- sesi FRESH ini yang dipakai buktikan /papan TIDAK
  // LAGI dialihkan ke /ganti-password (harus_ganti_password sekarang false).
  const jarBaru = new Map();
  const supabaseBaru = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => Array.from(jarBaru.entries()).map(([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) jarBaru.set(name, value);
      },
    },
  });
  const { error: errLoginBaru } = await supabaseBaru.auth.signInWithPassword({ email: EMAIL, password: passwordBaru });
  if (errLoginBaru) throw new Error(`Login ulang AKUN UJI dengan password baru gagal: ${errLoginBaru.message}`);
  const cookieHeaderBaru = Array.from(jarBaru.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
  const rPapanSetelah = await fetch(`${BASE_URL}/papan`, { headers: { Cookie: cookieHeaderBaru }, redirect: 'manual' });
  catat(
    5,
    'GET /papan, SESI BARU (login ulang pakai password yang baru saja diganti)',
    'TIDAK dialihkan ke /ganti-password lagi',
    `status=${rPapanSetelah.status}; location=${rPapanSetelah.headers.get('location') ?? '(tidak ada)'}`,
    !(rPapanSetelah.status >= 300 && rPapanSetelah.status < 400 && (rPapanSetelah.headers.get('location') ?? '').includes('/ganti-password')),
  );

  // 6) Verifikasi DB langsung -- profile.harus_ganti_password benar-benar false sekarang.
  const { rows: cekFlag } = await db.query(`select harus_ganti_password from public.profile where id = $1`, [idAkun]);
  catat(6, 'profile.harus_ganti_password AKUN UJI di database SETELAH ganti password', 'false', `harus_ganti_password=${cekFlag[0]?.harus_ganti_password}`, cekFlag[0]?.harus_ganti_password === false);

  console.table(hasil.map((h) => ({ '#': h.nomor, skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
  semuaLolos = hasil.length === 6 && hasil.every((h) => h.lolos);
  console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
} finally {
  // Kembalikan AKUN UJI ke admin123 + harus_ganti_password=true OTOMATIS --
  // lewat Admin API (satu-satunya jalur yang bisa mengubah password TANPA
  // tahu password saat ini), DIBUKTIKAN lewat baca ulang DB. Versi Toyib
  // SEBELUMNYA cuma meninggalkan catatan "jalankan skrip lain kalau perlu
  // dikembalikan" -- persis pola gagal-senyap yang ditemukan sisir skrip 7
  // September 2026 (lihat docs/04-CATATAN-TEKNIS.md §7).
  const { error: errPw } = await admin.auth.admin.updateUserById(idAkun, { password: 'admin123' });
  if (errPw) console.error(`🛑 GAGAL mengembalikan password AKUN UJI ke admin123: ${errPw.message}`);
  await db.query('update public.profile set harus_ganti_password = true where id = $1;', [idAkun]);
  const { rows: cekAkun } = await db.query(`select harus_ganti_password from public.profile where id = $1`, [idAkun]);
  console.log(cekAkun[0]?.harus_ganti_password === true
    ? 'AKUN UJI dikembalikan: password admin123, harus_ganti_password = true (dibuktikan baca ulang DB).'
    : `🛑 AKUN UJI BELUM PULIH -- harus_ganti_password=${cekAkun[0]?.harus_ganti_password}.`);
  await db.end();
}

process.exit(semuaLolos ? 0 : 1);
