#!/usr/bin/env node
// Isi assignment (form) + penugasan_absen (titik absen) untuk 40 akun asli,
// dari docs/DATA-KARYAWAN.md §1/§2 -- instruksi eksplisit user, 30 Agustus
// 2026 ("jangan aku isi manual satu-satu"). Idempoten: cek dulu sebelum
// insert (tabel `assignment` TIDAK punya unique constraint selain id) --
// aman dijalankan ulang, baris lama tidak akan diduplikasi.
//
// DUA HAL YANG SEMULA DITAHAN, SEKARANG SELESAI (30 Agustus 2026, instruksi
// eksplisit CEO lewat user):
//  - security Cahya/Dedi/Yundi @ lokasi "Kantor Pusat" -- baris `lokasi`-nya
//    sudah ditambahkan (migrasi 0040_lokasi_kantor_pusat.sql)
//  - thrifting/kontrol_fnb Ita & Rika -- CEO menjalankan rencana yang sudah
//    tercatat di DATA-KARYAWAN.md apa adanya ("lebih baik ada yang mengisi
//    lalu ditukar, daripada dua form kosong menunggu jawaban") -- BUKAN
//    tebakan agent, CEO bisa menukar sendiri lewat tab Penugasan kalau beda
//
// MASIH SENGAJA DITAHAN/DILEWATI (jangan ditebak, laporkan sebagai sisa):
//  - form apa pun untuk Masudin -- §2 CEO eksplisit "masih belum jelas,
//    jangan ditebak, tetap karyawan saja"
//  - titik absen DTI (Kasam, Syahbudin, Seno) -- lokasi_absen "DTI" belum
//    ada koordinatnya
//  - titik absen Indosteak Pekansari (Cuko) -- lokasi_absen-nya belum ada,
//    cuma "Indosteak cempaka putih" yang ada
//  - titik absen resto rank-and-file (Ryan/Toni/Qasim/Bagus/Ahmad/Elsa/Lusy)
//    -- belum jelas siapa di Cempaka vs Pekansari (§1 catatan ⚠️)
//  - titik absen Toyib (Rukost) -- Rukost sengaja TIDAK PERNAH jadi
//    lokasi/outlet (§5 catatan), tidak ada titik yang bisa dipakai
//  - titik absen Ita/Rika -- form assignment-nya baru selesai sekarang,
//    titik absennya sendiri belum diminta eksplisit, tidak ditebak

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();

async function userId(email) {
  const { rows } = await db.query('select id from auth.users where email = $1', [email]);
  if (rows.length === 0) throw new Error(`Akun tidak ditemukan: ${email}`);
  return rows[0].id;
}
async function lokasiId(nama) {
  const { rows } = await db.query('select id from lokasi where nama = $1', [nama]);
  if (rows.length === 0) throw new Error(`lokasi tidak ditemukan: ${nama}`);
  return rows[0].id;
}
async function outletId(nama) {
  const { rows } = await db.query('select id from outlet where nama = $1', [nama]);
  if (rows.length === 0) throw new Error(`outlet tidak ditemukan: ${nama}`);
  return rows[0].id;
}
async function shiftId(nama) {
  const { rows } = await db.query('select id from shift where nama = $1', [nama]);
  if (rows.length === 0) throw new Error(`shift tidak ditemukan: ${nama}`);
  return rows[0].id;
}
async function titikAbsenId(nama) {
  const { rows } = await db.query('select id from lokasi_absen where nama = $1', [nama]);
  if (rows.length === 0) throw new Error(`lokasi_absen tidak ditemukan: ${nama}`);
  return rows[0].id;
}

let dibuatAssignment = 0;
let dilewatiAssignment = 0;
async function assign(email, formKey, { lokasi = null, outlet = null, shift = null } = {}) {
  const uid = await userId(email);
  const lokId = lokasi ? await lokasiId(lokasi) : null;
  const outId = outlet ? await outletId(outlet) : null;
  const shId = shift ? await shiftId(shift) : null;

  const { rows: ada } = await db.query(
    `select 1 from assignment where user_id = $1 and form_key = $2
       and lokasi_id is not distinct from $3 and outlet_id is not distinct from $4`,
    [uid, formKey, lokId, outId],
  );
  if (ada.length > 0) {
    dilewatiAssignment++;
    return;
  }
  await db.query(
    `insert into assignment (user_id, form_key, lokasi_id, outlet_id, shift_id) values ($1,$2,$3,$4,$5)`,
    [uid, formKey, lokId, outId, shId],
  );
  dibuatAssignment++;
}

let dibuatTitik = 0;
async function titik(email, ...namaTitikList) {
  const uid = await userId(email);
  for (const nama of namaTitikList) {
    const tid = await titikAbsenId(nama);
    const { rowCount } = await db.query(
      `insert into penugasan_absen (user_id, lokasi_absen_id) values ($1,$2) on conflict do nothing`,
      [uid, tid],
    );
    if (rowCount > 0) dibuatTitik++;
  }
}

// ═══ FORM ASSIGNMENT ═══════════════════════════════════════════════════
await assign('sabrina@koperumnas.local', 'pusat');
await assign('sabrina@koperumnas.local', 'hrd');
await assign('didik@koperumnas.local', 'hrd');
await assign('avril@koperumnas.local', 'cs');
await assign('anne@koperumnas.local', 'cs');
await assign('fur@koperumnas.local', 'cs');
await assign('makruf@koperumnas.local', 'perizinan');
await assign('tasya@koperumnas.local', 'perizinan');
await assign('diki@koperumnas.local', 'it');
await assign('ibnu@koperumnas.local', 'it');
await assign('ery@koperumnas.local', 'it');
await assign('ery@koperumnas.local', 'dti');
await assign('ery@koperumnas.local', 'manager_resto', { outlet: 'Indokopi Jatinegara' });
await assign('fauzan@koperumnas.local', 'ga');
await assign('fauzan@koperumnas.local', 'cs');
await assign('cahya@koperumnas.local', 'ga');
await assign('cahya@koperumnas.local', 'cs');
await assign('cahya@koperumnas.local', 'security', { lokasi: 'Kantor Pusat' });
await assign('dedi@koperumnas.local', 'cs');
await assign('dedi@koperumnas.local', 'security', { lokasi: 'Kantor Pusat' });
await assign('yundi@koperumnas.local', 'cs');
await assign('yundi@koperumnas.local', 'security', { lokasi: 'Kantor Pusat' });
await assign('ronald@koperumnas.local', 'pembangunan');
await assign('wandi@koperumnas.local', 'pembangunan');
await assign('seno@koperumnas.local', 'dti');
await assign('kasam@koperumnas.local', 'security', { lokasi: 'DTI', shift: 'Pagi' });
await assign('syahbudin@koperumnas.local', 'security', { lokasi: 'DTI', shift: 'Pagi' });
await assign('tri@koperumnas.local', 'kendaraan');
await assign('dadang@koperumnas.local', 'pic_lokasi', { lokasi: 'Tajur' });
await assign('jery@koperumnas.local', 'pic_lokasi', { lokasi: 'Bekasi' });
await assign('cuko@koperumnas.local', 'manager_resto', { outlet: 'Indosteak Pekansari' });
await assign('dea@koperumnas.local', 'manager_resto', { outlet: 'Indosteak Cempaka' });
await assign('accounting@koperumnas.local', 'accounting');

// Ita & Rika -- CEO menjalankan rencana yang sudah tercatat di
// DATA-KARYAWAN.md (bukan tebakan agent), instruksi eksplisit 30 Agustus 2026.
await assign('ita@koperumnas.local', 'thrifting');
await assign('ita@koperumnas.local', 'kontrol_fnb', { outlet: 'Indokopi Jatinegara' });
await assign('rika@koperumnas.local', 'kontrol_fnb', { outlet: 'Indosteak Cempaka' });
await assign('rika@koperumnas.local', 'kontrol_fnb', { outlet: 'Indosteak Pekansari' });

// ═══ TITIK ABSEN ═══════════════════════════════════════════════════════
const STAF_KANTOR = [
  'sabrina@koperumnas.local', 'didik@koperumnas.local', 'avril@koperumnas.local',
  'anne@koperumnas.local', 'fur@koperumnas.local', 'fauzy@koperumnas.local',
  'makruf@koperumnas.local', 'tasya@koperumnas.local', 'diki@koperumnas.local',
  'ibnu@koperumnas.local', 'fauzan@koperumnas.local', 'ronald@koperumnas.local',
  'wandi@koperumnas.local', 'accounting@koperumnas.local', 'tri@koperumnas.local',
];
for (const email of STAF_KANTOR) await titik(email, 'Kantor Pusat');

await titik('dadang@koperumnas.local', 'Tajur');
await titik('jery@koperumnas.local', 'Bekasi');
await titik('cahya@koperumnas.local', 'Kantor Pusat', 'Indokopi (Jatinegara)');
await titik('dedi@koperumnas.local', 'Kantor Pusat', 'Indokopi (Jatinegara)');
await titik('yundi@koperumnas.local', 'Kantor Pusat', 'Indokopi (Jatinegara)');
await titik('ery@koperumnas.local', 'Indokopi (Jatinegara)');
await titik('fikri@koperumnas.local', 'Indokopi (Jatinegara)');
await titik('fadil@koperumnas.local', 'Indokopi (Jatinegara)');
await titik('dea@koperumnas.local', 'Indosteak cempaka putih');

console.log(`Assignment: ${dibuatAssignment} baru, ${dilewatiAssignment} sudah ada (dilewati).`);
console.log(`Titik absen: ${dibuatTitik} baru (yang sudah ada otomatis dilewati lewat ON CONFLICT).`);

// Rika: wajib_pte = false, "Fokus kontrol stok, tidak menangani marketing"
// (instruksi eksplisit CEO, sama seperti isi field assignment di atas --
// bukan tebakan). Trigger jaga_profil_sensitif() & catat_perubahan_wajib_pte()
// tetap berjalan normal lewat koneksi ini (auth.uid() null di koneksi
// pemilik -- guard-nya SENGAJA mengizinkan, lihat migrasi 0029) --
// actor_id di pte_pengecualian_log akan NULL untuk baris ini (skrip, bukan
// klik CEO lewat Admin), disengaja, bukan bug.
const rikaId = await userId('rika@koperumnas.local');
const { rows: rikaSebelum } = await db.query('select wajib_pte from profile where id = $1', [rikaId]);
if (rikaSebelum[0]?.wajib_pte !== false) {
  await db.query(
    `update profile set wajib_pte = false, alasan_bebas_pte = $2 where id = $1`,
    [rikaId, 'Fokus kontrol stok, tidak menangani marketing'],
  );
  console.log('Rika: wajib_pte diset false ("Fokus kontrol stok, tidak menangani marketing").');
} else {
  console.log('Rika: wajib_pte sudah false sebelumnya, dilewati.');
}

await db.end();
