/**
 * Nilai Aset Persediaan (Pusat fase B, 8 Oktober 2026) -- bentuk data dari pos-fnb
 * /api/integrasi/aset-persediaan (semua agregasi di SQL pos-fnb) + aturan kecil tampilan.
 * Rancangan: docs/KONTROL-DAN-LABA-RUGI-DESIGN-2026-10.md §4a.
 */

export type BahanPengecualian = { bahanId: string; nama: string; satuan: string; qty: string };
export type LokasiAset = {
  posOutletId: string;
  nama: string;
  pusat: boolean;
  nilai: number;
  jumlahBahanBernilai: number;
  tanpaHarga: BahanPengecualian[];
  stokMinus: BahanPengecualian[];
};
export type HppLokasi = { posOutletId: string; nama: string; hpp: number; jumlahPenjualan: number; penjualanHppBelumLengkap: number };
export type AsetPersediaan = {
  dibuatPada: string;
  lokasi: LokasiAset[];
  total: { nilai: number; jumlahTanpaHarga: number; jumlahStokMinus: number };
  hpp: { bulan: string; perLokasi: HppLokasi[]; total: { hpp: number; jumlahPenjualan: number; penjualanHppBelumLengkap: number } };
};

const BULAN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** yyyy-MM valid dan tidak setelah bulan berjalan (tanggal WIB yyyy-MM-dd). */
export function bulanValid(bulan: string, hariIniWIB: string): boolean {
  return BULAN.test(bulan) && bulan <= hariIniWIB.slice(0, 7);
}

/** "Oktober 2026" dari "2026-10". */
export function namaBulan(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number);
  const nama = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${nama[(m ?? 1) - 1]} ${y}`;
}

/**
 * Kalimat status HPP bulan. HPP dengan penjualan yang biayanya belum lengkap adalah BATAS BAWAH,
 * bukan angka final -- tidak pernah disajikan seolah lengkap.
 */
export function keteranganHpp(t: { jumlahPenjualan: number; penjualanHppBelumLengkap: number }): { lengkap: boolean; teks: string } {
  if (t.jumlahPenjualan === 0) return { lengkap: true, teks: 'Belum ada penjualan di bulan ini.' };
  if (t.penjualanHppBelumLengkap === 0) return { lengkap: true, teks: `Semua ${t.jumlahPenjualan} penjualan punya HPP lengkap.` };
  return {
    lengkap: false,
    teks: `${t.penjualanHppBelumLengkap} dari ${t.jumlahPenjualan} penjualan HPP-nya belum lengkap (produk tanpa resep atau bahan tanpa harga) -- angka HPP ini batas bawah, bukan angka final.`,
  };
}

/** Kalimat status nilai persediaan: tidak pernah "lengkap" kalau ada stok tanpa harga atau stok minus. */
export function keteranganNilai(t: { jumlahTanpaHarga: number; jumlahStokMinus: number }): { lengkap: boolean; teks: string } {
  const bagian: string[] = [];
  if (t.jumlahTanpaHarga > 0) bagian.push(`${t.jumlahTanpaHarga} bahan ada stoknya tapi belum berharga (tidak dinilai, bukan Rp0)`);
  if (t.jumlahStokMinus > 0) bagian.push(`${t.jumlahStokMinus} bahan stoknya minus (tidak mengurangi nilai)`);
  return bagian.length === 0
    ? { lengkap: true, teks: 'Semua stok yang ada sudah berharga.' }
    : { lengkap: false, teks: `${bagian.join('; ')} -- lihat daftar di tiap lokasi.` };
}
