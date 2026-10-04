// Dry-run migrasi 0073 (status_cadangan) di DALAM transaksi yang di-ROLLBACK, lalu batal.
// Jalankan: node scripts/dry-run-0073.mjs   |   node scripts/dry-run-0073.mjs --terapkan
import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const SQL = fs.readFileSync('supabase/migrations/0073_status_cadangan.sql', 'utf8');
const hasil = [];
const cek = (n, ok, d = '') => { hasil.push(ok); console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${d !== '' ? `  (${d})` : ''}`); };
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
try {
  if (process.argv.includes('--terapkan')) {
    await c.query(SQL);
    console.log('diterapkan:', (await c.query("select to_regclass('public.status_cadangan')::text t")).rows[0].t);
  } else {
    const tanpaTx = SQL.split('\n').filter((l) => !/^\s*(begin|commit);\s*$/i.test(l)).join('\n');
    const merusak = tanpaTx.replace(/--.*$/gm, '').match(/\b(drop|truncate|alter\s+column|rename|delete|update)\b/gi);
    cek('0073: tanpa drop/truncate/alter column/rename/delete/update', !merusak, merusak?.join(','));
    await c.query('begin');
    await c.query(tanpaTx);
    await c.query("insert into status_cadangan values ('laporan', now(), 'ok', now(), 1000, 'x.dump.enc')");
    const ceo = (await c.query("select user_id from role where role = 'ceo' order by user_id limit 1")).rows[0].user_id;
    const kary = (await c.query("select r.user_id from role r where r.role = 'karyawan' and not exists (select 1 from role x where x.user_id = r.user_id and x.role in ('ceo','admin')) limit 1")).rows[0].user_id;
    const sebagai = async (uid) => {
      await c.query('reset role');
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      await c.query('set local role authenticated');
    };
    await sebagai(ceo);
    cek('CEO membaca status', (await c.query('select count(*)::int n from status_cadangan')).rows[0].n === 1);
    await sebagai(kary);
    cek('karyawan tidak membaca apa pun', (await c.query('select count(*)::int n from status_cadangan')).rows[0].n === 0);
    await c.query('savepoint s');
    const tulis = await c.query("insert into status_cadangan values ('z', now(), 'ok', null, null, null)").then(() => true, () => false);
    await c.query(tulis ? 'release savepoint s' : 'rollback to savepoint s');
    cek('pengguna aplikasi tidak bisa menulis', !tulis);
    await c.query('rollback');
    cek('rollback: tabel tidak tertinggal', (await c.query("select to_regclass('public.status_cadangan') t")).rows[0].t === null);
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
