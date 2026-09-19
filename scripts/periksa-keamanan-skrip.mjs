#!/usr/bin/env node
// Pemeriksa statis keamanan skrip -- mencegah terulangnya insiden "skrip uji
// mengubah kebijakan produksi lalu gagal di tengah" (19 September 2026).
// Repo ini SATU database untuk dev DAN produksi, jadi SETIAP skrip di scripts/
// yang menulis ke database harus masuk SALAH SATU kategori:
//
//   TRANSAKSIONAL  -- ada `begin` dan ROLLBACK di blok finally terakhir, dan tidak ada
//                     COMMIT. Aman secara konstruksi (koneksi putus = rollback).
//   LIVE-UJI       -- nama `uji-*`, menulis sungguhan (server yang diuji membaca lewat
//                     koneksi lain, transaksi mustahil): WAJIB memakai
//                     scripts/_pengaman-uji.mjs (pemulihan dari sinyal/galat) DAN banner
//                     peringatan di 3 baris pertama.
//   ALAT           -- bukan `uji-*` (buat-akun, isi-penugasan, ...): WAJIB banner
//                     peringatan di 3 baris pertama.
//
// ATURAN MUTLAK (tanpa pengecualian): skrip `uji-*` NON-transaksional TIDAK BOLEH
// menulis tabel `policy`.
//
// Jalankan: node scripts/periksa-keamanan-skrip.mjs   (exit 1 kalau ada pelanggaran)

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dikecualikan dengan alasan tertulis (bukan diam-diam):
const PENGECUALIAN = {
  'db.mjs': 'perkakas SQL sengaja; punya pengaman operasi merusak sendiri (lihat kepala berkas)',
  'uji-db-mjs.mjs': 'menulis HANYA tabel sekali pakai _uji_db_mjs_scratch dan dibersihkan di finally; punya banner',
  'periksa-keamanan-skrip.mjs': 'pemeriksa ini sendiri',
  'uji-pengaman-uji.mjs': 'tidak menyentuh database',
};

const POLA_TULIS_SQL = /\b(insert\s+into|update\s+(public\.)?[a-z_."]+\s+set|delete\s+from|truncate\b|alter\s+table|drop\s+(table|policy|function|trigger)|create\s+(or\s+replace\s+)?(table|function|policy|trigger))/i;
const POLA_TULIS_API = /(\.upsert\(|\.insert\(|\.update\(|\.delete\(|auth\.admin\.(create|update|delete)User|updateUserById)/;
const POLA_TULIS_POLICY = /(insert\s+into\s+(public\.)?policy\b|update\s+(public\.)?policy\s+set|delete\s+from\s+(public\.)?policy\b|from\(\s*['"`]policy['"`]\s*\)\s*\.(insert|update|upsert|delete))/i;
const POLA_BANNER = /(⚠️|🛑)/;

function tanpaKomentar(baris) {
  return baris.filter((b) => !/^\s*\/\//.test(b));
}

const berkas = readdirSync(__dirname).filter((f) => /\.(mjs|mts)$/.test(f) && !f.startsWith('_'));
const laporan = [];
let pelanggaran = 0;

for (const f of berkas) {
  if (PENGECUALIAN[f]) {
    laporan.push({ berkas: f, kategori: 'dikecualikan', catatan: PENGECUALIAN[f], ok: true });
    continue;
  }
  const baris = readFileSync(path.join(__dirname, f), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const kode = tanpaKomentar(baris);
  const teks = kode.join('\n');
  const menulis = POLA_TULIS_SQL.test(teks) || POLA_TULIS_API.test(teks);
  if (!menulis) {
    laporan.push({ berkas: f, kategori: 'baca-saja', catatan: '', ok: true });
    continue;
  }

  const punyaBegin = kode.some((b) => /\bbegin\b/i.test(b) && /(query|q)\(|['"`]begin/i.test(b));
  const idxFinally = kode.map((b, i) => (/\bfinally\b/.test(b) ? i : -1)).filter((i) => i >= 0).pop();
  const rollbackDiFinally = idxFinally !== undefined && /rollback/i.test(kode.slice(idxFinally, idxFinally + 12).join('\n'));
  const punyaCommit = kode.some((b) => /['"`;]\s*commit\b|\bcommit;/i.test(b) && !/\.replace\(/.test(b));
  const transaksional = punyaBegin && rollbackDiFinally && !punyaCommit;

  const bannerDiAwal = baris.slice(0, 4).some((b) => POLA_BANNER.test(b));
  const pakaiPengaman = /_pengaman-uji\.mjs/.test(teks);
  const namaUji = f.startsWith('uji-');
  const salah = [];

  if (namaUji && !transaksional && POLA_TULIS_POLICY.test(teks)) {
    salah.push('skrip uji NON-transaksional menulis tabel policy (dilarang mutlak)');
  }
  if (!transaksional) {
    if (!bannerDiAwal) salah.push('tidak ada banner peringatan (⚠️/🛑) di 4 baris pertama');
    if (namaUji && !pakaiPengaman) salah.push('skrip uji live tidak memakai scripts/_pengaman-uji.mjs');
  }

  const kategori = transaksional ? 'transaksional' : namaUji ? 'live-uji' : 'alat';
  const ok = salah.length === 0;
  if (!ok) pelanggaran++;
  laporan.push({ berkas: f, kategori, catatan: salah.join('; '), ok });
}

console.table(laporan.map((l) => ({ berkas: l.berkas, kategori: l.kategori, status: l.ok ? 'ok' : 'PELANGGARAN', catatan: l.catatan })));
const hitung = (k) => laporan.filter((l) => l.kategori === k).length;
console.log(`\n${berkas.length} skrip: ${hitung('transaksional')} transaksional, ${hitung('live-uji')} live-uji, ${hitung('alat')} alat, ${hitung('baca-saja')} baca-saja, ${hitung('dikecualikan')} dikecualikan.`);
console.log(pelanggaran === 0 ? '✅ Tidak ada pelanggaran.' : `🛑 ${pelanggaran} pelanggaran.`);
process.exit(pelanggaran === 0 ? 0 : 1);
