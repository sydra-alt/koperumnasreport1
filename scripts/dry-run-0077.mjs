// Dry-run migrasi 0077 (penugasan Kontrol F&B per outlet) di DALAM transaksi yang di-ROLLBACK, akun UJI saja.
// Jalankan: node scripts/dry-run-0077.mjs   |   node scripts/dry-run-0077.mjs --terapkan
import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const SQL = fs.readFileSync('supabase/migrations/0077_kontrol_harian_penugasan.sql', 'utf8');
const hasil = [];
const cek = (n, ok, d = '') => { hasil.push(ok); console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${d !== '' ? `  (${d})` : ''}`); };
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
const ada = async () => (await c.query("select to_regprocedure('public.kontrol_harian_penugasan()') f")).rows[0].f !== null;
try {
  if (process.argv.includes('--terapkan')) {
    await c.query(SQL);
    console.log('diterapkan:', await ada());
  } else {
    const tanpaTx = SQL.split('\n').filter((l) => !/^\s*(begin|commit);\s*$/i.test(l)).join('\n');
    const merusak = tanpaTx.replace(/--.*$/gm, '').match(/\b(drop|truncate|alter|rename|delete|update|insert)\b/gi);
    cek('0077: hanya fungsi baru', !merusak, merusak?.join(','));
    cek('0077: fungsi belum ada sebelum migrasi', !(await ada()));
    await c.query('begin');
    await c.query(tanpaTx);
    const id = async (email) => (await c.query('select id from auth.users where email = $1', [email])).rows[0].id;
    const admin = await id('uji6@koperumnas.local');
    const manajer = await id('uji1@koperumnas.local');
    const kontrol = await id('uji3@koperumnas.local');
    const sebagai = async (uid) => {
      await c.query('reset role');
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      await c.query('set local role authenticated');
    };
    const coba = async (q, p = []) => { await c.query('savepoint s'); try { const r = await c.query(q, p); await c.query('release savepoint s'); return { ok: true, r }; } catch (e) { await c.query('rollback to savepoint s'); return { ok: false, e: e.message }; } };
    const kem = (await c.query("select o.id from outlet o where o.slug = 'indokopi_lite_kemayoran'")).rows[0].id;

    await sebagai(admin);
    const awal = await coba('select * from kontrol_harian_penugasan()');
    const peta = awal.ok ? Object.fromEntries(awal.r.rows.map((r) => [r.outlet_id, r.ada_penugasan])) : {};
    cek('Admin: satu baris per outlet terpetakan', awal.ok && awal.r.rows.length === Number((await c.query('select count(*) from outlet_pos_map where not diabaikan')).rows[0].count), awal.e ?? '');
    cek('Kemayoran: belum ada penugasan Kontrol F&B (keadaan produksi hari ini)', peta[kem] === false, JSON.stringify(peta[kem]));
    await c.query('reset role');
    await c.query("insert into assignment (user_id, form_key, outlet_id) values ($1, 'kontrol_fnb', $2)", [kontrol, kem]);
    await sebagai(admin);
    const sesudah = await coba('select ada_penugasan from kontrol_harian_penugasan() where outlet_id = $1', [kem]);
    cek('Kemayoran setelah penugasan (uji3, sementara) -> ada', sesudah.ok && sesudah.r.rows[0]?.ada_penugasan === true);
    await sebagai(manajer);
    const tolak = await coba('select * from kontrol_harian_penugasan()');
    cek('manajer resto (uji1): TIDAK_BERHAK, bukan data kosong', !tolak.ok && /TIDAK_BERHAK/.test(tolak.e));
    await c.query('reset role');
    const anon = await c.query("select has_function_privilege('anon', 'public.kontrol_harian_penugasan()', 'execute') a");
    cek('anon tidak bisa memanggil', anon.rows[0].a === false);
    await c.query('rollback');
    cek('rollback: fungsi & penugasan sementara tidak tertinggal', !(await ada())
      && Number((await c.query("select count(*) from assignment where form_key = 'kontrol_fnb' and user_id = $1 and outlet_id = $2", [kontrol, kem])).rows[0].count) === 0);
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
