// Uji murni Kontrol Harian (lib/kontrolHarian.ts). Jalankan: npx tsx scripts/uji-kontrol-harian.mts
import { gabungKontrol, teksWhatsApp, tautanWhatsApp, type OutletPos, type UangOutlet } from '../lib/kontrolHarian';

const hasil: boolean[] = [];
const cek = (n: string, ok: boolean, d?: unknown) => { hasil.push(ok); console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${ok ? '' : `  (${JSON.stringify(d)})`}`); };

const pos = (ubah: Partial<OutletPos> = {}): OutletPos => ({
  posOutletId: 'p1', nama: 'Indokopi Lite Kemayoran', tanggal: '2026-10-05',
  ambang: { persen: '3', nilai: '50000', toleransiUang: '0' },
  penjualan: { jumlahOrder: 12, bersih: '250000', refund: '0', uangSistem: '250000', perMetode: [{ metode: 'qris', jumlah: '200000' }, { metode: 'transfer', jumlah: '50000' }] },
  pic: ['Fadil'], opname: { awal: 'buka', akhir: true },
  bahan: [{ ingredientId: 'k', nama: 'Kopi bubuk', satuan: 'gram', awal: '1000', masuk: '500', keluar: '50', teoretis: '400', akhir: '1040', aktual: '410', selisih: '10', hargaRata: '10', nilaiSelisih: '100', diResep: true, melewatiAmbang: false }],
  produkTanpaResep: [], stok: { status: 'ok', kurang: [], tanpaHarga: [] }, ...ubah,
});
const uang = (ubah: Partial<UangOutlet> = {}): UangOutlet => ({ outlet_id: 'r1', outlet_nama: 'Indokopi Lite Kemayoran', pos_outlet_id: 'p1', status_laporan: 'terkirim', cash: 0, qris: 200000, bank: 50000, ...ubah });

const ok = gabungKontrol(pos(), uang(), null);
cek('lengkap, stok OK, uang cocok -> OK', ok.status === 'OK' && ok.uang.selisih === 0 && ok.kurang.length === 0, ok);

const selisihUang = gabungKontrol(pos(), uang({ bank: 40000 }), null);
cek('uang masuk kurang Rp10.000 (toleransi 0) -> Selisih + wajib catatan', selisihUang.status === 'Selisih' && selisihUang.uang.selisih === -10000 && selisihUang.perluCatatan, selisihUang);

const denganCatatan = gabungKontrol(pos(), uang({ bank: 40000 }), { penyebab: 'transfer belum masuk', tindakan: 'cek mutasi besok', diubah_pada: '' });
cek('Selisih + penyebab & tindakan terisi -> tidak perlu catatan lagi', denganCatatan.status === 'Selisih' && !denganCatatan.perluCatatan);

const stokSelisih = gabungKontrol(pos({ stok: { status: 'selisih', kurang: [], tanpaHarga: [] } }), uang(), null);
cek('selisih stok di atas ambang -> Selisih', stokSelisih.status === 'Selisih');

const tanpaLaporan = gabungKontrol(pos(), uang({ status_laporan: null, cash: null, qris: null, bank: null }), null);
cek('Laporan Kontrol F&B belum ada -> Data belum lengkap (bukan OK, bukan Rp0)', tanpaLaporan.status === 'Data belum lengkap' && tanpaLaporan.uang.masuk === null && /belum diisi/.test(tanpaLaporan.kurang.join()), tanpaLaporan);

const draf = gabungKontrol(pos(), uang({ status_laporan: 'draft' }), null);
cek('Laporan Kontrol F&B masih draf -> Data belum lengkap', draf.status === 'Data belum lengkap' && /draf/.test(draf.kurang.join()));

const kosong = gabungKontrol(pos(), uang({ cash: null, qris: null, bank: null }), null);
cek('uang masuk kosong di laporan -> Data belum lengkap', kosong.status === 'Data belum lengkap');

const posKurang = gabungKontrol(pos({ stok: { status: 'belum_lengkap', kurang: ['Tidak ada opname tutup -- stok akhir tidak diketahui'], tanpaHarga: [] } }), uang(), null);
cek('POS: opname tutup tidak ada -> Data belum lengkap dengan alasannya', posKurang.status === 'Data belum lengkap' && /opname tutup/.test(posKurang.kurang.join()));

const posMati = gabungKontrol(null, uang(), null, 'POS menjawab HTTP 503.');
cek('POS gagal dihubungi -> Data belum lengkap, alasan disebut', posMati.status === 'Data belum lengkap' && /HTTP 503/.test(posMati.kurang.join()));

const beras = pos({
  bahan: [{ ingredientId: 'b', nama: 'Beras', satuan: 'gram', awal: '5000', masuk: '0', keluar: '0', teoretis: '0', akhir: '3000', aktual: '2000', selisih: '2000', hargaRata: '15', nilaiSelisih: '30000', diResep: false, melewatiAmbang: true }],
  stok: { status: 'selisih', kurang: [], tanpaHarga: [] },
});
const teks = teksWhatsApp('2026-10-05', [gabungKontrol(beras, uang(), { penyebab: 'beras belum di resep', tindakan: 'Ita isi resep nasi', diubah_pada: '' })]);
cek('teks WhatsApp: outlet, tanggal, PIC, stok per bahan, uang, status, penyebab, tindakan', ['*Outlet:* Indokopi Lite Kemayoran', '*PIC:* Fadil', 'Beras (gram): 5000 / 0 / 0 / 3000 / +2000 (!) -- tidak ada di resep', 'Uang masuk: Rp', '*Status:* Selisih', 'Penyebab: beras belum di resep', 'Tindakan: Ita isi resep nasi', 'Senin, 5 Oktober 2026'].every((s) => teks.includes(s)), teks);
cek('tautan wa.me tanpa nomor, teks ter-encode', tautanWhatsApp('a b').startsWith('https://wa.me/?text=a%20b'));

console.log(`${hasil.filter(Boolean).length}/${hasil.length} lolos`);
process.exit(hasil.every(Boolean) ? 0 : 1);
