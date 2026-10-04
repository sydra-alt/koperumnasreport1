// Pemulihan & uji pemulihan cadangan (7 Oktober 2026) -- lihat docs/PEMULIHAN-DATA.md.
//
//   node scripts/cadangan/pulihkan.mjs --dekripsi <file.dump.enc> <keluaran.dump>
//       membuka satu cadangan menjadi file pg_dump biasa (untuk pg_restore ke proyek baru).
//   node scripts/cadangan/pulihkan.mjs --uji
//       UJI PEMULIHAN: cadangan TERBARU tiap database dipulihkan ke Postgres sementara di folder
//       temp OS (port 54329, hanya localhost), lalu jumlah baris SETIAP tabel public + auth.users
//       dibandingkan dengan database produksi (baca saja). Folder sementara & file polos dihapus
//       setelahnya. Produksi tidak pernah ditulis.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pipeline } from 'node:stream/promises';
import { envPg, FOLDER, kunciDari, MAGIC, PG_BIN, SUMBER } from './cadangkan.mjs';

const require = createRequire(import.meta.url);
const pg = require('pg');
const PORT_UJI = 54329;

export async function dekripsi(masuk, keluaran) {
  const ukuran = fs.statSync(masuk).size;
  const fd = fs.openSync(masuk, 'r');
  const kepala = Buffer.alloc(MAGIC.length + 28);
  fs.readSync(fd, kepala, 0, kepala.length, 0);
  const tag = Buffer.alloc(16);
  fs.readSync(fd, tag, 0, 16, ukuran - 16);
  fs.closeSync(fd);
  if (!kepala.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Bukan file cadangan Koperumnas.');
  const salt = kepala.subarray(MAGIC.length, MAGIC.length + 16);
  const iv = kepala.subarray(MAGIC.length + 16, MAGIC.length + 28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', kunciDari(salt), iv);
  decipher.setAuthTag(tag);
  try {
    await pipeline(fs.createReadStream(masuk, { start: kepala.length, end: ukuran - 17 }), decipher, fs.createWriteStream(keluaran, { mode: 0o600 }));
  } catch (e) {
    fs.rmSync(keluaran, { force: true });
    throw new Error(`Dekripsi gagal (kunci salah atau file rusak): ${e.message}`);
  }
}

function jalan(bin, args, opsi = {}) {
  const r = spawnSync(path.join(PG_BIN, bin), args, { encoding: 'utf8', ...opsi });
  return { kode: r.status, keluaran: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

// Peran & skema bawaan Supabase yang dirujuk dump (GRANT, policy TO authenticated, dsb.).
const STUB = `
do $$ declare r text; begin
  foreach r in array array['anon','authenticated','service_role','authenticator','supabase_admin','supabase_auth_admin',
    'supabase_storage_admin','supabase_realtime_admin','supabase_replication_admin','supabase_read_only_user','dashboard_user','pgbouncer','supabase_functions_admin']
  loop if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if; end loop;
end $$;
create schema if not exists extensions;
-- pg_restore -n auth memulihkan ISI skema auth, bukan skemanya sendiri.
create schema if not exists auth;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
`;

async function hitungBaris(client) {
  const tabel = (await client.query(`select table_schema s, table_name t from information_schema.tables
    where table_type = 'BASE TABLE' and (table_schema = 'public' or (table_schema = 'auth' and table_name = 'users')) order by 1, 2`)).rows;
  const hasil = {};
  for (const { s, t } of tabel) hasil[`${s}.${t}`] = (await client.query(`select count(*)::int n from "${s}"."${t}"`)).rows[0].n;
  return hasil;
}

async function uji() {
  const kerja = fs.mkdtempSync(path.join(os.tmpdir(), 'koperumnas-uji-pulih-'));
  const data = path.join(kerja, 'data');
  let jalanKah = false;
  let semuaLolos = true;
  try {
    const init = jalan('initdb', ['-D', data, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C']);
    if (init.kode !== 0) throw new Error(`initdb gagal: ${init.keluaran.slice(-300)}`);
    // stdio 'ignore': di Windows server mewarisi pipa keluaran pg_ctl dan menahannya terbuka,
    // sehingga spawnSync tidak pernah kembali. Keluaran server ada di server.log.
    const mulai = jalan('pg_ctl', ['-D', data, '-l', path.join(kerja, 'server.log'), '-o', `-p ${PORT_UJI} -c listen_addresses=localhost`, '-w', 'start'], { stdio: 'ignore' });
    if (mulai.kode !== 0) throw new Error(`Postgres sementara gagal jalan (lihat ${path.join(kerja, 'server.log')})`);
    jalanKah = true;

    for (const sumber of SUMBER) {
      const file = fs.readdirSync(FOLDER).filter((f) => f.startsWith(`${sumber.nama}-`) && f.endsWith('.dump.enc')).sort().pop();
      if (!file) { console.log(`GAGAL ${sumber.nama}: belum ada cadangan di ${FOLDER}`); semuaLolos = false; continue; }
      const polos = path.join(kerja, `${sumber.nama}.dump`);
      await dekripsi(path.join(FOLDER, file), polos);
      const db = `pulih_${sumber.nama.replace(/-/g, '_')}`;
      const admin = new pg.Client({ host: 'localhost', port: PORT_UJI, user: 'postgres', database: 'postgres' });
      await admin.connect();
      await admin.query(`create database ${db}`);
      await admin.end();
      const lokal = new pg.Client({ host: 'localhost', port: PORT_UJI, user: 'postgres', database: db });
      await lokal.connect();
      await lokal.query(STUB);
      const pulih = jalan('pg_restore', ['--no-owner', '-h', 'localhost', '-p', String(PORT_UJI), '-U', 'postgres', '-d', db, '-n', 'auth', '-n', 'public', polos]);
      fs.rmSync(polos, { force: true });
      const galat = (pulih.keluaran.match(/^pg_restore: error:.*$/gm) ?? []);
      const dipulihkan = await hitungBaris(lokal);
      await lokal.end();

      const prod = new pg.Client(pgDariEnv(envPg(sumber)));
      await prod.connect();
      await prod.query('begin read only');
      const asli = await hitungBaris(prod);
      await prod.query('rollback');
      await prod.end();

      const beda = Object.keys(asli).filter((k) => asli[k] !== dipulihkan[k]);
      const total = Object.values(dipulihkan).reduce((a, b) => a + (b ?? 0), 0);
      const lolos = beda.length === 0;
      semuaLolos &&= lolos;
      console.log(`${lolos ? 'LOLOS' : 'GAGAL'} ${sumber.nama}: ${file} -> ${Object.keys(asli).length} tabel, ${total} baris dipulihkan; beda jumlah baris: ${beda.length ? beda.map((k) => `${k} ${dipulihkan[k] ?? 'hilang'}/${asli[k]}`).join(', ') : 'tidak ada'}`);
      const jenis = [...new Set((pulih.keluaran.match(/^pg_restore: error: could not execute query: ERROR:\s+(.*)$/gm) ?? []).map((g) => g.replace(/^.*ERROR:\s+/, '').replace(/"[^"]*"/g, '"…"').slice(0, 90)))];
      console.log(`      pesan pg_restore: ${galat.length}${jenis.length ? ` -- jenis: ${jenis.slice(0, 6).join(' | ')}` : ''}`);
    }
  } finally {
    if (jalanKah) jalan('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    fs.rmSync(kerja, { recursive: true, force: true });
  }
  console.log(semuaLolos ? 'UJI PEMULIHAN LOLOS' : 'UJI PEMULIHAN GAGAL');
  process.exitCode = semuaLolos ? 0 : 1;
}

function pgDariEnv(e) {
  return { host: e.PGHOST, port: Number(e.PGPORT), user: e.PGUSER, password: e.PGPASSWORD, database: e.PGDATABASE, ssl: { rejectUnauthorized: false } };
}

const [perintah, a, b] = process.argv.slice(2);
try {
  if (perintah === '--dekripsi' && a && b) {
    await dekripsi(a, b);
    console.log(`Selesai: ${b}`);
  } else if (perintah === '--uji') {
    await uji();
  } else {
    console.log('Pakai: --dekripsi <file.dump.enc> <keluaran.dump>  |  --uji');
    process.exitCode = 2;
  }
} catch (e) {
  console.error(String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '[dsn]'));
  process.exitCode = 1;
}
