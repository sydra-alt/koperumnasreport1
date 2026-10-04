// Dry-run migrasi 0072 (galat_aplikasi) di DALAM transaksi yang di-ROLLBACK: menerapkan SQL,
// menguji catat_galat() sebagai anon/karyawan/CEO, sensor pesan, RLS baca (CEO/Admin saja),
// view v_galat_per_hari, rem per menit -- lalu membatalkan semuanya.
// Jalankan: node scripts/dry-run-0072.mjs            (dry run, tidak ada yang tersimpan)
//           node scripts/dry-run-0072.mjs --terapkan (menerapkan migrasi sungguhan)
import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const SQL = fs.readFileSync('supabase/migrations/0072_galat_aplikasi.sql', 'utf8');
const hasil = [];
const cek = (n, ok, d = '') => { hasil.push(ok); console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${d !== '' ? `  (${d})` : ''}`); };
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
try {
  if (process.argv.includes('--terapkan')) {
    await c.query(SQL);
    const r = await c.query("select to_regclass('public.galat_aplikasi') t, to_regclass('public.v_galat_per_hari') v");
    console.log('diterapkan:', JSON.stringify(r.rows[0]));
  } else {
    const tanpaTx = SQL.split('\n').filter((l) => !/^\s*(begin|commit);\s*$/i.test(l)).join('\n');
    const merusak = tanpaTx.replace(/--.*$/gm, '').match(/\b(drop|truncate|alter\s+column|rename)\b/gi);
    cek('0072: tanpa drop/truncate/alter column/rename', !merusak, merusak?.join(','));
    await c.query('begin');
    await c.query(tanpaTx);
    const ceo = (await c.query("select user_id from role where role = 'ceo' order by user_id limit 1")).rows[0].user_id;
    const kary = (await c.query("select r.user_id from role r where r.role = 'karyawan' and not exists (select 1 from role x where x.user_id = r.user_id and x.role in ('ceo','admin')) order by r.user_id limit 1")).rows[0].user_id;
    const sebagai = async (uid) => {
      await c.query('reset role');
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(uid ? { sub: uid, role: 'authenticated' } : { role: 'anon' })]);
      await c.query(`set local role ${uid ? 'authenticated' : 'anon'}`);
    };
    const catat = (pesan, rute = '/papan?tanggal=2026-10-01', sumber = 'server') =>
      c.query("select public.catat_galat($1, $2, 'GET', $3, 'abc')", [sumber, rute, pesan]);

    await sebagai(kary);
    await catat('Gagal simpan budi@contoh.com nominal 1500000 password: rahasia eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig');
    cek('karyawan: tidak bisa membaca log', (await c.query('select count(*)::int n from galat_aplikasi')).rows[0].n === 0);
    await c.query('savepoint s');
    const tulis = await c.query("insert into galat_aplikasi (sumber, rute, pesan) values ('server', '/x', 'y')").then(() => true, () => false);
    await c.query(tulis ? 'release savepoint s' : 'rollback to savepoint s');
    cek('karyawan: insert langsung ditolak (tanpa policy tulis)', !tulis);
    await sebagai(null);
    await catat('error tanpa sesi', '/masuk', 'browser');
    await sebagai(ceo);
    const baris = (await c.query('select rute, peran, pesan from galat_aplikasi order by id')).rows;
    cek('CEO: membaca semua log', baris.length === 2, baris.length);
    cek('peran dari sesi (role), bukan argumen', baris[0].peran.split(',').includes('karyawan'), baris[0].peran);
    cek('rute tanpa query string', baris[0].rute === '/papan', baris[0].rute);
    cek('sensor: email, nominal, password, token tidak tersimpan', !/budi@|1500000|rahasia|eyJ/.test(baris[0].pesan), baris[0].pesan);
    cek('anon: peran "tanpa sesi"', baris[1].peran === 'tanpa sesi', baris[1].peran);
    const v = (await c.query('select tanggal::text, server, browser from v_galat_per_hari')).rows;
    cek('view per hari (security invoker): 1 server + 1 layar', v.length === 1 && v[0].server === 1 && v[0].browser === 1, JSON.stringify(v));
    await sebagai(kary);
    cek('view per hari: karyawan tidak melihat apa pun', (await c.query('select count(*)::int n from v_galat_per_hari')).rows[0].n === 0);
    for (let i = 0; i < 70; i++) await catat(`banjir ${i}`);
    await c.query('reset role');
    cek('rem: paling banyak 60 baris per menit', (await c.query('select count(*)::int n from galat_aplikasi')).rows[0].n === 60);
    await c.query('rollback');
    const sisa = (await c.query("select to_regclass('public.galat_aplikasi') t")).rows[0].t;
    cek('rollback: tabel tidak tertinggal', sisa === null);
    console.log(`${hasil.filter(Boolean).length}/${hasil.length} lolos`);
    process.exitCode = hasil.every(Boolean) ? 0 : 1;
  }
} catch (e) {
  await c.query('rollback').catch(() => {});
  console.error(String(e.message).replace(/postgres(ql)?:\/\/\S+/g, '[dsn]'));
  process.exitCode = 1;
} finally {
  await c.end();
}
