import { formatRupiah } from './rupiah';
import { tanggalIndonesiaDariYmd } from './tanggal';

/**
 * Kontrol Harian (7 Oktober 2026, docs/KONTROL-DAN-LABA-RUGI-DESIGN-2026-10.md §2) --
 * bagian MURNI di sistem laporan: menggabungkan data POS (selisih stok, uang sistem,
 * dari pos-fnb /api/integrasi/kontrol-harian), uang masuk (isian cash/qris/bank di
 * Laporan Harian Kontrol F&B Ita, fungsi kontrol_harian_uang), dan catatan Ita,
 * menjadi status per outlet + teks WhatsApp format pemilik.
 *
 * Status "OK" HANYA kalau datanya lengkap (shift, opname awal & akhir, resep semua
 * produk terjual, uang masuk terisi) DAN tidak ada selisih di atas ambang. Kalau
 * ada yang kurang: "Data belum lengkap" + daftar yang kurang -- tidak pernah OK.
 */

export type BahanPos = {
  ingredientId: string;
  nama: string;
  satuan: string;
  awal: string;
  masuk: string;
  keluar: string;
  teoretis: string;
  akhir: string;
  aktual: string;
  selisih: string;
  hargaRata: string | null;
  nilaiSelisih: string | null;
  diResep: boolean;
  melewatiAmbang: boolean;
};

export type OutletPos = {
  posOutletId: string;
  nama: string;
  tanggal: string;
  ambang: { persen: string; nilai: string; toleransiUang: string };
  penjualan: { jumlahOrder: number; bersih: string; refund: string; uangSistem: string; perMetode: { metode: 'qris' | 'transfer' | 'cash' | 'lain'; jumlah: string }[] };
  pic: string[];
  opname: { awal: 'buka' | 'tutup_kemarin' | null; akhir: boolean };
  bahan: BahanPos[];
  produkTanpaResep: { nama: string; qty: string }[];
  stok: { status: 'ok' | 'selisih' | 'belum_lengkap'; kurang: string[]; tanpaHarga: string[] };
};

export type UangOutlet = {
  outlet_id: string;
  outlet_nama: string;
  pos_outlet_id: string;
  status_laporan: string | null;
  cash: number | null;
  qris: number | null;
  bank: number | null;
};

export type CatatanKontrol = { penyebab: string; tindakan: string; diubah_pada: string } | null;

export type StatusKontrol = 'OK' | 'Selisih' | 'Data belum lengkap';

export type BarisKontrol = {
  outletId: string;
  outletNama: string;
  pos: OutletPos | null;
  uang: { masuk: number | null; sistem: number | null; selisih: number | null; melewatiToleransi: boolean; perMetode: { cash: number | null; qris: number | null; bank: number | null } };
  status: StatusKontrol;
  kurang: string[];
  catatan: CatatanKontrol;
  /** Status Selisih tapi penyebab/tindakan belum ditulis. */
  perluCatatan: boolean;
};

const angka = (s: string | null | undefined) => (s === null || s === undefined || s === '' ? null : Number(s));

/**
 * adaPenugasan (migrasi 0077): false = outlet ini tidak punya penugasan Kontrol F&B, jadi laporan
 * uang masuk memang tidak mungkin ada -- pesannya menyebut penyebab itu, bukan "belum diisi".
 */
export const PESAN_TANPA_PENUGASAN = 'Uang masuk belum bisa diisi karena belum ada penugasan Kontrol F&B untuk outlet ini (Admin: tambah penugasan kontrol_fnb)';

export function gabungKontrol(pos: OutletPos | null, uang: UangOutlet, catatan: CatatanKontrol, posGalat: string | null = null, adaPenugasan = true): BarisKontrol {
  const kurang: string[] = [];
  if (!pos) kurang.push(posGalat ? `Data POS tidak tersedia: ${posGalat}` : 'Outlet ini tidak ada di data POS');
  else kurang.push(...pos.stok.kurang);

  const nilaiUang = [uang.cash, uang.qris, uang.bank];
  let masuk: number | null = null;
  if (uang.status_laporan === null && !adaPenugasan) kurang.push(PESAN_TANPA_PENUGASAN);
  else if (uang.status_laporan === null) kurang.push('Uang masuk belum diisi: Laporan Harian Kontrol F&B tanggal ini belum ada');
  else if (uang.status_laporan === 'draft') kurang.push('Laporan Harian Kontrol F&B tanggal ini masih draf (uang masuk belum final)');
  else if (nilaiUang.every((n) => n === null)) kurang.push('Uang masuk (Cash/QRIS/Bank) kosong di Laporan Harian Kontrol F&B');
  else masuk = nilaiUang.reduce<number>((t, n) => t + (n ?? 0), 0);

  const sistem = pos ? angka(pos.penjualan.uangSistem) : null;
  const selisih = masuk !== null && sistem !== null ? masuk - sistem : null;
  const toleransi = pos ? Number(pos.ambang.toleransiUang) || 0 : 0;
  const melewatiToleransi = selisih !== null && Math.abs(selisih) > toleransi;

  const status: StatusKontrol = kurang.length ? 'Data belum lengkap' : pos!.stok.status === 'selisih' || melewatiToleransi ? 'Selisih' : 'OK';
  return {
    outletId: uang.outlet_id,
    outletNama: uang.outlet_nama,
    pos,
    uang: { masuk, sistem, selisih, melewatiToleransi, perMetode: { cash: uang.cash, qris: uang.qris, bank: uang.bank } },
    status,
    kurang,
    catatan,
    perluCatatan: status === 'Selisih' && !(catatan?.penyebab.trim() && catatan?.tindakan.trim()),
  };
}

const LABEL_METODE: Record<string, string> = { qris: 'QRIS', transfer: 'Transfer', cash: 'Tunai', lain: 'Lainnya' };

function bertanda(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function rapi(s: string): string {
  const n = Number(s);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

/** Teks WhatsApp format pemilik: per outlet Outlet/Tanggal/PIC, stok per bahan, penjualan vs uang, status, penyebab, tindakan. */
export function teksOutlet(b: BarisKontrol, tanggal: string): string {
  const baris: string[] = [];
  baris.push(`*Outlet:* ${b.outletNama}`);
  baris.push(`*Tanggal:* ${tanggalIndonesiaDariYmd(tanggal)}`);
  baris.push(`*PIC:* ${b.pos?.pic.length ? b.pos.pic.join(', ') : '-'}`);
  if (b.pos) {
    const metode = b.pos.penjualan.perMetode.filter((m) => Number(m.jumlah) !== 0).map((m) => `${LABEL_METODE[m.metode] ?? m.metode} ${formatRupiah(Number(m.jumlah))}`);
    baris.push(`Penjualan sistem: ${formatRupiah(Number(b.pos.penjualan.uangSistem))} (${b.pos.penjualan.jumlahOrder} transaksi${metode.length ? `; ${metode.join(', ')}` : ''})`);
  }
  baris.push(`Uang masuk: ${b.uang.masuk === null ? 'belum diisi' : formatRupiah(b.uang.masuk)}`);
  if (b.uang.selisih !== null) baris.push(`Selisih uang: ${b.uang.selisih === 0 ? 'Rp0' : `${b.uang.selisih > 0 ? '+' : '-'}${formatRupiah(Math.abs(b.uang.selisih))}`}`);
  if (b.pos?.bahan.length) {
    baris.push('Stok (awal / masuk / terjual / sisa / selisih):');
    for (const k of b.pos.bahan) {
      const tanda = k.melewatiAmbang ? ' (!)' : '';
      const resep = k.diResep ? '' : ' -- tidak ada di resep';
      baris.push(`- ${k.nama} (${k.satuan}): ${rapi(k.awal)} / ${rapi(k.masuk)} / ${rapi(k.teoretis)} / ${rapi(k.akhir)} / ${bertanda(Number(rapi(k.selisih)))}${tanda}${resep}`);
    }
  }
  baris.push(`*Status:* ${b.status}`);
  if (b.kurang.length) baris.push(`Kurang: ${b.kurang.join('; ')}`);
  if (b.catatan?.penyebab.trim()) baris.push(`Penyebab: ${b.catatan.penyebab.trim()}`);
  if (b.catatan?.tindakan.trim()) baris.push(`Tindakan: ${b.catatan.tindakan.trim()}`);
  return baris.join('\n');
}

export function teksWhatsApp(tanggal: string, semua: BarisKontrol[]): string {
  return [`*Laporan Kontrol Harian* -- ${tanggalIndonesiaDariYmd(tanggal)}`, ...semua.map((b) => teksOutlet(b, tanggal))].join('\n\n');
}

/** Tautan wa.me tanpa nomor: WhatsApp membuka pemilih kontak dengan teks terisi (pola tautan laporan shift POS). */
export function tautanWhatsApp(teks: string): string {
  return `https://wa.me/?text=${encodeURIComponent(teks)}`;
}
