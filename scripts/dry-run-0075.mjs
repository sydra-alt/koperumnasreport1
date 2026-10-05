// Dry-run migrasi 0075 (akses POS peran admin -> Pusat) di DALAM transaksi yang di-ROLLBACK, akun UJI saja:
//   uji6 (admin) diberi punya_akses_pos SEMENTARA di dalam transaksi; uji1 (manajer resto) sebagai pembanding.
// Jalankan: node scripts/dry-run-0075.mjs   |   node scripts/dry-run-0075.mjs --terapkan
import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const SQL = fs.readFileSync('supabase/migrations/0075_akses_pos_admin.sql', 'utf8');
const hasil = [];
const cek = (n, ok, d = '') => { hasil.push(ok); console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${d !== '' ? `  (${d})` : ''}`); };
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
try {
  const baris = async () => (await c.query("select peran_pos, cakupan from peta_akses_pos where sumber = 'peran' and kunci = 'admin'")).rows;
  if (process.argv.includes('--terapkan')) {
    await c.query(SQL);
    console.log('diterapkan:', JSON.stringify(await baris()));
  } else {
    const tanpaTx = SQL.split('\n').filter((l) => !/^\s*(begin|commit);\s*$/i.test(l)).join('\n');
    const merusak = tanpaTx.replace(/--.*$/gm, '').match(/\b(drop|truncate|alter|rename|delete|update)\b/gi);
    cek('0075: hanya insert (tanpa drop/truncate/alter/rename/delete/update)', !merusak, merusak?.join(','));
    cek('0075: belum ada baris peran admin sebelum migrasi', (await baris()).length === 0);
    await c.query('begin');
    const id = async (email) => (await c.query('select id from auth.users where email = $1', [email])).rows[0].id;
    const [admin, manajer] = await Promise.all(['uji6', 'uji1'].map((u) => id(`${u}@koperumnas.local`)));
    const sebagai = async (uid) => {
      await c.query('reset role');
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      await c.query('set local role authenticated');
    };
    const akses = async (uid) => { await sebagai(uid); const r = (await c.query('select akses_pos_saya() a')).rows[0].a; await c.query('reset role'); return r; };

    // Trigger profil memeriksa auth.uid(): saklar punya_akses_pos diubah SEBAGAI uji6 (admin, memang berhak).
    const saklar = async (nilai) => { await sebagai(admin); await c.query('update profile set punya_akses_pos = $2 where id = $1', [admin, nilai]); await c.query('reset role'); };
    const manajerSebelum = await akses(manajer);
    await saklar(true);
    const adminSebelum = await akses(admin);
    cek('sebelum 0075: admin (uji6) belum dapat semua outlet POS', !(adminSebelum.boleh && adminSebelum.semua_outlet), JSON.stringify(adminSebelum));
    await c.query(tanpaTx);
    const adminSesudah = await akses(admin);
    cek('sesudah 0075: admin + punya_akses_pos -> manager, semua outlet (termasuk Pusat)', adminSesudah.boleh === true && adminSesudah.peran_pos === 'manager' && adminSesudah.semua_outlet === true, JSON.stringify(adminSesudah));
    await saklar(false);
    const adminTanpa = await akses(admin);
    cek('sesudah 0075: admin TANPA punya_akses_pos -> tetap ditolak', adminTanpa.boleh === false && adminTanpa.alasan === 'tanpa_akses_pos', JSON.stringify(adminTanpa));
    const manajerSesudah = await akses(manajer);
    cek('manajer resto (uji1) tidak berubah', JSON.stringify(manajerSesudah) === JSON.stringify(manajerSebelum), JSON.stringify(manajerSesudah));
    await c.query('rollback');
    cek('rollback: baris peta & punya_akses_pos uji6 kembali seperti semula', (await baris()).length === 0
      && (await c.query('select punya_akses_pos p from profile where id = $1', [admin])).rows[0].p === false);
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
