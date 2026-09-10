#!/usr/bin/env node
// Akun UJI KHUSUS (7 September 2026) -- lahir dari insiden Qasim & Ryan:
// skrip uji sebelumnya memakai akun karyawan SUNGGUHAN untuk menguji
// Laporan Kebersihan, gagal memulihkan password mereka SENYAP ({error}
// dari admin.auth.admin.updateUserById tidak diperiksa), dan nyaris membuat
// dua karyawan tidak bisa masuk kerja. Lihat docs/PROGRESS.md dan
// docs/04-CATATAN-TEKNIS.md §7 untuk kronologi lengkap.
//
// ATURAN MUTLAK SEJAK INSIDEN INI: skrip uji TIDAK PERNAH menyentuh akun
// orang sungguhan -- password, harus_ganti_password, role, assignment,
// penugasan_absen, ATAU DATA APA PUN miliknya. Kalau butuh login sungguhan
// untuk uji RLS/RPC, pakai SALAH SATU dari lima akun ini.
//
// profile.nama SEMUA diawali "AKUN UJI -" -- sengaja MENYOLOK supaya siapa
// pun yang melihat daftar karyawan (Admin, Tinjau, ekspor) langsung tahu ini
// bukan orang sungguhan, dan supaya skrip uji baru bisa mencari akun uji
// lewat `nama like 'AKUN UJI%'` alih-alih menebak nama orang.
//
// Lima peran representatif (bukan kombinasi acak) -- dipilih supaya skrip
// uji apa pun di masa depan yang butuh "satu manager resto"/"satu HRD"/dst
// tinggal pakai salah satu, tanpa perlu membuat akun baru lagi:
//   uji1 -- manager_resto (Indosteak Cempaka, + penugasan_absen di titik yang sama)
//   uji2 -- karyawan resto biasa (Indosteak Cempaka, penugasan_absen SAMA
//           dengan uji1 -- dipakai untuk uji "dua orang berbagi satu laporan
//           outlet", pola persis yang dulu memakai Qasim & Ryan sungguhan)
//   uji3 -- kontrol_fnb (Indosteak Cempaka)
//   uji4 -- HRD kadiv (role kadiv + divisi HRD -- gerbang is_hrd_kadiv(),
//           JUGA dipakai sebagai pengganti generik utk uji "pusat"/ceo-lite
//           yang cuma butuh lolos gerbang ekspor absensi, bukan Sabrina)
//   uji5 -- tanpa peran apa pun (bukan salah ketik -- sengaja kosong, utk
//           uji "user login tapi tidak berhak apa-apa") -- JUGA diberi
//           penugasan_absen di "Lokasi Uji" (titik GPS-testing lama, migrasi
//           0032) supaya uji radius GPS palsu (dulu memakai Dadang
//           sungguhan) punya tempat berpijak tanpa menyentuh akun nyata.
//
// uji6 -- TAMBAHAN DI LUAR permintaan awal (dicatat eksplisit, bukan
//         diam-diam): sisir scripts/ (7 September 2026) menemukan SATU
//         skrip (uji-daftar-putih-role.mjs) yang butuh akun ber-role
//         'admin' sungguhan (Diki) untuk menguji "admin tidak bisa
//         menaikkan role dirinya sendiri" -- tidak ada padanannya di lima
//         akun yang diminta. Ditambahkan supaya skrip itu juga bisa lepas
//         dari akun nyata, dilaporkan terpisah ke user, BUKAN diputuskan
//         sendiri tanpa jejak.
//
// Idempoten (pola sama buat-akun.mjs) -- aman dijalankan ulang, email yang
// sudah ada dilewati.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const PASSWORD_SEMENTARA = 'admin123'; // sama seragam dgn buat-akun.mjs -- harus_ganti_password=true memaksa ganti sebelum dipakai

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!supabaseUrl || !serviceRoleKey || !dbUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_DB_URL tidak lengkap di .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const db = new Client({ connectionString: dbUrl });
await db.connect();

const { rows: cempakaRows } = await db.query("select id from public.outlet where nama = 'Indosteak Cempaka'");
const cempakaId = cempakaRows[0].id;
const { rows: titikRows } = await db.query("select id from public.lokasi_absen where nama = 'Indosteak cempaka putih'");
const titikCempakaId = titikRows[0].id;
const { rows: titikUjiRows } = await db.query("select id from public.lokasi_absen where nama like 'Lokasi Uji%'");
const titikLokasiUjiId = titikUjiRows[0]?.id ?? null;

const AKUN = [
  { email: 'uji1@koperumnas.local', nama: 'AKUN UJI - Manager Resto', jabatan: 'Manager Resto (uji)', divisi: 'Uji', roles: ['manager_resto', 'karyawan'], penugasanAbsen: titikCempakaId, assignments: [{ form_key: 'manager_resto', outlet_id: cempakaId }, { form_key: 'kebersihan', outlet_id: cempakaId }] },
  { email: 'uji2@koperumnas.local', nama: 'AKUN UJI - Karyawan Resto', jabatan: 'Karyawan Resto (uji)', divisi: 'Uji', roles: ['karyawan'], penugasanAbsen: titikCempakaId, assignments: [{ form_key: 'kebersihan', outlet_id: cempakaId }] },
  { email: 'uji3@koperumnas.local', nama: 'AKUN UJI - Kontrol FnB', jabatan: 'Kontrol FnB (uji)', divisi: 'Uji', roles: ['karyawan'], penugasanAbsen: null, assignments: [{ form_key: 'kontrol_fnb', outlet_id: cempakaId }] },
  { email: 'uji4@koperumnas.local', nama: 'AKUN UJI - HRD Kadiv', jabatan: 'Kepala Divisi HRD (uji)', divisi: 'HRD', roles: ['kadiv', 'karyawan'], penugasanAbsen: null, assignments: [] },
  { email: 'uji5@koperumnas.local', nama: 'AKUN UJI - Tanpa Peran', jabatan: null, divisi: null, roles: [], penugasanAbsen: titikLokasiUjiId, assignments: [] },
  { email: 'uji6@koperumnas.local', nama: 'AKUN UJI - Admin', jabatan: 'Admin (uji)', divisi: 'Uji', roles: ['admin'], penugasanAbsen: null, assignments: [] },
];

// ── 1. Cek email mana yang sudah ada ──────────────────────────────────────
const { rows: sudahAda } = await db.query('select email from auth.users where email = any($1)', [AKUN.map((a) => a.email)]);
const emailSudahAda = new Set(sudahAda.map((r) => r.email));

// ── 2. Buat akun auth yang belum ada -- .error DIPERIKSA (pelajaran insiden ini) ──
for (const akun of AKUN) {
  if (emailSudahAda.has(akun.email)) {
    console.log(`${akun.email} -- sudah ada, dilewati`);
    continue;
  }
  const { error } = await supabaseAdmin.auth.admin.createUser({ email: akun.email, password: PASSWORD_SEMENTARA, email_confirm: true });
  if (error) {
    console.error(`${akun.email} -- GAGAL dibuat: ${error.message}`);
    continue;
  }
  console.log(`${akun.email} -- dibuat`);
}

// ── 3. Isi profile + role + penugasan_absen + assignment ─────────────────
for (const akun of AKUN) {
  await db.query(
    `insert into public.profile (id, nama, jabatan, divisi)
     select id, $2, $3, $4 from auth.users where email = $1
     on conflict (id) do update set nama = excluded.nama, jabatan = excluded.jabatan, divisi = excluded.divisi`,
    [akun.email, akun.nama, akun.jabatan, akun.divisi],
  );
  for (const role of akun.roles) {
    await db.query(
      `insert into public.role (user_id, role) select id, $2 from auth.users where email = $1 on conflict do nothing`,
      [akun.email, role],
    );
  }
  if (akun.penugasanAbsen) {
    await db.query(
      `insert into public.penugasan_absen (user_id, lokasi_absen_id)
       select id, $2 from auth.users where email = $1 on conflict do nothing`,
      [akun.email, akun.penugasanAbsen],
    );
  }
  for (const a of akun.assignments) {
    await db.query(
      `insert into public.assignment (user_id, form_key, outlet_id)
       select u.id, $2, $3 from auth.users u where u.email = $1
       and not exists (select 1 from public.assignment x where x.user_id = u.id and x.form_key = $2 and x.outlet_id = $3)`,
      [akun.email, a.form_key, a.outlet_id],
    );
  }
}

// ── 4. CEK -- baca ULANG dari database, bukan dipercaya dari langkah di atas ──
console.log('\nCEK -- profile + role:');
const { rows: cekProfile } = await db.query(
  `select p.nama, p.divisi, array_agg(distinct r.role) filter (where r.role is not null) as peran
   from public.profile p left join public.role r on r.user_id = p.id
   where p.nama like 'AKUN UJI%' group by p.nama, p.divisi order by p.nama`,
);
console.table(cekProfile);

console.log('\nCEK -- penugasan_absen + assignment:');
const { rows: cekTugas } = await db.query(
  `select p.nama,
          (select la.nama from public.penugasan_absen pa join public.lokasi_absen la on la.id = pa.lokasi_absen_id where pa.user_id = p.id limit 1) as titik_absen,
          array_agg(distinct a.form_key) filter (where a.form_key is not null) as form_assignment
   from public.profile p left join public.assignment a on a.user_id = p.id
   where p.nama like 'AKUN UJI%' group by p.id, p.nama order by p.nama`,
);
console.table(cekTugas);

await db.end();
