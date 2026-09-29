#!/usr/bin/env -S npx tsx
// Uji cari/saring/urut tabel asisten (29 September 2026) -- murni. Fungsi
// yang sama dipakai layar dan /api/ai/ekspor.
//
// Jalankan: npx tsx scripts/uji-tabel-saring.mts

import { keteranganSaringan, pilihanOutlet, saringanDariQuery, saringTabel, tabelKeTsv, type TabelAi } from '../lib/ai/tabel';

const hasil: { nama: string; lolos: boolean; detail?: unknown }[] = [];
const cek = (nama: string, lolos: boolean, detail?: unknown) => hasil.push({ nama, lolos, detail });

const T: TabelAi = {
  judul: 'Stok bahan',
  kolom: [
    { key: 'outlet', label: 'Outlet', jenis: 'teks' },
    { key: 'bahan', label: 'Bahan', jenis: 'teks' },
    { key: 'stok', label: 'Stok', jenis: 'angka' },
    { key: 'harga', label: 'Harga', jenis: 'rupiah' },
  ],
  baris: [
    { outlet: 'Indokopi Jatinegara', bahan: 'Gula Aren', stok: '1448.0000', harga: 20 },
    { outlet: 'Indokopi Jatinegara', bahan: 'Susu UHT', stok: '10', harga: 18000 },
    { outlet: 'Indosteak Cempaka Putih', bahan: 'Beras', stok: '5', harga: null },
    { outlet: 'Indokopi Jatinegara', bahan: 'Gula Pasir', stok: null, harga: 15000 },
  ],
  totalBaris: 4,
};

cek('pilihanOutlet: nilai unik, urut abjad', JSON.stringify(pilihanOutlet(T)) === JSON.stringify(['Indokopi Jatinegara', 'Indosteak Cempaka Putih']), pilihanOutlet(T));
cek('pilihanOutlet: tabel tanpa kolom outlet -> kosong', pilihanOutlet({ ...T, kolom: T.kolom.slice(1) }).length === 0);
cek('cari: tidak peka huruf besar, di semua kolom', saringTabel(T, { cari: 'GULA' }).map((b) => b.bahan).join() === 'Gula Aren,Gula Pasir');
cek('cari angka berformat (18.000) ikut ketemu', saringTabel(T, { cari: '18.000' }).map((b) => b.bahan).join() === 'Susu UHT', saringTabel(T, { cari: '18.000' }));
cek('saring outlet', saringTabel(T, { outlet: 'Indosteak Cempaka Putih' }).map((b) => b.bahan).join() === 'Beras');
cek('urut angka naik (string angka dibaca angka), kosong di bawah', saringTabel(T, { urut: 'stok', arah: 'naik' }).map((b) => b.bahan).join() === 'Beras,Susu UHT,Gula Aren,Gula Pasir', saringTabel(T, { urut: 'stok' }).map((b) => b.bahan));
cek('urut turun, kosong TETAP di bawah', saringTabel(T, { urut: 'harga', arah: 'turun' }).map((b) => b.bahan).join() === 'Susu UHT,Gula Pasir,Gula Aren,Beras');
cek('urut teks', saringTabel(T, { urut: 'bahan', arah: 'naik' }).map((b) => b.bahan).join() === 'Beras,Gula Aren,Gula Pasir,Susu UHT');
cek('gabungan cari + outlet + urut', saringTabel(T, { cari: 'gula', outlet: 'Indokopi Jatinegara', urut: 'bahan', arah: 'turun' }).map((b) => b.bahan).join() === 'Gula Pasir,Gula Aren');
cek(
  'keterangan saringan untuk file Excel',
  keteranganSaringan(T, { cari: 'gula', outlet: 'Indokopi Jatinegara', urut: 'stok', arah: 'turun' }) === 'cari "gula"; outlet Indokopi Jatinegara; urut Stok (turun)',
  keteranganSaringan(T, { cari: 'gula', outlet: 'Indokopi Jatinegara', urut: 'stok', arah: 'turun' }),
);
cek('tanpa saringan -> keterangan null', keteranganSaringan(T, {}) === null);
const q = saringanDariQuery(T, new URLSearchParams({ cari: 'x'.repeat(300), urut: 'kolom_palsu', arah: 'turun', outlet: 'A' }));
cek('query ekspor: cari dibatasi 100, kolom urut yang tidak ada diabaikan', q.cari?.length === 100 && q.urut === undefined && q.outlet === 'A', q);
cek('Salin (TSV) memakai baris tersaring', tabelKeTsv(T, saringTabel(T, { cari: 'beras' })).split('\n').length === 2);

let gagal = 0;
for (const h of hasil) {
  console.log(`${h.lolos ? 'LOLOS' : 'GAGAL'}  ${h.nama}`);
  if (!h.lolos) {
    gagal++;
    console.log('       ', JSON.stringify(h.detail));
  }
}
console.log(`${hasil.length - gagal}/${hasil.length} lolos.`);
if (gagal > 0) process.exit(1);
