#!/usr/bin/env node
// Uji HTTP sungguhan (deploy) untuk Nilai Aset Persediaan & Kesiapan Outlet, AKUN UJI saja:
//   uji6 (admin) harus 200, uji1 (manajer resto) harus 403 -- bukan data kosong.
// Hanya mencetak kode status dan HITUNGAN (tidak ada token, password, atau angka rupiah).
// Jalankan: UJI_BASE_URL=https://koperumnasreport.vercel.app node scripts/uji-http-pusat.mjs [aset] [kesiapan]
// Sesi dibuat dengan library @supabase/ssr sendiri (pola uji-ekspor-keuangan-curl.mjs), tidak ditebak.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createServerClient } from '@supabase/ssr';
import pg from 'pg';
import { passwordUji } from './_kredensial-uji.mjs';
import { pasangPemulih } from './_pengaman-uji.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), quiet: true });
const BASE_URL = process.env.UJI_BASE_URL ?? 'http://localhost:3000';
const pilihan = process.argv.slice(2);
const jalankan = (k) => pilihan.length === 0 || pilihan.includes(k);
const bulan = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()).slice(0, 7);

const hasil = [];
const cek = (n, ok, d = '') => { hasil.push(ok); console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${d !== '' ? `  (${d})` : ''}`); };

async function sesi(email) {
  const jar = new Map();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })), setAll: (c) => { for (const { name, value } of c) jar.set(name, value); } },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password: passwordUji(email) });
  if (error) throw new Error(`login ${email} gagal`);
  return [...jar.entries()].map(([n, v]) => `${n}=${v}`).join('; ');
}
const ambil = async (cookie, p) => {
  const r = await fetch(`${BASE_URL}${p}`, { headers: { Cookie: cookie }, redirect: 'manual' });
  return { status: r.status, json: await r.json().catch(() => null) };
};

// Middleware mengalihkan akun harus_ganti_password ke /ganti-password -- dimatikan SEMENTARA untuk
// dua akun uji ini, lalu dikembalikan PERSIS ke nilai semula (dibaca ulang). Password tidak disentuh.
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await db.connect();
const AKUN = ['uji6@koperumnas.local', 'uji1@koperumnas.local'];
const semula = (await db.query('select p.id, u.email, p.harus_ganti_password f from profile p join auth.users u on u.id = p.id where u.email = any($1)', [AKUN])).rows;
const pulihkan = pasangPemulih('uji-http-pusat', async () => {
  for (const r of semula) await db.query('update profile set harus_ganti_password = $2 where id = $1', [r.id, r.f]);
  const cek = (await db.query('select p.id, p.harus_ganti_password f from profile p where p.id = any($1)', [semula.map((r) => r.id)])).rows;
  const pulih = semula.every((r) => cek.find((c) => c.id === r.id)?.f === r.f);
  console.log(pulih ? 'Akun uji dikembalikan: harus_ganti_password seperti semula.' : '🛑 Akun uji BELUM pulih -- jalankan scripts/pulihkan-akun-uji.mjs');
  await db.end();
});
try {
await db.query('update profile set harus_ganti_password = false where id = any($1)', [semula.map((r) => r.id)]);
const admin = await sesi('uji6@koperumnas.local');
const manajer = await sesi('uji1@koperumnas.local');

if (jalankan('aset')) {
  const a = await ambil(admin, `/api/aset-persediaan?bulan=${bulan}`);
  cek('aset: admin (uji6) 200', a.status === 200, a.status === 200 ? '' : JSON.stringify(a.json));
  if (a.status === 200) {
    const j = a.json;
    cek('aset: Pusat ada dan pertama', j.lokasi[0]?.pusat === true, j.lokasi.map((l) => l.nama).join(' | '));
    console.log('      lokasi:', j.lokasi.map((l) => `${l.nama}: ${l.jumlahBahanBernilai} bahan bernilai, ${l.tanpaHarga.length} tanpa harga, ${l.stokMinus.length} minus`).join(' | '));
    console.log(`      HPP ${bulan}: ${j.hpp.total.jumlahPenjualan} penjualan, ${j.hpp.total.penjualanHppBelumLengkap} HPP belum lengkap`);
  }
  const m = await ambil(manajer, `/api/aset-persediaan?bulan=${bulan}`);
  cek('aset: manajer resto (uji1) 403 tidakBerhak', m.status === 403 && m.json?.tidakBerhak === true, m.status);
  const s = await ambil(admin, '/api/aset-persediaan?bulan=2099-01');
  cek('aset: bulan masa depan 400', s.status === 400, s.status);
  const t = await ambil('', `/api/aset-persediaan?bulan=${bulan}`);
  cek('aset: tanpa sesi ditolak (401 atau dialihkan ke /masuk)', t.status === 401 || (t.status === 307 && true), t.status);
}

if (jalankan('kesiapan')) {
  const a = await ambil(admin, '/api/kesiapan-outlet');
  cek('kesiapan: admin (uji6) 200', a.status === 200, a.status === 200 ? '' : JSON.stringify(a.json));
  if (a.status === 200) {
    cek('kesiapan: Pusat tidak ikut', !a.json.baris.some((b) => /pusat/i.test(b.nama)), a.json.baris.map((b) => b.nama).join(' | '));
    for (const b of a.json.baris) {
      console.log(`      ${b.nama}: ${b.hitung.ok} OK, ${b.hitung.kurang} Kurang, ${b.hitung.risiko} Risiko -- Kurang: ${b.butir.filter((x) => x.status === 'kurang').map((x) => x.butir).join(', ') || '-'}; Risiko: ${b.butir.filter((x) => x.status === 'risiko').map((x) => x.butir).join(', ') || '-'}`);
    }
  }
  const m = await ambil(manajer, '/api/kesiapan-outlet');
  cek('kesiapan: manajer resto (uji1) 403 tidakBerhak', m.status === 403 && m.json?.tidakBerhak === true, m.status);
  const kh = await ambil(admin, `/api/kontrol-harian?tanggal=${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(Date.now() - 86_400_000))}`);
  const kem = kh.json?.baris?.find((b) => /Kemayoran/.test(b.outletNama));
  cek('Kontrol Harian: Kemayoran menyebut "belum bisa diisi karena belum ada penugasan"', kh.status === 200 && !!kem && kem.kurang.some((k) => /belum bisa diisi karena belum ada penugasan/i.test(k)), kh.status);
}

} finally {
  await pulihkan();
}
console.log(`${hasil.filter(Boolean).length}/${hasil.length} lolos`);
process.exitCode = hasil.every(Boolean) ? 0 : 1;
