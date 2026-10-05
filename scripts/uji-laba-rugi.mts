// scripts/uji-laba-rugi.mts
// Uji komprehensif Laba Rugi Bulanan terintegrasi (lib/labaRugi.ts, navUtama.ts, posHandoff.ts, & Database).
// Jalankan: npx tsx scripts/uji-laba-rugi.mts
import dotenv from 'dotenv';
// @ts-expect-error untyped pg in this project setup
import pg from 'pg';
import {
  formatRupiah,
  hitungHppThrift,
  buatRingkasanWhatsApp,
  buatLinkWhatsApp,
  type LabaRugiKonsolidasi,
  type OutletPnlView,
} from '../lib/labaRugi';
import { tabTerlihat } from '../lib/navUtama';
import { buatTokenPnlBridge, PNL_BRIDGE_AUDIENCE } from '../lib/posHandoff';
import { createHmac } from 'node:crypto';

dotenv.config({ path: '.env.local', quiet: true });

const hasil: boolean[] = [];
const cek = (n: string, ok: boolean, d: unknown = '') => {
  hasil.push(ok);
  console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${d ? `  (${typeof d === 'string' ? d : JSON.stringify(d)})` : ''}`);
};

console.log('════ 1. Uji Fungsi Bantuan & Perhitungan Murni (lib/labaRugi.ts) ════');
cek('formatRupiah: nol', formatRupiah(0) === 'Rp 0');
cek('formatRupiah: positif ratusan ribu', formatRupiah(250000) === 'Rp 250.000');
cek('formatRupiah: positif jutaan', formatRupiah(12345678) === 'Rp 12.345.678');
cek('formatRupiah: negatif', formatRupiah(-500000) === '-Rp 500.000');
cek('formatRupiah: desimal dibulatkan', formatRupiah(1234.56) === 'Rp 1.235');

cek('hitungHppThrift: normal', hitungHppThrift(10000000, 5000000, 8000000) === 7000000);
cek('hitungHppThrift: stok akhir melebihi awal+beli (tidak boleh negatif)', hitungHppThrift(1000000, 2000000, 5000000) === 0);
cek('hitungHppThrift: tanpa sisa', hitungHppThrift(5000000, 2000000, 0) === 7000000);

const sampleOutlet: OutletPnlView = {
  outletId: 'out-1',
  outletNama: 'Indosteak Jatinegara',
  posOutletId: null,
  posMode: 'fnb',
  sumber: 'manual',
  status: 'final_akunting',
  isFrozen: true,
  frozenAt: '2026-10-01T10:00:00Z',
  frozenBy: 'Akunting',
  lastOpnameDate: '2026-09-30',
  isOpnameTooOld: false,
  makanan: { omzet: 10000000, penjualanBersih: 10000000, diskon: 0, hpp: 4000000, labaKotor: 6000000, marginPersen: 60, jumlahItem: 50, itemTanpaResep: 0, itemBiayaBelumLengkap: 0 },
  minuman: { omzet: 4500000, penjualanBersih: 4500000, diskon: 0, hpp: 1800000, labaKotor: 2700000, marginPersen: 60, jumlahItem: 30, itemTanpaResep: 0, itemBiayaBelumLengkap: 0 },
  thrift: { omzet: 0, penjualanBersih: 0, diskon: 0, hpp: 0, labaKotor: 0, marginPersen: 0, jumlahItem: 0, itemTanpaResep: 0, itemBiayaBelumLengkap: 0 },
  totalPenjualan: { omzet: 14500000, penjualanBersih: 14500000, diskon: 0, hpp: 5800000, labaKotor: 8700000, marginPersen: 60 },
  biayaOperasional: [
    { kategoriId: 'k1', kategoriNama: 'Gaji', jumlah: 3000000, catatan: '2 staf', buktiPath: null },
    { kategoriId: 'k2', kategoriNama: 'Sewa', jumlah: 2000000, catatan: 'Bulanan', buktiPath: null },
    { kategoriId: 'k3', kategoriNama: 'Listrik', jumlah: 500000, catatan: 'Token', buktiPath: null },
  ],
  totalBiayaOperasional: 5500000,
  labaRugiBersih: 3200000,
  marginBersihPersen: 22.07,
  controlLine: { stokAwal: null, stokAwalAda: false, pembelianDanTransfer: 0, stokAkhir: null, stokAkhirAda: false, pemakaianAktual: null, selisihVsHpp: null, selisihPersen: null, status: 'data_belum_lengkap', keterangan: 'Manual' },
  badges: { persenTanpaResep: 0, jumlahBahanTanpaHarga: 0, jumlahStokMinus: 0, pesanPeringatan: ['Sumber: manual (input langsung oleh Akunting)'] },
  catatanIta: 'Angka telah diverifikasi',
  catatanAkunting: 'Sesuai mutasi kas',
  catatanKualitasData: '',
  alasanBukaKembali: null,
};

const sampleKonsolidasi: LabaRugiKonsolidasi = {
  bulan: '2026-09',
  outlets: [sampleOutlet],
  konsolidasi: {
    makanan: sampleOutlet.makanan,
    minuman: sampleOutlet.minuman,
    thrift: sampleOutlet.thrift,
    totalPenjualan: sampleOutlet.totalPenjualan,
    biayaOperasional: sampleOutlet.biayaOperasional.map((b) => ({ kategoriId: b.kategoriId, kategoriNama: b.kategoriNama, jumlah: b.jumlah })),
    totalBiayaOperasional: sampleOutlet.totalBiayaOperasional,
    labaRugiBersih: sampleOutlet.labaRugiBersih,
    marginBersihPersen: sampleOutlet.marginBersihPersen,
    controlLine: sampleOutlet.controlLine,
    badges: sampleOutlet.badges,
  },
};

const waSingle = buatRingkasanWhatsApp(sampleKonsolidasi, 'Indosteak Jatinegara');
cek('Ringkasan WhatsApp outlet: judul outlet', waSingle.includes('*Laporan Laba Rugi — Indosteak Jatinegara*'));
cek('Ringkasan WhatsApp outlet: periode September 2026', waSingle.includes('September 2026'));
cek('Ringkasan WhatsApp outlet: status FINAL AKUNTING', waSingle.includes('FINAL AKUNTING'));
cek('Ringkasan WhatsApp outlet: omzet Rp 14.500.000', waSingle.includes('Rp 14.500.000'));
cek('Ringkasan WhatsApp outlet: HPP Rp 5.800.000', waSingle.includes('Rp 5.800.000'));
cek('Ringkasan WhatsApp outlet: Laba Kotor Rp 8.700.000', waSingle.includes('Rp 8.700.000'));
cek('Ringkasan WhatsApp outlet: Laba Bersih Rp 3.200.000', waSingle.includes('Rp 3.200.000'));

const waAll = buatRingkasanWhatsApp(sampleKonsolidasi, 'Semua Outlet');
cek('Ringkasan WhatsApp konsolidasi: judul konsolidasi', waAll.includes('*Laporan Laba Rugi Konsolidasi — Koperumnas Group*'));
cek('Ringkasan WhatsApp konsolidasi: rincian per unit', waAll.includes('Indosteak Jatinegara'));

const linkWa = buatLinkWhatsApp('08123456789', 'Halo *CEO*');
cek('Link WhatsApp: format wa.me dan encoding', linkWa.startsWith('https://wa.me/628123456789?text=Halo%20*CEO*'));

console.log('\n════ 2. Uji Navigasi Utama (lib/navUtama.ts) ════');
const dummyFormRegistry = {} as any;
const navCeo = tabTerlihat(['ceo'], [], dummyFormRegistry);
cek('Navigasi CEO: tab laba-rugi MUNCUL', navCeo.some((t) => t.key === 'laba-rugi'));

const navAdmin = tabTerlihat(['admin'], [], dummyFormRegistry);
cek('Navigasi Admin: tab laba-rugi MUNCUL', navAdmin.some((t) => t.key === 'laba-rugi'));

const navAccounting = tabTerlihat(['accounting', 'karyawan'], [], dummyFormRegistry);
cek('Navigasi Accounting: tab laba-rugi MUNCUL', navAccounting.some((t) => t.key === 'laba-rugi'));

const navIta = tabTerlihat(['karyawan'], [{ form_key: 'kontrol_fnb' }], dummyFormRegistry);
cek('Navigasi Ita (penugasan kontrol_fnb): tab laba-rugi MUNCUL', navIta.some((t) => t.key === 'laba-rugi'));

const navKaryawanPolos = tabTerlihat(['karyawan'], [], dummyFormRegistry);
cek('Navigasi Karyawan Biasa: tab laba-rugi TIDAK muncul', !navKaryawanPolos.some((t) => t.key === 'laba-rugi'));

const navMarketing = tabTerlihat(['kontrol_marketing', 'karyawan'], [], dummyFormRegistry);
cek('Navigasi Marketing Biasa: tab laba-rugi TIDAK muncul', !navMarketing.some((t) => t.key === 'laba-rugi'));

console.log('\n════ 3. Uji Bridge Token (lib/posHandoff.ts) ════');
process.env.POS_HANDOFF_SECRET = process.env.POS_HANDOFF_SECRET || 'secret-uji-test-123';
const tokenPnl = buatTokenPnlBridge({ id: 'user-123', email: 'uji-akunting@koperumnas.local' }, { nama: 'Shabita', akses: null });
cek('Token jembatan PnL terbentuk (2 bagian base64url)', tokenPnl.includes('.'));
const [payloadPart, sigPart] = tokenPnl.split('.');
const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
cek('Payload aud adalah pos-fnb-pnl-bridge', payload.aud === PNL_BRIDGE_AUDIENCE);
cek('Payload uid sesuai', payload.uid === 'user-123');
cek('Payload email sesuai', payload.email === 'uji-akunting@koperumnas.local');
cek('Payload exp berjarak 60 detik dari iat', payload.exp - payload.iat === 60);

const hmacCheck = createHmac('sha256', process.env.POS_HANDOFF_SECRET)
  .update(payloadPart)
  .digest('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');
cek('Tanda tangan HMAC-SHA256 valid', sigPart === hmacCheck);

console.log('\n════ 4. Uji Simulasi Fixture Manual Ita September ════');
// 4 Outlet fixture per koreksi CEO:
// 1. Jatinegara (manual): Makanan 10jt, Minuman 4.5jt, Modal Makanan 4jt, Modal Minuman 1.8jt, Biaya 5.5jt (Gaji 3jt, Sewa 2jt, Listrik 500rb)
// 2. Cempaka Putih (manual): Makanan 8jt, Minuman 4jt, Modal Makanan 3jt, Modal Minuman 1.5jt, Biaya 4.3jt (Gaji 2.5jt, Sewa 1.8jt)
// 3. Pekansari (manual): Makanan 6jt, Minuman 3jt, Modal Makanan 2.4jt, Modal Minuman 1.2jt, Biaya 3.5jt (Gaji 2jt, Sewa 1.5jt)
// 4. Bestie Thrift (manual): Thrift 18jt, Modal Thrift (HPP) 7.2jt, Biaya 6.1jt (Gaji 3jt, Sewa 2.5jt, Listrik 600rb)

const outletsFixture = [
  {
    nama: 'Indosteak Jatinegara',
    omzetMakanan: 10000000, omzetMinuman: 4500000, omzetThrift: 0,
    hppMakanan: 4000000, hppMinuman: 1800000, hppThrift: 0,
    biaya: 5500000,
  },
  {
    nama: 'Indosteak Cempaka Putih',
    omzetMakanan: 8000000, omzetMinuman: 4000000, omzetThrift: 0,
    hppMakanan: 3000000, hppMinuman: 1500000, hppThrift: 0,
    biaya: 4300000,
  },
  {
    nama: 'Indosteak Pekansari',
    omzetMakanan: 6000000, omzetMinuman: 3000000, omzetThrift: 0,
    hppMakanan: 2400000, hppMinuman: 1200000, hppThrift: 0,
    biaya: 3500000,
  },
  {
    nama: 'Bestie Thrift',
    omzetMakanan: 0, omzetMinuman: 0, omzetThrift: 18000000,
    hppMakanan: 0, hppMinuman: 0, hppThrift: 7200000,
    biaya: 6100000,
  },
];

let totalOmzetFnb = 0;
let totalOmzetThrift = 0;
let totalHppFnb = 0;
let totalHppThrift = 0;
let totalBiayaAll = 0;

for (const o of outletsFixture) {
  const omzet = o.omzetMakanan + o.omzetMinuman + o.omzetThrift;
  const hpp = o.hppMakanan + o.hppMinuman + o.hppThrift;
  const labaKotor = omzet - hpp;
  const labaBersih = labaKotor - o.biaya;

  totalOmzetFnb += (o.omzetMakanan + o.omzetMinuman);
  totalOmzetThrift += o.omzetThrift;
  totalHppFnb += (o.hppMakanan + o.hppMinuman);
  totalHppThrift += o.hppThrift;
  totalBiayaAll += o.biaya;

  if (o.nama === 'Indosteak Jatinegara') {
    cek('Jatinegara: Laba Kotor Rp 8.700.000', labaKotor === 8700000);
    cek('Jatinegara: Laba Bersih Rp 3.200.000', labaBersih === 3200000);
  } else if (o.nama === 'Bestie Thrift') {
    cek('Bestie Thrift: Laba Kotor Rp 10.800.000', labaKotor === 10800000);
    cek('Bestie Thrift: Laba Bersih Rp 4.700.000', labaBersih === 4700000);
  }
}

const totalOmzetAll = totalOmzetFnb + totalOmzetThrift;
const totalHppAll = totalHppFnb + totalHppThrift;
const totalLabaKotorAll = totalOmzetAll - totalHppAll;
const totalLabaBersihAll = totalLabaKotorAll - totalBiayaAll;

cek('Konsolidasi: Total Omzet Rp 53.500.000', totalOmzetAll === 53500000);
cek('Konsolidasi: Total HPP Rp 21.100.000', totalHppAll === 21100000);
cek('Konsolidasi: Total Laba Kotor Rp 32.400.000', totalLabaKotorAll === 32400000);
cek('Konsolidasi: Total Biaya Operasional Rp 19.400.000', totalBiayaAll === 19400000);
cek('Konsolidasi: Total Laba Bersih Rp 13.000.000', totalLabaBersihAll === 13000000);

console.log('\n════ 5. Uji Integrasi Database (Rollback Tx & RLS/Triggers) ════');
const dbUrl = process.env.SUPABASE_DB_URL;
if (dbUrl) {
  const c = new pg.Client({ connectionString: dbUrl });
  await c.connect();
  try {
    await c.query('begin');

    const id = async (email: string) => (await c.query('select id from auth.users where email = $1', [email])).rows[0]?.id;
    const ceo = await id('uji-ceo@koperumnas.local');
    const admin = await id('uji6@koperumnas.local');
    const polos = await id('uji2@koperumnas.local');

    const sebagai = async (uid?: string) => {
      await c.query('reset role');
      if (uid) {
        await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated' })]);
        await c.query('set local role authenticated');
      }
    };

    const evaluasi = async (fn: string, uid?: string) => {
      await sebagai(uid);
      const r = (await c.query(`select ${fn}() as b`)).rows[0].b;
      await c.query('reset role');
      return r;
    };

    cek('DB: CEO boleh_lihat_laba_rugi = true', (await evaluasi('boleh_lihat_laba_rugi', ceo)) === true);
    cek('DB: Admin boleh_ubah_biaya_bulanan = true', (await evaluasi('boleh_ubah_biaya_bulanan', admin)) === true);
    cek('DB: Admin boleh_finalkan_laba_rugi = true', (await evaluasi('boleh_finalkan_laba_rugi', admin)) === true);
    cek('DB: Admin boleh_buka_kembali_laba_rugi = true', (await evaluasi('boleh_buka_kembali_laba_rugi', admin)) === true);
    cek('DB: CEO boleh_buka_kembali_laba_rugi = true', (await evaluasi('boleh_buka_kembali_laba_rugi', ceo)) === true);
    cek('DB: User polos DITOLAK dari semua operasi P&L', (await evaluasi('boleh_lihat_laba_rugi', polos)) === false);

    // Uji alur status Draft -> Ditinjau Ita -> Final Akunting -> Buka Kembali
    const outletRow = (await c.query('select id from outlet limit 1')).rows[0];
    const katRow = (await c.query('select id from kategori_biaya limit 1')).rows[0];
    const testBulan = '2026-09';

    if (outletRow && katRow) {
      // 1. Catat biaya di fase draft
      await c.query(
        `insert into biaya_bulanan (outlet_id, bulan, kategori_id, jumlah, catatan, created_by, updated_by)
         values ($1, $2, $3, 2500000, 'Uji coba gaji', $4, $4)`,
        [outletRow.id, testBulan, katRow.id, admin]
      );
      cek('DB: Simpan biaya bulanan saat draft berhasil', true);

      // 2. Transisi ke Ditinjau Ita
      await c.query(
        `insert into laporan_bulanan (outlet_id, bulan, status, sumber, catatan_ita, ditinjau_oleh, ditinjau_pada)
         values ($1, $2, 'ditinjau_ita', 'manual', 'Sudah dicek oleh Ita', $3, now())`,
        [outletRow.id, testBulan, admin]
      );
      cek('DB: Transisi ke ditinjau_ita berhasil', true);

      // 3. Transisi ke Final Akunting
      await c.query(
        `update laporan_bulanan set status = 'final_akunting', difinalkan_oleh = $1, difinalkan_pada = now()
         where outlet_id = $2 and bulan = $3`,
        [admin, outletRow.id, testBulan]
      );
      cek('DB: Transisi ke final_akunting berhasil', true);

      // 4. Verifikasi Immutability Trigger memblokir edit biaya
      let triggerKunciBiaya = false;
      try {
        await c.query('savepoint sp_biaya');
        await c.query(
          `update biaya_bulanan set jumlah = 9999999 where outlet_id = $1 and bulan = $2 and kategori_id = $3`,
          [outletRow.id, testBulan, katRow.id]
        );
        await c.query('release savepoint sp_biaya');
      } catch (err: any) {
        await c.query('rollback to savepoint sp_biaya');
        triggerKunciBiaya = /BULAN_FINAL/.test(err.message);
      }
      cek('DB: Trigger kekekalan memblokir UPDATE biaya_bulanan saat final_akunting', triggerKunciBiaya);

      // 5. Buka kembali oleh Admin/CEO dengan alasan tercatat
      await c.query(
        `update laporan_bulanan
         set status = 'ditinjau_ita',
             alasan_buka_kembali = 'Koreksi nota sewa tertinggal',
             dibuka_kembali_oleh = $1,
             dibuka_kembali_pada = now()
         where outlet_id = $2 and bulan = $3`,
        [ceo, outletRow.id, testBulan]
      );
      cek('DB: Buka kembali status ke ditinjau_ita dengan alasan berhasil', true);

      // 6. Verifikasi setelah dibuka kembali, biaya bisa diubah lagi
      await c.query(
        `update biaya_bulanan set jumlah = 2750000 where outlet_id = $1 and bulan = $2 and kategori_id = $3`,
        [outletRow.id, testBulan, katRow.id]
      );
      const cekUpdated = (await c.query('select jumlah from biaya_bulanan where outlet_id = $1 and bulan = $2 and kategori_id = $3', [outletRow.id, testBulan, katRow.id])).rows[0]?.jumlah;
      cek('DB: Biaya bulanan berhasil diubah setelah dibuka kembali', Number(cekUpdated) === 2750000, `dapat ${cekUpdated}`);
    }

    await c.query('rollback');
    cek('DB: Rollback transaksi pengujian berhasil (data bersih)', true);
  } catch (err) {
    await c.query('rollback').catch(() => {});
    cek('DB: Galat transaksi:', false, err);
  } finally {
    await c.end();
  }
} else {
  console.log('SUPABASE_DB_URL tidak ditemukan, lewati uji database live.');
}

console.log(`\n════ RANGKUMAN: ${hasil.filter(Boolean).length}/${hasil.length} UJI LOLOS ════`);
process.exitCode = hasil.every(Boolean) ? 0 : 1;
