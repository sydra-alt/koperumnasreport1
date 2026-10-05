/**
 * lib/labaRugi.ts — Laba Rugi Bulanan terintegrasi (Oktober 2026, koreksi CEO 5 Oktober 2026).
 * Struktur laporan keuangan owner (docs/KONTROL-DAN-LABA-RUGI-DESIGN-2026-10.md §3, §3a).
 * Menggabungkan omzet, HPP resep, baris kontrol dari pos-fnb dengan biaya operasional dari laporan.
 * CLAUDE.md #13 & #14: server menghitung angka utama (headline numbers).
 */

export type StatusLaporanBulanan = 'draft' | 'ditinjau_ita' | 'final_akunting';
export type SumberLaporan = 'pos' | 'manual';

export type KategoriBiaya = {
  id: string;
  nama: string;
  urutan: number;
  aktif: boolean;
};

export type BiayaBulananItem = {
  id: string;
  outletId: string;
  bulan: string;
  kategoriId: string;
  kategoriNama: string;
  jumlah: number; // Dalam satuan rupiah (integer)
  catatan: string;
  buktiPath: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
};

export type CategorySalesHpp = {
  omzet: number; // Gross / subtotal
  penjualanBersih: number;
  diskon: number;
  hpp: number; // Recipe COGS
  labaKotor: number;
  marginPersen: number;
  jumlahItem: number;
  itemTanpaResep: number;
  itemBiayaBelumLengkap: number;
};

export type ControlLineOpname = {
  stokAwal: number | null;
  stokAwalAda: boolean;
  pembelianDanTransfer: number;
  stokAkhir: number | null;
  stokAkhirAda: boolean;
  pemakaianAktual: number | null; // stokAwal + pembelianDanTransfer - stokAkhir
  selisihVsHpp: number | null; // pemakaianAktual - totalHpp
  selisihPersen: number | null;
  status: 'lengkap' | 'data_belum_lengkap';
  keterangan: string;
};

export type BadgesKualitas = {
  persenTanpaResep: number;
  jumlahBahanTanpaHarga: number;
  jumlahStokMinus: number;
  pesanPeringatan: string[];
};

export type OutletPnlView = {
  outletId: string;
  outletNama: string;
  posOutletId: string | null;
  posMode: 'fnb' | 'thrifting';
  sumber: SumberLaporan;
  status: StatusLaporanBulanan;
  isFrozen: boolean;
  frozenAt: string | null;
  frozenBy: string | null;
  lastOpnameDate: string | null;
  isOpnameTooOld: boolean;
  makanan: CategorySalesHpp;
  minuman: CategorySalesHpp;
  thrift: CategorySalesHpp;
  totalPenjualan: {
    omzet: number;
    penjualanBersih: number;
    diskon: number;
    hpp: number;
    labaKotor: number;
    marginPersen: number;
  };
  biayaOperasional: {
    kategoriId: string;
    kategoriNama: string;
    jumlah: number;
    catatan: string;
    buktiPath: string | null;
  }[];
  totalBiayaOperasional: number;
  labaRugiBersih: number; // Laba kotor - total biaya operasional
  marginBersihPersen: number;
  controlLine: ControlLineOpname;
  badges: BadgesKualitas;
  catatanIta: string;
  catatanAkunting: string;
  catatanKualitasData: string;
  alasanBukaKembali: string | null;
};

export type LabaRugiKonsolidasi = {
  bulan: string;
  outlets: OutletPnlView[];
  konsolidasi: {
    makanan: CategorySalesHpp;
    minuman: CategorySalesHpp;
    thrift: CategorySalesHpp;
    totalPenjualan: {
      omzet: number;
      penjualanBersih: number;
      diskon: number;
      hpp: number;
      labaKotor: number;
      marginPersen: number;
    };
    biayaOperasional: {
      kategoriId: string;
      kategoriNama: string;
      jumlah: number;
    }[];
    totalBiayaOperasional: number;
    labaRugiBersih: number;
    marginBersihPersen: number;
    controlLine: ControlLineOpname;
    badges: BadgesKualitas;
  };
};

/** Format integer rupiah: Rp 12.345.678 */
export function formatRupiah(n: number): string {
  const isNeg = n < 0;
  const abs = Math.abs(Math.round(n));
  const s = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNeg ? `-Rp ${s}` : `Rp ${s}`;
}

/** Hitung HPP Thrifting: stok awal + pembelian - stok akhir */
export function hitungHppThrift(stokAwal: number, pembelian: number, stokAkhir: number): number {
  return Math.max(0, stokAwal + pembelian - stokAkhir);
}

/**
 * Menyusun ringkasan teks WhatsApp untuk CEO (wa.me link).
 * Ringkas, lugas, angka utama jelas, format WhatsApp (*bold*).
 */
export function buatRingkasanWhatsApp(data: LabaRugiKonsolidasi, outletNama?: string): string {
  const b = data.bulan;
  const [y, m] = b.split('-').map(Number);
  const namaBulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ][(m ?? 1) - 1];

  if (outletNama && outletNama !== 'Semua Outlet') {
    const ot = data.outlets.find((o) => o.outletNama === outletNama);
    if (!ot) return '';
    return [
      `*Laporan Laba Rugi — ${ot.outletNama}*`,
      `Periode: ${namaBulan} ${y}`,
      `Status: *${ot.status === 'final_akunting' ? 'FINAL AKUNTING' : ot.status === 'ditinjau_ita' ? 'Ditinjau Ita' : 'Draft'}* (Sumber: ${ot.sumber.toUpperCase()})`,
      ``,
      `• *Omzet Bersih:* ${formatRupiah(ot.totalPenjualan.penjualanBersih)}`,
      `• *HPP (Modal):* ${formatRupiah(ot.totalPenjualan.hpp)}`,
      `• *Laba Kotor:* ${formatRupiah(ot.totalPenjualan.labaKotor)} (${ot.totalPenjualan.marginPersen.toFixed(1)}%)`,
      `• *Biaya Operasional:* ${formatRupiah(ot.totalBiayaOperasional)}`,
      `• *Laba/Rugi Bersih:* *${formatRupiah(ot.labaRugiBersih)}* (${ot.marginBersihPersen.toFixed(1)}%)`,
      ``,
      ...(ot.badges.pesanPeringatan.length > 0
        ? [`_Catatan Kualitas Data:_`, ...ot.badges.pesanPeringatan.map((p) => `⚠️ ${p}`), ``]
        : []),
      `Diperiksa melalui Sistem Laporan Koperumnas Group`,
    ].join('\n');
  }

  const k = data.konsolidasi;
  return [
    `*Laporan Laba Rugi Konsolidasi — Koperumnas Group*`,
    `Periode: ${namaBulan} ${y}`,
    `Jumlah Outlet: ${data.outlets.length} outlet`,
    ``,
    `• *Total Omzet Bersih:* ${formatRupiah(k.totalPenjualan.penjualanBersih)}`,
    `• *Total HPP (Modal):* ${formatRupiah(k.totalPenjualan.hpp)}`,
    `• *Total Laba Kotor:* ${formatRupiah(k.totalPenjualan.labaKotor)} (${k.totalPenjualan.marginPersen.toFixed(1)}%)`,
    `• *Total Biaya Operasional:* ${formatRupiah(k.totalBiayaOperasional)}`,
    `• *Laba/Rugi Bersih Konsolidasi:* *${formatRupiah(k.labaRugiBersih)}* (${k.marginBersihPersen.toFixed(1)}%)`,
    ``,
    `*Rincian Per Unit:*`,
    ...data.outlets.map(
      (o) => `  - ${o.outletNama}: Laba Kotor ${formatRupiah(o.totalPenjualan.labaKotor)} | Laba Bersih *${formatRupiah(o.labaRugiBersih)}* [${o.status.toUpperCase()}]`
    ),
    ``,
    ...(k.badges.pesanPeringatan.length > 0
      ? [`_Catatan Kualitas Data Konsolidasi:_`, ...k.badges.pesanPeringatan.map((p) => `⚠️ ${p}`), ``]
      : []),
    `Diperiksa melalui Sistem Laporan Koperumnas Group`,
  ].join('\n');
}

/** Buat link WhatsApp wa.me dengan teks ter-encode */
export function buatLinkWhatsApp(nomorHp: string, teks: string): string {
  const cleanPhone = nomorHp.replace(/[^0-9]/g, '');
  const phone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
  return `https://wa.me/${phone}?text=${encodeURIComponent(teks)}`;
}
