#!/usr/bin/env node
// Perkakas verifikasi database — dipakai lewat `npm run db -- <file.sql | "SELECT ...">`.
// Konek LANGSUNG sebagai pemilik tabel (SUPABASE_DB_URL), MELEWATI SELURUH RLS.
// Cuma untuk migrasi & verifikasi skema — jangan dipakai untuk uji RLS
// (uji RLS wajib lewat penyamaran `set role authenticated`, lihat skrip Checkpoint 2).
//
// PENGAMAN OPERASI MERUSAK (18 September 2026, instruksi eksplisit CEO) --
// repo ini SATU database untuk dev DAN produksi (26 orang, keputusan sadar,
// lihat docs/PROGRESS.md "Pemisahan dev/produksi: JANGAN dikerjakan"), jadi
// skrip ini adalah SATU-SATUNYA titik yang perlu dijaga, bukan penjaga
// dev-vs-produksi. Aturannya:
// 1. DELETE/UPDATE tanpa WHERE -- DITOLAK SELALU, tanpa pengecualian, tidak
//    ada flag yang bisa membuka jalan ini.
// 2. Perintah merusak lain (DROP, TRUNCATE, ALTER...DROP, DELETE/UPDATE
//    ber-WHERE) -- SELALU dry-run dulu (BEGIN, jalankan, hitung dampak,
//    ROLLBACK) sebagai DEFAULT. Tidak ada yang berubah kalau cuma ini.
// 3. Untuk sungguhan menjalankan: WAJIB `--jalankan=HAPUS` (bisa dari mana
//    saja, TTY atau tidak) ATAU `--jalankan` polos DARI SESI INTERAKTIF
//    (TTY) yang lalu diminta mengetik ulang "HAPUS" setelah melihat
//    perintah + dampaknya. TANPA TTY, `--jalankan` polos DITOLAK -- harus
//    `--jalankan=HAPUS` eksplisit, sesuatu yang tidak mungkin diketik tanpa
//    sadar oleh agent/skrip pembungkus generik.
// 4. Setiap perintah merusak yang BENAR-BENAR dijalankan (bukan dry-run)
//    tercatat di docs/LOG-PERINTAH-MERUSAK.md -- kapan, perintahnya, dampaknya.

import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const BERKAS_LOG = path.join(__dirname, '..', 'docs', 'LOG-PERINTAH-MERUSAK.md');

function sensor(teks) {
  // Jaring pengaman: kalau pesan error apa pun sampai memuat DSN, sensor dulu
  // sebelum dicetak — SUPABASE_DB_URL tidak boleh pernah tampil di layar/log.
  return teks.replace(/postgres(?:ql)?:\/\/\S+/gi, '[DSN disensor]');
}

function waktuWIB() {
  // Format eksplisit, bukan toISOString() (itu UTC) -- CLAUDE.md #2.
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T') + '+07:00';
}

/**
 * Pemisah statement SQL yang sadar string literal ('...', dengan escape ''),
 * dollar-quote ($$...$$ / $tag$...$tag$ -- badan fungsi PL/pgSQL SELALU
 * memakai ini, isinya bisa berisi titik-koma sendiri), dan komentar (-- ...
 * / * ... * /) -- supaya titik-koma DI DALAM ketiganya tidak salah dianggap
 * pemisah statement. Tidak sempurna untuk SQL eksotis apa pun, tapi cukup
 * benar untuk migrasi/kueri di repo ini, dan kalaupun salah, condongnya ke
 * arah AMAN (menganggap sesuatu 1 statement besar, bukan memecahnya salah
 * lalu melewatkan pemeriksaan WHERE).
 */
function pisahkanStatement(sql) {
  const hasil = [];
  let saatIni = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];

    if (c === '-' && sql[i + 1] === '-') {
      const akhir = sql.indexOf('\n', i);
      const potong = akhir === -1 ? n : akhir + 1;
      saatIni += sql.slice(i, potong);
      i = potong;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      const akhir = sql.indexOf('*/', i + 2);
      const potong = akhir === -1 ? n : akhir + 2;
      saatIni += sql.slice(i, potong);
      i = potong;
      continue;
    }
    if (c === "'") {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j += 1; break; }
        j += 1;
      }
      saatIni += sql.slice(i, j);
      i = j;
      continue;
    }
    if (c === '$') {
      const cocok = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (cocok) {
        const penanda = cocok[0];
        const akhir = sql.indexOf(penanda, i + penanda.length);
        const potong = akhir === -1 ? n : akhir + penanda.length;
        saatIni += sql.slice(i, potong);
        i = potong;
        continue;
      }
    }
    if (c === ';') {
      saatIni += c;
      const dipangkas = saatIni.trim();
      if (dipangkas.length > 0) hasil.push(dipangkas);
      saatIni = '';
      i += 1;
      continue;
    }
    saatIni += c;
    i += 1;
  }
  const sisa = saatIni.trim();
  if (sisa.length > 0) hasil.push(sisa);
  return hasil;
}

/** Klasifikasi satu statement -- lihat komentar di atas untuk aturan lengkapnya. */
function klasifikasiStatement(stmt) {
  const cocokDelete = /^\s*delete\s+from\b/i.test(stmt);
  const cocokUpdate = /^\s*update\b/i.test(stmt);
  if (cocokDelete || cocokUpdate) {
    return { tipe: cocokDelete ? 'delete' : 'update', merusak: true, adaWhere: /\bwhere\b/i.test(stmt) };
  }
  if (/\btruncate\b/i.test(stmt)) return { tipe: 'truncate', merusak: true, adaWhere: true };
  // DROP TABLE/COLUMN/CONSTRAINT/dst., termasuk lewat ALTER ... DROP --
  // sama-sama mengandung kata "drop", tidak perlu cabang terpisah.
  if (/\bdrop\b/i.test(stmt)) return { tipe: 'drop', merusak: true, adaWhere: true };
  return { tipe: 'aman', merusak: false, adaWhere: true };
}

function tebakNamaTabel(stmt) {
  let m = /\btruncate\s+(?:table\s+)?(?:only\s+)?"?([\w.]+)"?/i.exec(stmt);
  if (m) return m[1];
  m = /\bdrop\s+table\s+(?:if\s+exists\s+)?"?([\w.]+)"?/i.exec(stmt);
  if (m) return m[1];
  return null;
}

function ambilFlagJalankan(argv) {
  for (const a of argv) {
    if (a === '--jalankan') return { ada: true, nilai: null };
    const cocok = /^--jalankan=(.*)$/.exec(a);
    if (cocok) return { ada: true, nilai: cocok[1] };
  }
  return { ada: false, nilai: undefined };
}

function catatLogPerintahMerusak(daftarDampak, sumber) {
  if (!existsSync(BERKAS_LOG)) {
    appendFileSync(
      BERKAS_LOG,
      '# LOG PERINTAH MERUSAK\n\n' +
        '> Ditulis OTOMATIS oleh `scripts/db.mjs` setiap kali perintah DROP/TRUNCATE/\n' +
        '> DELETE/UPDATE benar-benar DIJALANKAN (bukan dry-run) -- lihat komentar di\n' +
        '> kepala skrip itu untuk aturan lengkapnya. Jangan diedit manual.\n\n',
    );
  }
  const baris = daftarDampak
    .map((d) => `  - ${d.tipe.toUpperCase()}${d.dampak ? ` -- ${d.dampak}` : ''}: \`${d.stmt.replace(/\s+/g, ' ').slice(0, 200)}\``)
    .join('\n');
  appendFileSync(BERKAS_LOG, `- ${waktuWIB()} -- sumber: ${sumber}\n${baris}\n`);
}

function tanyaInteraktif(pertanyaan) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(pertanyaan, (jawaban) => { rl.close(); resolve(jawaban); }));
}

/** true = eksekusi (dry-run maupun sungguhan) sudah berjalan, main() tinggal mengembalikan exit code -- SEMUA jalur keluar lewat sini, bukan process.exit() tersebar, supaya client.end() SELALU lewat satu finally di bawah. */
async function main(client) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Pakai: npm run db -- <file.sql>  atau  npm run db -- "select ..."');
    return 1;
  }
  const sumber = arg.trim().toLowerCase().endsWith('.sql') ? arg : '(perintah langsung)';
  const sql = arg.trim().toLowerCase().endsWith('.sql') ? readFileSync(arg, 'utf8') : arg;
  const flagJalankan = ambilFlagJalankan(process.argv.slice(3));

  const statements = pisahkanStatement(sql);
  const klasifikasi = statements.map((s) => ({ stmt: s, ...klasifikasiStatement(s) }));

  // ATURAN #1 -- tidak ada pengecualian, tidak ada flag yang bisa membuka jalan ini.
  const tanpaWhere = klasifikasi.filter((k) => (k.tipe === 'delete' || k.tipe === 'update') && !k.adaWhere);
  if (tanpaWhere.length > 0) {
    console.error('DITOLAK -- DELETE/UPDATE tanpa WHERE tidak pernah diizinkan, tanpa pengecualian:');
    for (const t of tanpaWhere) console.error(`  ${t.stmt.replace(/\s+/g, ' ')}`);
    return 1;
  }

  const merusak = klasifikasi.filter((k) => k.merusak);

  if (merusak.length === 0) {
    // Jalur AMAN -- persis perilaku lama, tidak ada perubahan.
    const hasilMentah = await client.query(sql);
    const hasil = Array.isArray(hasilMentah) ? hasilMentah[hasilMentah.length - 1] : hasilMentah;
    if (hasil.command === 'SELECT') {
      if (hasil.rows.length > 0) console.table(hasil.rows);
      else console.log('(0 baris)');
    } else {
      console.log(`OK — ${hasil.command ?? 'selesai'}, rowCount=${hasil.rowCount}`);
    }
    return 0;
  }

  // ATURAN #2 -- dry-run WAJIB dulu, SELALU, sebelum apa pun lainnya.
  await client.query('BEGIN');
  const dampak = [];
  try {
    for (const k of klasifikasi) {
      // PENTING: untuk drop/truncate, hitung baris tabel SEBELUM statement-nya
      // dijalankan -- sesudahnya tabel itu sudah kosong (truncate) atau lenyap
      // (drop) di DALAM transaksi ini, jadi hitungannya akan salah/gagal kalau
      // dilakukan sesudah (bukan sebelum).
      let jumlahSebelum = null;
      let namaTabel = null;
      if (k.merusak && (k.tipe === 'drop' || k.tipe === 'truncate')) {
        namaTabel = tebakNamaTabel(k.stmt);
        if (namaTabel) {
          try {
            const c = await client.query(`select count(*)::int as n from ${namaTabel}`);
            jumlahSebelum = c.rows[0].n;
          } catch {
            jumlahSebelum = null;
          }
        }
      }

      const r = await client.query(k.stmt);
      if (!k.merusak) continue;
      if (k.tipe === 'delete') {
        dampak.push({ ...k, dampak: `${r.rowCount} baris akan terhapus` });
      } else if (k.tipe === 'update') {
        dampak.push({ ...k, dampak: `${r.rowCount} baris akan berubah` });
      } else {
        dampak.push({
          ...k,
          dampak: namaTabel ? `tabel "${namaTabel}" berisi ${jumlahSebelum ?? 'TIDAK DIKETAHUI'} baris sekarang` : 'TIDAK BISA DIHITUNG OTOMATIS -- PERIKSA MANUAL',
        });
      }
    }
  } finally {
    await client.query('ROLLBACK'); // tahap ini SELALU pratinjau -- tidak pernah boleh menempel.
  }

  console.log('\n=== PRATINJAU (dry-run — TIDAK ADA yang berubah) ===');
  for (const d of dampak) {
    console.log(`[${d.tipe.toUpperCase()}] ${d.dampak}\n  ${d.stmt.replace(/\s+/g, ' ')}`);
  }

  if (!flagJalankan.ada) {
    console.log('\nIni baru pratinjau. Untuk sungguhan menjalankan, periksa angka di atas lalu tambahkan --jalankan=HAPUS (atau --jalankan dari sesi interaktif).');
    return 0;
  }

  let terkonfirmasi = false;
  if (flagJalankan.nilai === 'HAPUS') {
    terkonfirmasi = true;
  } else if (flagJalankan.nilai !== null) {
    console.error(`DITOLAK -- nilai --jalankan tidak dikenal ("${flagJalankan.nilai}"). Yang diterima cuma --jalankan=HAPUS.`);
    return 1;
  } else if (process.stdin.isTTY) {
    console.log('\nPerintah di atas akan DIJALANKAN SUNGGUHAN, tidak bisa dibatalkan.');
    const jawaban = await tanyaInteraktif('Ketik persis "HAPUS" untuk konfirmasi: ');
    terkonfirmasi = jawaban.trim() === 'HAPUS';
    if (!terkonfirmasi) console.error('Konfirmasi tidak cocok -- DIBATALKAN, tidak ada yang dijalankan.');
  } else {
    console.error('DITOLAK -- tidak ada TTY (dijalankan agent/skrip), --jalankan polos tidak cukup. Tambahkan --jalankan=HAPUS secara eksplisit setelah memeriksa pratinjau di atas.');
  }

  if (!terkonfirmasi) return 1;

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  catatLogPerintahMerusak(dampak, sumber);
  console.log('\nBERHASIL dijalankan sungguhan -- tercatat di docs/LOG-PERINTAH-MERUSAK.md.');
  return 0;
}

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL tidak ditemukan di .env.local');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl });
try {
  await client.connect();
  process.exitCode = await main(client);
} catch (err) {
  console.error('ERROR:', sensor(err.message));
  process.exitCode = 1;
} finally {
  await client.end();
}
