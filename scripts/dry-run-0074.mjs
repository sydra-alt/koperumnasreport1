// Dry-run migrasi 0074 (Kontrol Harian) di DALAM transaksi yang di-ROLLBACK, memakai akun UJI saja:
//   uji3 (penugasan kontrol_fnb = peran Ita), uji6 (admin), uji-ceo (ceo), uji1 (manajer resto, tanpa akses),
//   uji2 (diberi peran pusat SEMENTARA di dalam transaksi -> hanya lihat).
// Jalankan: node scripts/dry-run-0074.mjs   |   node scripts/dry-run-0074.mjs --terapkan
import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const SQL = fs.readFileSync('supabase/migrations/0074_kontrol_harian.sql', 'utf8');
const hasil = [];
const cek = (n, ok, d = '') => { hasil.push(ok); console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${d !== '' ? `  (${d})` : ''}`); };
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();
try {
  if (process.argv.includes('--terapkan')) {
    await c.query(SQL);
    console.log('diterapkan:', (await c.query("select to_regclass('public.kontrol_harian_catatan')::text t")).rows[0].t);
  } else {
    const tanpaTx = SQL.split('\n').filter((l) => !/^\s*(begin|commit);\s*$/i.test(l)).join('\n');
    const merusak = tanpaTx.replace(/--.*$/gm, '').match(/\b(drop|truncate|alter\s+column|rename|delete)\b/gi);
    cek('0074: tanpa drop/truncate/alter column/rename/delete', !merusak, merusak?.join(','));
    await c.query('begin');
    await c.query(tanpaTx);
    const id = async (email) => (await c.query('select id from auth.users where email = $1', [email])).rows[0].id;
    const [ita, admin, ceo, manajer, lihat] = await Promise.all(['uji3', 'uji6', 'uji-ceo', 'uji1', 'uji2'].map((u) => id(`${u}@koperumnas.local`)));
    await c.query("insert into role (user_id, role) values ($1, 'pusat') on conflict do nothing", [lihat]);
    const outlet = (await c.query("select o.id, m.pos_outlet_id from outlet_pos_map m join outlet o on o.id = m.outlet_id where o.slug = 'indokopi_lite_kemayoran'")).rows[0];
    await c.query("insert into report (form_key, tanggal, author_id, outlet_id, data, status, submitted_at) values ('kontrol_fnb', '2026-10-05', $1, $2, $3, 'terkirim', now())",
      [ita, outlet.id, JSON.stringify({ cash: 0, qris: 150000, bank: 50000.4 })]);
    const sebagai = async (uid) => {
      await c.query('reset role');
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      await c.query('set local role authenticated');
    };
    const coba = async (q, p = []) => { await c.query('savepoint s'); try { const r = await c.query(q, p); await c.query('release savepoint s'); return { ok: true, r }; } catch (e) { await c.query('rollback to savepoint s'); return { ok: false, e: e.message }; } };
    const tulis = (uid) => coba("insert into kontrol_harian_catatan (outlet_id, tanggal, penyebab, tindakan, diubah_oleh) values ($1, '2026-10-05', 'beras tidak di resep', 'isi resep', $2) on conflict (outlet_id, tanggal) do update set tindakan = excluded.tindakan, diubah_oleh = excluded.diubah_oleh, diubah_pada = now()", [outlet.id, uid]);

    for (const [nama, uid, ubah, lihatHarus] of [['Ita (uji3)', ita, true, true], ['admin (uji6)', admin, true, true], ['ceo (uji-ceo)', ceo, true, true], ['pusat (uji2)', lihat, false, true], ['manajer resto (uji1)', manajer, false, false]]) {
      await sebagai(uid);
      const hak = (await c.query('select boleh_lihat_kontrol_harian() l, boleh_ubah_kontrol_harian() u')).rows[0];
      cek(`${nama}: lihat=${lihatHarus}, ubah=${ubah}`, hak.l === lihatHarus && hak.u === ubah, JSON.stringify(hak));
      const t = await tulis(uid);
      cek(`${nama}: menulis catatan ${ubah ? 'boleh' : 'DITOLAK'}`, t.ok === ubah, t.e ?? '');
      const uang = await coba('select * from kontrol_harian_uang($1)', ['2026-10-05']);
      if (lihatHarus) {
        const k = uang.ok ? uang.r.rows.find((r) => r.outlet_id === outlet.id) : null;
        cek(`${nama}: uang masuk Kemayoran terbaca dari Laporan Kontrol F&B`, !!k && k.status_laporan === 'terkirim' && Number(k.qris) === 150000 && Number(k.bank) === 50000 && Number(k.cash) === 0 && k.pos_outlet_id === outlet.pos_outlet_id, JSON.stringify(k));
        cek(`${nama}: catatan terbaca`, (await c.query('select count(*)::int n from kontrol_harian_catatan')).rows[0].n === 1);
      } else {
        cek(`${nama}: kontrol_harian_uang DITOLAK (TIDAK_BERHAK, bukan data kosong)`, !uang.ok && /TIDAK_BERHAK/.test(uang.e));
        cek(`${nama}: catatan TIDAK terbaca`, (await c.query('select count(*)::int n from kontrol_harian_catatan')).rows[0].n === 0);
      }
    }
    await sebagai(ita);
    const palsu = await coba("update kontrol_harian_catatan set diubah_oleh = $1 where outlet_id = $2", [admin, outlet.id]);
    cek('Ita: tidak bisa memalsukan diubah_oleh', !palsu.ok);
    await c.query('rollback');
    cek('rollback: tabel & fungsi tidak tertinggal', (await c.query("select to_regclass('public.kontrol_harian_catatan') t, to_regprocedure('public.kontrol_harian_uang(date)') f")).rows.every((r) => r.t === null && r.f === null));
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
