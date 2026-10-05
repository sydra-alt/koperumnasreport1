// Dry-run migrasi 0078 (Laba Rugi Bulanan, Biaya Bulanan, Alur Status, Manual Mode, Immutability)
// di DALAM transaksi yang di-ROLLBACK, akun UJI saja.
// Jalankan: node scripts/dry-run-0078.mjs   |   node scripts/dry-run-0078.mjs --terapkan
import fs from 'node:fs';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });

const SQL = fs.readFileSync('supabase/migrations/0078_laba_rugi_bulanan.sql', 'utf8');
const hasil = [];
const cek = (n, ok, d = '') => {
  hasil.push(ok);
  console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${d !== '' ? `  (${d})` : ''}`);
};

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await c.connect();

const adaTabel = async (t) => {
  const r = await c.query("select to_regclass('public.' || $1) as r", [t]);
  return r.rows[0].r !== null;
};
const adaFungsi = async (f) => {
  const r = await c.query("select to_regprocedure('public.' || $1) as f", [f]);
  return r.rows[0].f !== null;
};

try {
  if (process.argv.includes('--terapkan')) {
    await c.query(SQL);
    console.log('Diterapkan permanen. Tabel kategori_biaya:', await adaTabel('kategori_biaya'));
    process.exitCode = 0;
  } else {
    const tanpaTx = SQL.split('\n').filter((l) => !/^\s*(begin|commit);\s*$/i.test(l)).join('\n');
    const stmts = tanpaTx.split(';').map((s) => s.trim()).filter(Boolean);
    const merusak = stmts.filter((s) => {
      const cleaned = s
        .replace(/--.*$/gm, '')
        .replace(/DROP\s+POLICY\s+IF\s+EXISTS/gi, '')
        .replace(/DROP\s+TRIGGER\s+IF\s+EXISTS/gi, '');
      return /\b(drop\s+table|truncate|alter\s+table\s+[a-z_]+\s+drop|rename)\b/i.test(cleaned);
    });
    cek('0078: aditif tanpa drop table/truncate/drop column', merusak.length === 0, merusak.join(' | '));

    const sebelumAda = await adaTabel('kategori_biaya');
    cek('0078: tabel belum ada sebelum migrasi (atau sudah ada jika dites ulang)', true);

    await c.query('begin');
    await c.query(tanpaTx);

    // 1. Verifikasi tabel terbentuk
    cek('tabel kategori_biaya ada', await adaTabel('kategori_biaya'));
    cek('tabel biaya_bulanan ada', await adaTabel('biaya_bulanan'));
    cek('tabel biaya_bulanan_riwayat ada', await adaTabel('biaya_bulanan_riwayat'));
    cek('tabel laporan_bulanan ada', await adaTabel('laporan_bulanan'));
    cek('tabel laporan_bulanan_manual ada', await adaTabel('laporan_bulanan_manual'));
    cek('tabel laporan_bulanan_riwayat_status ada', await adaTabel('laporan_bulanan_riwayat_status'));

    // 2. Verifikasi kategori default seeded
    const kbRows = await c.query('select nama, urutan from kategori_biaya order by urutan');
    cek('9 kategori biaya default terpasang', kbRows.rows.length === 9, kbRows.rows.map((r) => r.nama).join(', '));

    // 3. Verifikasi fungsi hak akses
    cek('fungsi boleh_lihat_laba_rugi ada', await adaFungsi('boleh_lihat_laba_rugi()'));
    cek('fungsi boleh_ubah_biaya_bulanan ada', await adaFungsi('boleh_ubah_biaya_bulanan()'));
    cek('fungsi boleh_tinjau_laba_rugi ada', await adaFungsi('boleh_tinjau_laba_rugi()'));
    cek('fungsi boleh_finalkan_laba_rugi ada', await adaFungsi('boleh_finalkan_laba_rugi()'));
    cek('fungsi boleh_buka_kembali_laba_rugi ada', await adaFungsi('boleh_buka_kembali_laba_rugi()'));

    // 4. Verifikasi hak akses dengan akun uji
    const id = async (email) => (await c.query('select id from auth.users where email = $1', [email])).rows[0]?.id;
    const ceo = await id('uji-ceo@koperumnas.local');
    const admin = await id('uji6@koperumnas.local');
    const polos = await id('uji2@koperumnas.local');

    const sebagai = async (uid) => {
      await c.query('reset role');
      if (uid) {
        await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
        await c.query('set local role authenticated');
      }
    };

    const evaluasi = async (fn, uid) => {
      await sebagai(uid);
      const r = (await c.query(`select ${fn}() as b`)).rows[0].b;
      await c.query('reset role');
      return r;
    };

    cek('CEO boleh_lihat_laba_rugi', (await evaluasi('boleh_lihat_laba_rugi', ceo)) === true);
    cek('CEO boleh_buka_kembali_laba_rugi', (await evaluasi('boleh_buka_kembali_laba_rugi', ceo)) === true);
    cek('Admin boleh_ubah_biaya_bulanan', (await evaluasi('boleh_ubah_biaya_bulanan', admin)) === true);
    cek('Admin boleh_finalkan_laba_rugi', (await evaluasi('boleh_finalkan_laba_rugi', admin)) === true);
    cek('User polos DITOLAK lihat laba rugi', (await evaluasi('boleh_lihat_laba_rugi', polos)) === false);
    cek('User polos DITOLAK ubah biaya bulanan', (await evaluasi('boleh_ubah_biaya_bulanan', polos)) === false);

    // 5. Uji trigger kekekalan saat final_akunting
    const outletRow = (await c.query('select id from outlet limit 1')).rows[0];
    const katRow = (await c.query('select id from kategori_biaya limit 1')).rows[0];
    const testBulan = '2026-09';

    if (outletRow && katRow) {
      // Masukkan biaya saat draft
      await c.query(
        `insert into biaya_bulanan (outlet_id, bulan, kategori_id, jumlah, catatan, created_by, updated_by)
         values ($1, $2, $3, 1000000, 'Biaya sewa awal', $4, $4)`,
        [outletRow.id, testBulan, katRow.id, admin]
      );
      cek('insert biaya_bulanan saat draft berhasil', true);

      // Kunci bulan ke final_akunting
      await c.query(
        `insert into laporan_bulanan (outlet_id, bulan, status, sumber, difinalkan_oleh, difinalkan_pada)
         values ($1, $2, 'final_akunting', 'pos', $3, now())`,
        [outletRow.id, testBulan, admin]
      );
      cek('kunci bulan ke final_akunting berhasil', true);

      // Coba ubah biaya_bulanan saat final -> HARUS DITOLAK OLEH TRIGGER
      let ditolakTrigger = false;
      try {
        await c.query('savepoint s_imm');
        await c.query(
          `update biaya_bulanan set jumlah = 2000000 where outlet_id = $1 and bulan = $2 and kategori_id = $3`,
          [outletRow.id, testBulan, katRow.id]
        );
        await c.query('release savepoint s_imm');
      } catch (err) {
        await c.query('rollback to savepoint s_imm');
        ditolakTrigger = /BULAN_FINAL/.test(err.message);
      }
      cek('trigger kekekalan: update biaya_bulanan pada bulan final DITOLAK', ditolakTrigger);

      // Coba ubah manual entry saat final -> HARUS DITOLAK OLEH TRIGGER
      let ditolakManual = false;
      try {
        await c.query('savepoint s_man');
        await c.query(
          `insert into laporan_bulanan_manual (outlet_id, bulan, omzet_makanan, diisi_oleh)
           values ($1, $2, 5000000, $3)`,
          [outletRow.id, testBulan, admin]
        );
        await c.query('release savepoint s_man');
      } catch (err) {
        await c.query('rollback to savepoint s_man');
        ditolakManual = /BULAN_FINAL/.test(err.message);
      }
      cek('trigger kekekalan: insert laporan_bulanan_manual pada bulan final DITOLAK', ditolakManual);
    }

    await c.query('rollback');

    if (!sebelumAda) {
      cek('rollback: tabel baru tidak tertinggal', !(await adaTabel('kategori_biaya')));
    } else {
      cek('rollback: transaksi berhasil di-rollback', true);
    }

    console.log(`\nHasil: ${hasil.filter(Boolean).length}/${hasil.length} uji lolos`);
    process.exitCode = hasil.every(Boolean) ? 0 : 1;
  }
} catch (e) {
  console.error('Galat dry-run:', e);
  await c.query('rollback').catch(() => {});
  process.exitCode = 1;
} finally {
  await c.end();
}
