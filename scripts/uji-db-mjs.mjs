#!/usr/bin/env node
// ⚠️ MEMBUAT LALU MENGHAPUS TABEL public._uji_db_mjs_scratch di database yang juga PRODUKSI (26 orang),
// dan menjalankan scripts/db.mjs SUNGGUHAN dengan --jalankan=HAPUS terhadap tabel itu SAJA (menulis ke
// docs/LOG-PERINTAH-MERUSAK.md lalu memulihkannya). Tidak menyentuh data produksi; tabel sekali pakai
// dibersihkan di finally. Jangan ubah nama tabel/perintah di sini menjadi tabel sungguhan.
// Uji pengaman operasi merusak di scripts/db.mjs (18 September 2026, instruksi
// eksplisit CEO -- repo ini SATU database dev+produksi, db.mjs adalah
// satu-satunya titik yang perlu dijaga). Menjalankan scripts/db.mjs SUNGGUHAN
// lewat proses anak (bukan memanggil fungsinya langsung -- itu cara
// sebenarnya dipakai lewat `npm run db --`), terhadap TABEL SEKALI PAKAI
// (_uji_db_mjs_scratch, dibuat & dihapus sendiri oleh skrip ini), BUKAN
// data produksi sungguhan.

import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import dotenv from 'dotenv';
import { Client } from 'pg';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(ROOT, '.env.local') });

// docs/LOG-PERINTAH-MERUSAK.md itu audit trail SUNGGUHAN -- uji ini memang
// SENGAJA menjalankan #4 sampai benar-benar tercatat (buktinya mekanismenya
// jalan), tapi TIDAK BOLEH meninggalkan bekas entri uji di berkas produksi
// itu. Isi aslinya (atau ketiadaannya) disimpan di sini, dipulihkan di finally.
const BERKAS_LOG = path.join(ROOT, 'docs', 'LOG-PERINTAH-MERUSAK.md');
const logAslinya = existsSync(BERKAS_LOG) ? readFileSync(BERKAS_LOG, 'utf8') : null;

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
const hasil = [];
function catat(nomor, skenario, harapan, mentah, lolos) {
  hasil.push({ nomor, skenario, harapan, mentah, lolos });
}

/** Jalankan `node scripts/db.mjs <arg> [...extra]` sebagai proses ANAK sungguhan --
 * stdio 'pipe' (bukan 'inherit') supaya `process.stdin.isTTY` di dalamnya
 * PASTI false, persis kondisi saat dipanggil agent/skrip otomatis. */
async function jalankanDbMjs(arg, extra = []) {
  try {
    const { stdout, stderr } = await execFileAsync('node', ['scripts/db.mjs', arg, ...extra], { cwd: ROOT });
    return { kode: 0, stdout, stderr };
  } catch (err) {
    return { kode: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

async function jumlahBaris() {
  const r = await client.query('select count(*)::int as n from public._uji_db_mjs_scratch');
  return r.rows[0].n;
}

try {
  await client.connect();
  await client.query('drop table if exists public._uji_db_mjs_scratch');
  await client.query('create table public._uji_db_mjs_scratch (id serial primary key, nama text not null)');
  await client.query(`insert into public._uji_db_mjs_scratch (nama) values ('satu'), ('dua'), ('tiga')`);

  // #1 -- DELETE tanpa WHERE -- DITOLAK, tidak ada baris terhapus.
  const r1 = await jalankanDbMjs('delete from public._uji_db_mjs_scratch');
  const n1 = await jumlahBaris();
  catat(
    1,
    'DELETE tanpa WHERE',
    'ditolak (exit 1), 3 baris tetap ada',
    `exit=${r1.kode}; n=${n1}; stderr="${r1.stderr.trim().slice(0, 80)}"`,
    r1.kode === 1 && n1 === 3 && r1.stderr.includes('DITOLAK'),
  );

  // #2 -- dry-run (tanpa --jalankan) -- TIDAK mengubah apa pun.
  const r2 = await jalankanDbMjs(`delete from public._uji_db_mjs_scratch where nama = 'satu'`);
  const n2 = await jumlahBaris();
  catat(
    2,
    'DELETE ber-WHERE TANPA --jalankan (dry-run)',
    'exit 0, PRATINJAU tercetak, 3 baris tetap ada (tidak ada yang berubah)',
    `exit=${r2.kode}; n=${n2}; stdout mengandung PRATINJAU=${r2.stdout.includes('PRATINJAU')}`,
    r2.kode === 0 && n2 === 3 && r2.stdout.includes('PRATINJAU') && r2.stdout.includes('1 baris akan terhapus'),
  );

  // #3 -- tanpa TTY (proses anak, stdio pipe), --jalankan POLOS (tanpa nilai) -- DITOLAK.
  const r3 = await jalankanDbMjs(`delete from public._uji_db_mjs_scratch where nama = 'satu'`, ['--jalankan']);
  const n3 = await jumlahBaris();
  catat(
    3,
    'tanpa TTY, --jalankan POLOS (tanpa nilai)',
    'ditolak (exit 1), 3 baris tetap ada',
    `exit=${r3.kode}; n=${n3}; stderr="${r3.stderr.trim().slice(0, 100)}"`,
    r3.kode === 1 && n3 === 3 && r3.stderr.includes('DITOLAK') && r3.stderr.toLowerCase().includes('tty'),
  );

  // #4 -- tanpa TTY, --jalankan=HAPUS -- BERHASIL, baris SUNGGUHAN terhapus, tercatat di log.
  const logSebelum = logAslinya?.length ?? 0;
  const r4 = await jalankanDbMjs(`delete from public._uji_db_mjs_scratch where nama = 'satu'`, ['--jalankan=HAPUS']);
  const n4 = await jumlahBaris();
  const logSesudah = readFileSync(BERKAS_LOG, 'utf8');
  catat(
    4,
    'tanpa TTY, --jalankan=HAPUS (konfirmasi eksplisit)',
    'berhasil (exit 0), 2 baris tersisa, tercatat di LOG-PERINTAH-MERUSAK.md',
    `exit=${r4.kode}; n=${n4}; log bertambah=${logSesudah.length > logSebelum}`,
    r4.kode === 0 && n4 === 2 && logSesudah.length > logSebelum && logSesudah.includes('_uji_db_mjs_scratch'),
  );

  // #5 -- --jalankan dengan nilai SELAIN "HAPUS" -- DITOLAK.
  const r5 = await jalankanDbMjs(`delete from public._uji_db_mjs_scratch where nama = 'dua'`, ['--jalankan=yakin']);
  const n5 = await jumlahBaris();
  catat(5, '--jalankan dengan nilai selain "HAPUS"', 'ditolak (exit 1), 2 baris tetap ada', `exit=${r5.kode}; n=${n5}`, r5.kode === 1 && n5 === 2);

  // #6 -- kegagalan DI TENGAH transaksi dry-run -- ROLLBACK tetap jalan (bukan cuma jalur sukses).
  // Statement 1 (DELETE, destruktif) berhasil, statement 2 (1/0) gagal SENGAJA --
  // finally{ROLLBACK} scripts/db.mjs harus tetap membatalkan statement 1 juga.
  const r6 = await jalankanDbMjs(`delete from public._uji_db_mjs_scratch where nama = 'dua'; select 1/0;`);
  const n6 = await jumlahBaris();
  catat(
    6,
    'gagal DI TENGAH transaksi dry-run (statement kedua error)',
    'exit 1 (error), tapi 2 baris TETAP ADA -- ROLLBACK jalan walau gagal, bukan cuma jalur sukses',
    `exit=${r6.kode}; n=${n6}; stderr mengandung division_by_zero=${r6.stderr.includes('division by zero')}`,
    r6.kode === 1 && n6 === 2,
  );

  // #7 -- TRUNCATE (bukan DELETE) -- dry-run melaporkan jumlah baris tabel, tidak menghapus.
  const r7 = await jalankanDbMjs('truncate table public._uji_db_mjs_scratch');
  const n7 = await jumlahBaris();
  catat(
    7,
    'TRUNCATE (dry-run, tanpa --jalankan)',
    'exit 0, melaporkan "2 baris" di pratinjau, tabel TIDAK terpotong (2 baris tetap ada)',
    `exit=${r7.kode}; n=${n7}; stdout mengandung "2 baris"=${r7.stdout.includes('2 baris')}`,
    r7.kode === 0 && n7 === 2 && r7.stdout.includes('2 baris'),
  );

  // #8-#10 -- berkas SQL yang membawa kendali transaksinya sendiri (29
  // September 2026: pratinjau migrasi 0066 ikut meng-commit karena `commit;`
  // di dalam berkasnya). Berkas sementara di folder temp OS, dihapus di bawah.
  const berkas = (nama, isi) => {
    const f = path.join(os.tmpdir(), `uji-db-mjs-${process.pid}-${nama}.sql`);
    writeFileSync(f, isi);
    return f;
  };
  const f8 = berkas('8', `begin;\ndelete from public._uji_db_mjs_scratch where nama = 'tiga';\ncommit;\n`);
  const r8 = await jalankanDbMjs(f8);
  const r8b = await jalankanDbMjs(f8, ['--jalankan=HAPUS']);
  const n8 = await jumlahBaris();
  catat(
    8,
    'berkas merusak + BEGIN/COMMIT sendiri (pratinjau DAN --jalankan=HAPUS)',
    'DITOLAK dua-duanya (exit 1) SEBELUM statement apa pun jalan, 2 baris tetap ada',
    `exit=${r8.kode}/${r8b.kode}; n=${n8}; stderr="${r8.stderr.trim().slice(0, 90)}"`,
    r8.kode === 1 && r8b.kode === 1 && n8 === 2 && r8.stderr.includes('kendali transaksi'),
  );
  const f9 = berkas('9', `-- migrasi uji\nBEGIN;\nupdate public._uji_db_mjs_scratch set nama = 'x' where nama = 'tiga';\nEND;\n`);
  const r9 = await jalankanDbMjs(f9);
  const { rows: r9baris } = await client.query(`select count(*)::int n from public._uji_db_mjs_scratch where nama = 'x'`);
  catat(
    9,
    'komentar di depan BEGIN, ditutup END (sinonim COMMIT)',
    'tetap terdeteksi & DITOLAK, tidak ada baris berubah',
    `exit=${r9.kode}; baris berubah=${r9baris[0].n}`,
    r9.kode === 1 && r9baris[0].n === 0,
  );
  const f10 = berkas('10', `begin;\nselect count(*) from public._uji_db_mjs_scratch;\ncommit;\n`);
  const r10 = await jalankanDbMjs(f10);
  catat(10, 'berkas TANPA statement merusak boleh membawa BEGIN/COMMIT', 'jalan seperti biasa (exit 0)', `exit=${r10.kode}`, r10.kode === 0);
  const f11 = berkas('11', `-- komentar di depan statement merusak
update public._uji_db_mjs_scratch set nama = 'y' where nama = 'tiga';
`);
  const r11 = await jalankanDbMjs(f11);
  const { rows: r11baris } = await client.query(`select count(*)::int n from public._uji_db_mjs_scratch where nama = 'y'`);
  catat(11, 'UPDATE didahului komentar', 'terdeteksi merusak: muncul di PRATINJAU, tidak ada baris berubah',
    `exit=${r11.kode}; [UPDATE] di pratinjau=${r11.stdout.includes('[UPDATE]')}; berubah=${r11baris[0].n}`,
    r11.kode === 0 && r11.stdout.includes('[UPDATE]') && r11baris[0].n === 0);
  for (const f of [f8, f9, f10, f11]) unlinkSync(f);
} catch (err) {
  console.error('ERROR TAK TERDUGA:', err.message);
  catat('(error)', 'eksekusi skrip', '-', err.message, false);
} finally {
  try {
    await client.query('drop table if exists public._uji_db_mjs_scratch');
  } catch (e) {
    console.error('Gagal membersihkan tabel uji:', e.message);
  }
  // Pulihkan LOG-PERINTAH-MERUSAK.md persis keadaan semula -- audit trail
  // produksi tidak boleh berisi bekas uji, walau uji #4 SENGAJA membuatnya
  // bertambah sesaat untuk membuktikan mekanismenya benar-benar jalan.
  try {
    if (logAslinya === null) {
      if (existsSync(BERKAS_LOG)) unlinkSync(BERKAS_LOG);
    } else {
      writeFileSync(BERKAS_LOG, logAslinya);
    }
  } catch (e) {
    console.error('Gagal memulihkan LOG-PERINTAH-MERUSAK.md:', e.message);
  }
  await client.end();
}

console.table(hasil.map((h) => ({ '#': h.nomor, skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.length === 11 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
