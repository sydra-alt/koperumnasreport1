// Dry-run migrasi 0076 (gerbang Nilai Aset Persediaan) di DALAM transaksi yang di-ROLLBACK.
// Perubahan data hanya pada akun UJI (ikut di-ROLLBACK); Ita & Mba Rika HANYA dibaca lewat penyamaran.
// Jalankan: node scripts/dry-run-0076.mjs   |   node scripts/dry-run-0076.mjs --terapkan
import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const SQL = fs.readFileSync('supabase/migrations/0076_aset_persediaan.sql', 'utf8');
const hasil = [];
const cek = (n, ok, d = '') => { hasil.push(ok); console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${d !== '' ? `  (${d})` : ''}`); };
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
const ada = async () => (await c.query("select to_regprocedure('public.boleh_lihat_aset_persediaan()') f")).rows[0].f !== null;
try {
  if (process.argv.includes('--terapkan')) {
    await c.query(SQL);
    console.log('diterapkan:', await ada());
  } else {
    const tanpaTx = SQL.split('\n').filter((l) => !/^\s*(begin|commit);\s*$/i.test(l)).join('\n');
    const merusak = tanpaTx.replace(/--.*$/gm, '').match(/\b(drop|truncate|alter|rename|delete|update|insert)\b/gi);
    cek('0076: hanya fungsi baru (tanpa drop/alter/delete/update/insert)', !merusak, merusak?.join(','));
    cek('0076: fungsi belum ada sebelum migrasi', !(await ada()));
    await c.query('begin');
    await c.query(tanpaTx);
    const id = async (email) => (await c.query('select id from auth.users where email = $1', [email])).rows[0].id;
    const uid = [];
    for (const u of ['uji-ceo', 'uji6', 'uji3', 'uji1', 'uji2']) uid.push(await id(`${u}@koperumnas.local`));
    const [ceo, admin, kontrol, manajer, polos] = uid;
    const nyata = async (nama) => (await c.query('select id from profile where nama = $1', [nama])).rows[0]?.id;
    const [ita, rika] = [await nyata('Ita'), await nyata('Mba Rika')];
    const sebagai = async (uid) => {
      await c.query('reset role');
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      await c.query('set local role authenticated');
    };
    const boleh = async (uid) => { await sebagai(uid); const r = (await c.query('select boleh_lihat_aset_persediaan() b')).rows[0].b; await c.query('reset role'); return r; };
    const peran = async (uid, role) => { await c.query('reset role'); await c.query('insert into role (user_id, role) values ($1, $2) on conflict do nothing', [uid, role]); };

    cek('CEO (uji-ceo) boleh', (await boleh(ceo)) === true);
    cek('Admin (uji6) boleh', (await boleh(admin)) === true);
    cek('manajer resto (uji1) DITOLAK', (await boleh(manajer)) === false);
    cek('penugasan kontrol_fnb saja (uji3) DITOLAK', (await boleh(kontrol)) === false);
    cek('karyawan biasa (uji2) DITOLAK', (await boleh(polos)) === false);
    await peran(polos, 'pusat');
    cek('peran pusat (uji2 sementara) DITOLAK', (await boleh(polos)) === false);
    await peran(polos, 'accounting');
    cek('accounting (uji2 sementara) boleh', (await boleh(polos)) === true);
    // Tanda akses_semua_outlet_pos hanya boleh diubah CEO/Admin -> diubah SEBAGAI uji6.
    await sebagai(admin); await c.query('update profile set akses_semua_outlet_pos = true where id = $1', [kontrol]); await c.query('reset role');
    cek('akses_semua_outlet_pos (uji3 sementara, = cara Ita dikenali) boleh', (await boleh(kontrol)) === true);
    if (ita) cek('Ita (baca saja, penyamaran) boleh', (await boleh(ita)) === true);
    if (rika) cek('Mba Rika (baca saja, penyamaran) DITOLAK', (await boleh(rika)) === false);
    await sebagai(null);
    const anon = await c.query("select has_function_privilege('anon', 'public.boleh_lihat_aset_persediaan()', 'execute') a");
    cek('anon tidak bisa memanggil', anon.rows[0].a === false);
    await c.query('reset role');
    await c.query('rollback');
    cek('rollback: fungsi tidak tertinggal', !(await ada()));
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
