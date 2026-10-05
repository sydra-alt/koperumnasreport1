// Uji murni Nilai Aset Persediaan (lib/asetPersediaan.ts). Jalankan: npx tsx scripts/uji-aset-persediaan.mts
// Gerbang hak akses diuji di scripts/dry-run-0076.mjs (rollback); agregasi diuji di pos-fnb
// (src/lib/integrasi/__tests__/aset-persediaan.test.ts).
import { bulanValid, keteranganHpp, keteranganNilai, namaBulan } from '../lib/asetPersediaan';

const hasil: boolean[] = [];
const cek = (n: string, ok: boolean, d?: unknown) => { hasil.push(ok); console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${ok ? '' : `  (${JSON.stringify(d)})`}`); };

cek('bulan berjalan valid', bulanValid('2026-10', '2026-10-05'));
cek('bulan lalu valid (lintas tahun)', bulanValid('2025-12', '2026-01-01'));
cek('bulan depan DITOLAK', !bulanValid('2026-11', '2026-10-31'));
for (const b of ['2026-13', '2026-1', '2026-10-01', '', "2026-10'; drop"]) cek(`format salah DITOLAK: ${JSON.stringify(b)}`, !bulanValid(b, '2026-10-05'));
cek('namaBulan', namaBulan('2026-10') === 'Oktober 2026' && namaBulan('2027-01') === 'Januari 2027');

const hLengkap = keteranganHpp({ jumlahPenjualan: 12, penjualanHppBelumLengkap: 0 });
cek('HPP: semua penjualan lengkap -> lengkap', hLengkap.lengkap && /12 penjualan/.test(hLengkap.teks), hLengkap);
const hBelum = keteranganHpp({ jumlahPenjualan: 12, penjualanHppBelumLengkap: 3 });
cek('HPP: ada penjualan belum lengkap -> TIDAK lengkap, disebut batas bawah', !hBelum.lengkap && /3 dari 12/.test(hBelum.teks) && /batas bawah/.test(hBelum.teks), hBelum);
cek('HPP: tanpa penjualan -> dikatakan tidak ada penjualan (bukan "lengkap Rp0")', /Belum ada penjualan/.test(keteranganHpp({ jumlahPenjualan: 0, penjualanHppBelumLengkap: 0 }).teks));

cek('Nilai: tanpa pengecualian -> lengkap', keteranganNilai({ jumlahTanpaHarga: 0, jumlahStokMinus: 0 }).lengkap);
const nTanpa = keteranganNilai({ jumlahTanpaHarga: 2, jumlahStokMinus: 0 });
cek('Nilai: ada bahan tanpa harga -> TIDAK lengkap, "bukan Rp0"', !nTanpa.lengkap && /2 bahan/.test(nTanpa.teks) && /bukan Rp0/.test(nTanpa.teks), nTanpa);
const nMinus = keteranganNilai({ jumlahTanpaHarga: 0, jumlahStokMinus: 1 });
cek('Nilai: ada stok minus -> TIDAK lengkap', !nMinus.lengkap && /minus/.test(nMinus.teks), nMinus);

console.log(`${hasil.filter(Boolean).length}/${hasil.length} lolos`);
process.exitCode = hasil.every(Boolean) ? 0 : 1;
