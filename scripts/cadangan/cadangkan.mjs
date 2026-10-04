// Cadangan terenkripsi database produksi (7 Oktober 2026) -- lihat docs/PEMULIHAN-DATA.md.
//
//   node scripts/cadangan/cadangkan.mjs --buat-kunci   sekali saja: membuat file kunci acak
//   node scripts/cadangan/cadangkan.mjs                mencadangkan kedua database
//   node scripts/cadangan/cadangkan.mjs --susulan [--jarak-jam 144]
//       dipanggil Task Scheduler (Senin 09.00 DAN saat login): mencadangkan HANYA kalau cadangan OK
//       terakhir lebih tua dari --jarak-jam (bawaan 144 jam = 6 hari; harian: 20). Jadwal yang
//       terlewat karena laptop mati tersusul begitu laptop menyala lagi.
//
// Setiap percobaan menulis status_cadangan di database yang dicadangkan (tanggal, hasil, ukuran,
// nama file -- tanpa rahasia), dibaca dashboard Admin/owner: "Cadangan terakhir: N hari lalu".
//
// - pg_dump (format custom) dari kedua proyek Supabase (pos-fnb & laporan), dialirkan LANGSUNG ke
//   enkripsi AES-256-GCM -- tidak pernah ada salinan polos di disk.
// - Kunci: file acak di luar semua repo (KUNCI di bawah). Tidak pernah dicetak, tidak pernah di-commit.
// - Kredensial database dibaca dari .env.local masing-masing repo (sudah ada, tidak di-commit), dikirim
//   ke pg_dump lewat variabel lingkungan PG*, bukan argumen baris perintah.
// - Disimpan di FOLDER (di luar repo). Retensi: SIMPAN_HARI hari, minimal MIN_SIMPAN file per database.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { Transform } from 'node:stream';
import { createRequire } from 'node:module';

const pg = createRequire(import.meta.url)('pg');

const DIR_REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PG_BIN = process.env.KOPERUMNAS_PG_BIN || 'D:/USER/alat/pgsql/bin';
export const FOLDER = process.env.KOPERUMNAS_CADANGAN || 'D:/USER/cadangan-koperumnas';
export const KUNCI = process.env.KOPERUMNAS_KUNCI || path.join(os.homedir(), '.koperumnas-cadangan', 'kunci-cadangan.txt');
const SIMPAN_HARI = Number(process.env.KOPERUMNAS_SIMPAN_HARI || 56);
const MIN_SIMPAN = 4;
export const SUMBER = [
  { nama: 'pos-fnb', env: path.resolve(DIR_REPO, '../pos-fnb/.env.local'), kunci: 'DATABASE_URL' },
  { nama: 'laporan', env: path.join(DIR_REPO, '.env.local'), kunci: 'SUPABASE_DB_URL' },
];
export const MAGIC = Buffer.from('KPRCDN1');

/** Variabel PG* untuk proses anak -- kredensial tidak pernah masuk argumen/log. */
export function envPg(sumber) {
  const isi = Object.fromEntries(
    fs.readFileSync(sumber.env, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
  );
  const u = new URL(isi[sumber.kunci]);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.slice(1) || 'postgres',
    PGSSLMODE: 'require',
  };
}

export function kunciDari(salt) {
  const rahasia = fs.readFileSync(KUNCI, 'utf8').trim();
  if (rahasia.length < 32) throw new Error(`File kunci terlalu pendek: ${KUNCI}`);
  return crypto.scryptSync(rahasia, salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function catatLog(baris) {
  fs.mkdirSync(FOLDER, { recursive: true });
  fs.appendFileSync(path.join(FOLDER, 'cadangan.log'), `${new Date().toISOString()} ${baris}\n`);
  console.log(baris);
}

function cap() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}_${g('hour')}${g('minute')}`;
}

/** Status terakhir untuk dashboard (tanpa rahasia). Gagal menulis status tidak menggagalkan cadangan. */
async function tulisStatus(sumber, hasil) {
  const e = envPg(sumber);
  const c = new pg.Client({ host: e.PGHOST, port: Number(e.PGPORT), user: e.PGUSER, password: e.PGPASSWORD, database: e.PGDATABASE, ssl: { rejectUnauthorized: false } });
  try {
    await c.connect();
    await c.query(
      `insert into status_cadangan (basis_data, terakhir_coba, hasil_terakhir, terakhir_ok, ukuran_byte, nama_file)
       values ($1, now(), $2, case when $2 = 'ok' then now() end, $3, $4)
       on conflict (basis_data) do update set terakhir_coba = now(), hasil_terakhir = excluded.hasil_terakhir,
         terakhir_ok = coalesce(excluded.terakhir_ok, status_cadangan.terakhir_ok),
         ukuran_byte = coalesce(excluded.ukuran_byte, status_cadangan.ukuran_byte),
         nama_file = coalesce(excluded.nama_file, status_cadangan.nama_file)`,
      [sumber.nama, hasil.ok ? 'ok' : 'gagal', hasil.ukuran ?? null, hasil.namaFile ?? null],
    );
  } catch (err) {
    catatLog(`STATUS-GAGAL ${sumber.nama}: ${String(err.message).replace(/postgres(ql)?:\/\/\S+/g, '[dsn]').slice(0, 200)}`);
  } finally {
    await c.end().catch(() => {});
  }
}

/** Waktu cadangan OK terakhir per database, dari cadangan.log (lokal, tanpa jaringan). */
export function okTerakhir(nama) {
  const log = path.join(FOLDER, 'cadangan.log');
  if (!fs.existsSync(log)) return null;
  const baris = fs.readFileSync(log, 'utf8').split(/\r?\n/).filter((l) => l.includes(` OK ${nama} `));
  const t = baris.length ? Date.parse(baris[baris.length - 1].split(' ')[0]) : NaN;
  return Number.isNaN(t) ? null : t;
}

async function cadangkanSatu(sumber) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', kunciDari(salt), iv);
  const akhir = path.join(FOLDER, `${sumber.nama}-${cap()}.dump.enc`);
  const sementara = `${akhir}.sementara`;
  const keluar = fs.createWriteStream(sementara, { mode: 0o600 });
  keluar.write(Buffer.concat([MAGIC, salt, iv]));

  const dump = spawn(path.join(PG_BIN, 'pg_dump'), ['--format=custom', '--compress=6', '--no-password'], { env: envPg(sumber), stdio: ['ignore', 'pipe', 'pipe'] });
  let galat = '';
  dump.stderr.on('data', (d) => { galat += d.toString(); });
  const selesai = new Promise((res) => dump.on('close', res));
  const tambahTag = new Transform({
    transform(chunk, _e, cb) { cb(null, chunk); },
    flush(cb) { this.push(cipher.getAuthTag()); cb(); },
  });
  try {
    await pipeline(dump.stdout, cipher, tambahTag, keluar);
    const kode = await selesai;
    if (kode !== 0) throw new Error(`pg_dump keluar dengan kode ${kode}: ${galat.split('\n')[0].replace(/postgres(ql)?:\/\/\S+/g, '[dsn]').slice(0, 200)}`);
    fs.renameSync(sementara, akhir);
    const ukuran = fs.statSync(akhir).size;
    catatLog(`OK ${sumber.nama} ${path.basename(akhir)} ${(ukuran / 1024 / 1024).toFixed(2)} MB`);
    await tulisStatus(sumber, { ok: true, ukuran, namaFile: path.basename(akhir) });
    return true;
  } catch (e) {
    fs.rmSync(sementara, { force: true });
    catatLog(`GAGAL ${sumber.nama}: ${String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '[dsn]').slice(0, 300)}`);
    await tulisStatus(sumber, { ok: false });
    return false;
  }
}

function rapikan(nama) {
  const file = fs.readdirSync(FOLDER).filter((f) => f.startsWith(`${nama}-`) && f.endsWith('.dump.enc')).sort().reverse();
  const batas = Date.now() - SIMPAN_HARI * 86_400_000;
  for (const f of file.slice(MIN_SIMPAN)) {
    const p = path.join(FOLDER, f);
    if (fs.statSync(p).mtimeMs < batas) {
      fs.rmSync(p);
      catatLog(`HAPUS-LAMA ${f}`);
    }
  }
}

async function utama() {
  if (process.argv.includes('--buat-kunci')) {
    if (fs.existsSync(KUNCI)) {
      console.log(`Kunci sudah ada (tidak ditimpa): ${KUNCI}`);
      return;
    }
    fs.mkdirSync(path.dirname(KUNCI), { recursive: true });
    fs.writeFileSync(KUNCI, crypto.randomBytes(48).toString('base64url') + '\n', { mode: 0o600, flag: 'wx' });
    console.log(`Kunci baru dibuat: ${KUNCI}`);
    return;
  }
  if (!fs.existsSync(KUNCI)) throw new Error(`File kunci tidak ada: ${KUNCI} (jalankan dengan --buat-kunci sekali)`);
  fs.mkdirSync(FOLDER, { recursive: true });
  const susulan = process.argv.includes('--susulan');
  const iJarak = process.argv.indexOf('--jarak-jam');
  const jarakJam = iJarak > 0 ? Number(process.argv[iJarak + 1]) : 144;
  let semua = true;
  for (const s of SUMBER) {
    const terakhir = okTerakhir(s.nama);
    if (susulan && terakhir !== null && Date.now() - terakhir < jarakJam * 3_600_000) {
      console.log(`LEWATI ${s.nama}: cadangan OK terakhir ${((Date.now() - terakhir) / 3_600_000).toFixed(1)} jam lalu (< ${jarakJam} jam)`);
      continue;
    }
    semua = (await cadangkanSatu(s)) && semua;
    rapikan(s.nama);
  }
  process.exitCode = semua ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  utama().catch((e) => {
    catatLog(`GAGAL: ${String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '[dsn]')}`);
    process.exitCode = 1;
  });
}
