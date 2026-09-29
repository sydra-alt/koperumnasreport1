import type { SupabaseClient } from '@supabase/supabase-js';
import type { DeklarasiFungsi } from './gemini';
import type { KolomTabelAi, NilaiSel, TabelAi } from './tabel';
import { panggilAlatPos, type HasilPos } from './jembatanPos';
import type { AksesPos } from '../posHandoff';
import { PERIODE_RELATIF, periodeRelatifValid, rentangPeriode } from './periode';

/**
 * Daftar TETAP alat asisten AI (28 September 2026). Gemini cuma memilih nama
 * alat + argumen dari daftar ini; ia TIDAK PERNAH menulis SQL.
 *
 * - LOKAL: fungsi di database laporan (migrasi 0064), dipanggil lewat klien
 *   Supabase milik USER YANG BERTANYA -- RLS yang sama dengan layar biasa.
 * - POS: dijalankan pos-fnb lewat jembatan bertanda tangan
 *   (lib/ai/jembatanPos.ts), dengan cakupan outlet user pos-fnb yang
 *   dipetakan -- bukan dari argumen di sini.
 *
 * Nama alat yang tidak ada di daftar tidak pernah dijalankan.
 */

export const BARIS_UNTUK_MODEL = 60;
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Status yang dicatat di ai_panggilan_alat. ATURAN (CEO, 28 September 2026):
 * "tidak berhak" TIDAK PERNAH boleh terbaca sebagai "tidak ada data" -- itu
 * terbaca sebagai angka nol tentang bisnis, padahal itu fakta tentang izin.
 * - kosong: nol baris DAN penanya melihat semua (datanya memang tidak ada)
 * - kosong_dalam_hak: nol baris, tapi penanya cuma melihat sebagian
 * - tidak_berhak: peran penanya tidak boleh melihat data ini sama sekali
 * - outlet_di_luar_hak: outlet yang diminta tidak termasuk outlet yang boleh dilihat
 */
export type StatusAlat =
  | 'ok'
  | 'kosong'
  | 'kosong_dalam_hak'
  | 'tidak_berhak'
  | 'outlet_di_luar_hak'
  | 'tanpa_akses_pos'
  | 'ditolak'
  | 'argumen_salah'
  | 'galat';

/** Pesan baku ke model per status penolakan -- SATU tempat, dipakai alat lokal & POS. */
export const PESAN_STATUS = {
  tidak_berhak: 'Data ini TIDAK TERSEDIA untuk peran penanya. Katakan itu apa adanya; JANGAN bilang tidak ada data atau nol.',
  kosong_dalam_hak:
    'Tidak ada data DI DALAM HAK AKSES penanya. Data di luar haknya tidak ikut dihitung, jadi ini BUKAN berarti datanya nol. Sebutkan batas itu.',
  outlet_di_luar_hak:
    'Outlet yang diminta tidak termasuk outlet yang boleh dilihat penanya. Katakan itu; JANGAN bilang datanya nol atau tidak ada.',
  tanpa_akses_pos: 'Penanya tidak punya akses data POS (akun toko belum disiapkan). Katakan itu apa adanya; JANGAN bilang datanya nol.',
} as const;

export type HasilAlat = {
  untukModel: Record<string, unknown>;
  tabel: TabelAi[];
  /**
   * Kalimat yang WAJIB ditambahkan server ke jawaban apa adanya (bukan
   * diserahkan ke model) -- mis. outlet tanpa catatan stok, bahan tanpa stok
   * minimum. Koreksi CEO 29 September 2026: jangan pernah "semua outlet"
   * kalau sebagian outlet tidak punya data.
   */
  catatanWajib?: string[];
  catatan: { alat: string; argumen: Record<string, unknown>; sumber: 'lokal' | 'pos'; status: StatusAlat; jumlahBaris: number | null };
};

export type PanggilanAlat = { name: string; args: Record<string, unknown> };

type Baris = Record<string, NilaiSel>;

// ─── Deklarasi untuk Gemini ────────────────────────────────────────────────
const tgl = (keterangan: string) => ({
  type: 'STRING',
  description: `${keterangan} Format YYYY-MM-DD. HANYA untuk tanggal yang disebut eksplisit; untuk periode relatif pakai \`periode\`.`,
});
// `periode` (hari ini, minggu ini, ...) dihitung SERVER dari hari ini -- model
// tidak pernah menghitung tanggal relatif sendiri (koreksi CEO 29 September
// 2026: "minggu ini" sempat jadi 22-29 Sep, jendela 8 hari lintas dua minggu).
const rentang = {
  periode: {
    type: 'STRING',
    enum: [...PERIODE_RELATIF],
    description:
      'Periode relatif, WAJIB dipakai untuk "hari ini", "kemarin", "minggu ini", "minggu lalu", "bulan ini", "bulan lalu". Minggu = Senin s/d Minggu; minggu_ini = Senin minggu ini s/d hari ini; bulan_ini = tanggal 1 s/d hari ini.',
  },
  start_date: tgl('Tanggal awal (termasuk).'),
  end_date: tgl('Tanggal akhir (termasuk).'),
};
const outletOpsional = {
  type: 'STRING',
  description: 'Opsional. Nama atau potongan nama outlet. Kosongkan untuk semua outlet yang bisa dilihat penanya.',
};

export const DEKLARASI_ALAT: DeklarasiFungsi[] = [
  {
    name: 'status_laporan',
    description:
      'Status pengiriman laporan harian per orang per form dalam rentang tanggal (maks 31 hari): hari wajib, terkirim, terlambat, belum, dan tanggal yang belum dikirim.',
    parameters: { type: 'OBJECT', properties: rentang },
  },
  {
    name: 'presensi',
    description:
      'Ringkasan absensi per orang dalam rentang tanggal (maks 31 hari): hari absen masuk, hari terlambat, total menit terlambat, hari tanpa absen masuk (termasuk hari libur).',
    parameters: { type: 'OBJECT', properties: rentang },
  },
  {
    name: 'omzet_pos_harian',
    description:
      'Omzet harian dari POS per outlet (jumlah order, penjualan bersih, uang diterima, refund) beserta total per outlet dan total keseluruhan. Maks 92 hari.',
    parameters: { type: 'OBJECT', properties: { ...rentang, outlet: outletOpsional } },
  },
  {
    name: 'penjualan_per_item',
    description:
      'Detail penjualan POS satu baris per item terjual (tanggal, invoice, item, kategori, qty, diskon, modal, penjualan). Maks 92 hari; paling banyak 200 baris dikembalikan.',
    parameters: {
      type: 'OBJECT',
      properties: {
        ...rentang,
        outlet: outletOpsional,
        search: { type: 'STRING', description: 'Opsional. Cari nama item, kategori, atau nomor invoice.' },
      },
    },
  },
  {
    name: 'stok_bahan',
    description: 'Stok bahan SAAT INI per outlet (jumlah, satuan, stok minimum, apakah di bawah minimum).',
    parameters: {
      type: 'OBJECT',
      properties: { outlet: outletOpsional, ingredient: { type: 'STRING', description: 'Opsional. Potongan nama bahan.' } },
    },
  },
  {
    name: 'status_opname',
    description:
      'Outlet mana yang kurang opname harian (buka/tutup shift) pada satu tanggal, dan status opname mingguan untuk minggu tanggal itu.',
    parameters: { type: 'OBJECT', properties: { date: { type: 'STRING', description: 'Opsional, YYYY-MM-DD. Kosong = hari ini.' } } },
  },
  {
    name: 'cakupan_resep',
    description:
      'Bahan yang TIDAK dipakai resep mana pun (jadi TIDAK PERNAH terpotong oleh penjualan) dan produk yang tidak punya resep (penjualannya tidak memotong bahan apa pun), per outlet, dengan jumlahnya. Pakai untuk pertanyaan seperti "bahan yang belum masuk ke produk/resep sehingga tidak berkurang". Ini BUKAN soal bahan yang tidak terjual bulan ini -- untuk itu pakai penjualan_vs_stok.',
    parameters: { type: 'OBJECT', properties: { outlet: outletOpsional } },
  },
  {
    name: 'penjualan_vs_stok',
    description:
      'Perbandingan pemakaian bahan dari penjualan dengan pergerakan stok lain (waste, selisih opname, masuk, keluar lain) per bahan per outlet. Maks 92 hari. Diurutkan dari selisih opname terbesar.',
    parameters: { type: 'OBJECT', properties: { ...rentang, outlet: outletOpsional } },
  },
];

const NAMA_POS: Record<string, string> = {
  penjualan_per_item: 'sales_item_detail',
  stok_bahan: 'stock_levels',
  status_opname: 'opname_status',
  cakupan_resep: 'recipe_coverage',
  penjualan_vs_stok: 'sales_vs_stock',
};
const NAMA_LOKAL = new Set(['status_laporan', 'presensi', 'omzet_pos_harian']);

// ─── Kolom tabel ───────────────────────────────────────────────────────────
const k = (key: string, label: string, jenis: KolomTabelAi['jenis'] = 'teks'): KolomTabelAi => ({ key, label, jenis });

const KOLOM: Record<string, { judul: string; kolom: KolomTabelAi[] }> = {
  status_laporan: {
    judul: 'Status laporan',
    kolom: [
      k('pic_nama', 'Nama'), k('form_key', 'Form'), k('lingkup', 'Lokasi/Outlet'), k('hari_wajib', 'Hari wajib', 'angka'),
      k('hari_terkirim', 'Terkirim', 'angka'), k('hari_terlambat', 'Terlambat', 'angka'), k('hari_belum', 'Belum', 'angka'),
      k('tanggal_belum', 'Tanggal belum'),
    ],
  },
  presensi: {
    judul: 'Ringkasan presensi',
    kolom: [
      k('nama', 'Nama'), k('titik', 'Titik absen'), k('hari_absen_masuk', 'Hari absen masuk', 'angka'),
      k('hari_terlambat', 'Hari terlambat', 'angka'), k('total_menit_terlambat', 'Total menit terlambat', 'angka'),
      k('hari_tanpa_absen_masuk', 'Hari tanpa absen masuk', 'angka'),
    ],
  },
  omzet_pos_harian: {
    judul: 'Omzet POS harian',
    kolom: [
      k('outlet', 'Outlet'), k('tanggal', 'Tanggal'), k('jumlah_order', 'Order', 'angka'),
      k('penjualan_bersih', 'Penjualan bersih', 'rupiah'), k('uang_diterima', 'Uang diterima', 'rupiah'), k('refund', 'Refund', 'rupiah'),
    ],
  },
  penjualan_per_item: {
    judul: 'Penjualan per item',
    kolom: [
      k('tanggal', 'Tanggal'), k('invoice', 'Invoice'), k('tipe', 'Tipe'), k('item', 'Item'), k('kategori', 'Kategori'),
      k('qty', 'Qty', 'angka'), k('diskon', 'Diskon', 'rupiah'), k('modal', 'Modal', 'rupiah'), k('penjualan', 'Penjualan', 'rupiah'),
    ],
  },
  stok_bahan: {
    judul: 'Stok bahan',
    kolom: [
      k('outlet', 'Outlet'), k('bahan', 'Bahan'), k('satuan', 'Satuan'), k('stok', 'Stok', 'angka'),
      k('minimum', 'Minimum', 'angka'), k('di_bawah_minimum', 'Di bawah minimum'),
    ],
  },
  status_opname: {
    judul: 'Opname harian (buka/tutup shift)',
    kolom: [
      k('outlet', 'Outlet'), k('tanggal', 'Tanggal'), k('status_harian', 'Status'), k('jumlah_shift', 'Shift', 'angka'),
      k('opname_buka_kurang', 'Opname buka kurang', 'angka'), k('opname_tutup_kurang', 'Opname tutup kurang', 'angka'),
    ],
  },
  status_opname_mingguan: {
    judul: 'Opname mingguan',
    kolom: [k('outlet', 'Outlet'), k('minggu_mulai', 'Minggu mulai'), k('minggu_selesai', 'Minggu selesai'), k('status_mingguan', 'Status'), k('batas', 'Batas')],
  },
  cakupan_resep: {
    judul: 'Bahan tanpa resep',
    kolom: [k('outlet', 'Outlet'), k('bahan', 'Bahan'), k('satuan', 'Satuan'), k('stok', 'Stok', 'angka')],
  },
  cakupan_resep_produk: {
    judul: 'Produk tanpa resep',
    kolom: [k('outlet', 'Outlet'), k('produk', 'Produk'), k('kategori', 'Kategori')],
  },
  penjualan_vs_stok: {
    judul: 'Penjualan vs pergerakan stok',
    kolom: [
      k('outlet', 'Outlet'), k('bahan', 'Bahan'), k('satuan', 'Satuan'), k('terpakai_penjualan', 'Terpakai penjualan', 'angka'),
      k('waste', 'Waste', 'angka'), k('selisih_opname', 'Selisih opname/penyesuaian', 'angka'), k('masuk', 'Masuk', 'angka'),
      k('keluar_lain', 'Keluar lain', 'angka'), k('perubahan_bersih', 'Perubahan bersih', 'angka'),
    ],
  },
};

const LABEL_STATUS: Record<string, string> = {
  missing: 'Kurang',
  complete: 'Lengkap',
  not_required: 'Tidak wajib',
  no_shift: 'Belum ada shift',
  done: 'Sudah',
  due: 'Belum (masih dalam batas)',
  overdue: 'Lewat batas',
  not_applicable: 'Tidak berlaku',
};

function tabel(namaKolom: string, baris: Baris[], totalBaris: number): TabelAi {
  const def = KOLOM[namaKolom]!;
  return { judul: def.judul, kolom: def.kolom, baris, totalBaris };
}

/**
 * `batasHak` terisi = penanya cuma melihat SEBAGIAN (orang/outlet lain di
 * luar haknya). Nol baris + cakupan penuh = benar-benar tidak ada data;
 * nol baris + cakupan terbatas = kosong DI DALAM HAK, bukan nol.
 */
function ringkasUntukModel(
  baris: Baris[],
  totalBaris: number,
  tambahan: Record<string, unknown>,
  batasHak: string | null,
): Record<string, unknown> {
  const dikirim = baris.slice(0, BARIS_UNTUK_MODEL);
  const status = baris.length > 0 ? 'ok' : batasHak ? 'kosong_dalam_hak' : 'tidak_ada_data';
  return {
    status,
    ...(status === 'kosong_dalam_hak' ? { pesan: PESAN_STATUS.kosong_dalam_hak } : {}),
    ...(batasHak ? { batas_hak: batasHak } : {}),
    ...tambahan,
    jumlah_baris_total: totalBaris,
    baris: dikirim,
    ...(totalBaris > dikirim.length
      ? { catatan: `Hanya ${dikirim.length} dari ${totalBaris} baris yang dikirim. Jangan menyimpulkan atau menjumlahkan dari baris ini saja; arahkan ke tabel.` }
      : {}),
  };
}

function str(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  return typeof v === 'string' ? v.trim() : '';
}

/** Nama periode untuk kalimat jawaban -- kode `minggu_ini` tidak boleh sampai ke pengguna. */
const NAMA_PERIODE: Record<string, string> = {
  hari_ini: 'hari ini',
  kemarin: 'kemarin',
  minggu_ini: 'minggu ini',
  minggu_lalu: 'minggu lalu',
  bulan_ini: 'bulan ini',
  bulan_lalu: 'bulan lalu',
};

function rentangValid(args: Record<string, unknown>, hariIni: string): { dari: string; sampai: string; nama?: string } | null {
  if (periodeRelatifValid(args.periode)) return { ...rentangPeriode(hariIni, args.periode), nama: NAMA_PERIODE[args.periode] };
  const dari = str(args, 'start_date');
  const sampai = str(args, 'end_date');
  return POLA_TANGGAL.test(dari) && POLA_TANGGAL.test(sampai) && dari <= sampai ? { dari, sampai } : null;
}

function catatan(alat: string, args: Record<string, unknown>, sumber: 'lokal' | 'pos', status: StatusAlat, jumlahBaris: number | null) {
  return { alat, argumen: args, sumber, status, jumlahBaris };
}

function tolak(p: PanggilanAlat, sumber: 'lokal' | 'pos', status: keyof typeof PESAN_STATUS): HasilAlat {
  return { untukModel: { status, pesan: PESAN_STATUS[status] }, tabel: [], catatan: catatan(p.name, p.args, sumber, status, null) };
}

/** Hak baca penanya di database laporan (fungsi ai_cakupan(), cermin RLS tiap tabel). */
export type CakupanLokal = { laporan_semua: boolean; presensi_semua: boolean; omzet_pos: boolean };

const BATAS_HAK_LOKAL: Record<string, (c: CakupanLokal) => string | null> = {
  status_laporan: (c) => (c.laporan_semua ? null : 'Hanya laporan yang boleh dilihat peran penanya; laporan lain tidak termasuk.'),
  presensi: (c) => (c.presensi_semua ? null : 'Hanya absensi penanya sendiri; absensi orang lain di luar haknya.'),
  omzet_pos_harian: () => null,
};

/**
 * Angka utama untuk kalimat jawaban (koreksi CEO 29 September 2026: kalau
 * tabel tampil, prosa cuma SATU kalimat -- angka utama, periode, cakupan).
 * Dihitung di sini dari baris hasil alat, supaya model tidak menghitung
 * sendiri. Kalau baris dipotong (baris < total), hitungan per baris tidak
 * dibuat -- cuma jumlah total dari sumber.
 */
function ringkasan(alat: string, baris: Baris[], totalBaris: number): Record<string, number> {
  const lengkap = baris.length === totalBaris;
  const unik = (kunci: string, syarat: (b: Baris) => boolean = () => true) =>
    new Set(baris.filter(syarat).map((b) => String(b[kunci]))).size;
  switch (alat) {
    case 'status_laporan':
      return {
        orang_total: unik('pic_nama'),
        orang_belum_lapor: unik('pic_nama', (b) => Number(b.hari_belum) > 0),
        penugasan_total: baris.length,
      };
    case 'presensi':
      return { orang_total: baris.length, orang_pernah_terlambat: baris.filter((b) => Number(b.hari_terlambat) > 0).length };
    case 'stok_bahan':
      return lengkap
        ? { bahan_total: totalBaris, bahan_di_bawah_minimum: baris.filter((b) => b.di_bawah_minimum === true).length }
        : { bahan_total: totalBaris };
    case 'status_opname':
      return { outlet_total: baris.length, outlet_opname_harian_kurang: baris.filter((b) => b.status_harian === 'Kurang').length };
    default:
      return { baris_total: totalBaris };
  }
}

// ─── Alat lokal ────────────────────────────────────────────────────────────
async function jalankanLokal(supabase: SupabaseClient, p: PanggilanAlat, cakupan: CakupanLokal | null, hariIni: string): Promise<HasilAlat> {
  if (!cakupan) {
    return { untukModel: { status: 'galat', pesan: 'Alat gagal dijalankan.' }, tabel: [], catatan: catatan(p.name, p.args, 'lokal', 'galat', null) };
  }
  if (p.name === 'omzet_pos_harian' && !cakupan.omzet_pos) return tolak(p, 'lokal', 'tidak_berhak');
  const r = rentangValid(p.args, hariIni);
  if (!r) {
    return { untukModel: { status: 'argumen_salah', pesan: 'Isi `periode`, atau start_date dan end_date YYYY-MM-DD (awal <= akhir).' }, tabel: [], catatan: catatan(p.name, p.args, 'lokal', 'argumen_salah', null) };
  }

  const jalankanRpc = () =>
    p.name === 'status_laporan'
      ? supabase.rpc('ai_status_laporan', { p_dari: r.dari, p_sampai: r.sampai })
      : p.name === 'presensi'
        ? supabase.rpc('ai_presensi', { p_dari: r.dari, p_sampai: r.sampai })
        : supabase.rpc('ai_omzet_pos', { p_dari: r.dari, p_sampai: r.sampai, p_outlet: str(p.args, 'outlet') || null });

  let { data, error } = await jalankanRpc();
  // Galat selain batas hak / rentang salah: catat sebabnya, coba ulang sekali.
  if (error && !/TIDAK_BERHAK|Rentang tanggal tidak valid/.test(error.message)) {
    console.warn(`alat lokal ${p.name} gagal, coba ulang sekali: ${error.message}`);
    ({ data, error } = await jalankanRpc());
  }
  if (error && /TIDAK_BERHAK/.test(error.message)) return tolak(p, 'lokal', 'tidak_berhak');
  if (error) {
    const rentangSalah = /Rentang tanggal tidak valid/.test(error.message);
    return {
      untukModel: { status: rentangSalah ? 'argumen_salah' : 'galat', pesan: rentangSalah ? error.message : 'Alat gagal dijalankan.' },
      tabel: [],
      catatan: catatan(p.name, p.args, 'lokal', rentangSalah ? 'argumen_salah' : 'galat', null),
    };
  }

  let baris = (data ?? []) as Baris[];
  if (p.name === 'status_laporan') {
    baris = baris.map((b) => ({ ...b, tanggal_belum: Array.isArray(b.tanggal_belum) ? (b.tanggal_belum as string[]).join(', ') : b.tanggal_belum }));
  }
  if (p.name === 'omzet_pos_harian') {
    // Urutan baris dari Postgres: per hari, total per outlet, lalu total keseluruhan.
    baris = baris.map((b) => ({
      ...b,
      outlet: b.tingkat === 'total' ? 'TOTAL SEMUA OUTLET' : b.outlet,
      tanggal: b.tingkat === 'hari' ? b.tanggal : b.tingkat === 'outlet' ? 'Total outlet' : `${r.dari} s/d ${r.sampai}`,
    }));
  }

  const periode = { dari: r.dari, sampai: r.sampai, ...(r.nama ? { nama: r.nama } : {}) };
  const outlet = p.name === 'omzet_pos_harian' ? str(p.args, 'outlet') || 'semua outlet yang bisa dilihat penanya' : undefined;
  const batasHak = BATAS_HAK_LOKAL[p.name]?.(cakupan) ?? null;
  return {
    untukModel: ringkasUntukModel(
      baris,
      baris.length,
      { periode, ...(outlet ? { outlet } : {}), ...(baris.length > 0 && p.name !== 'omzet_pos_harian' ? { ringkasan: ringkasan(p.name, baris, baris.length) } : {}) },
      batasHak,
    ),
    tabel: baris.length > 0 ? [tabel(p.name, baris, baris.length)] : [],
    catatan: catatan(p.name, p.args, 'lokal', baris.length > 0 ? 'ok' : batasHak ? 'kosong_dalam_hak' : 'kosong', baris.length),
  };
}

// ─── Alat POS ──────────────────────────────────────────────────────────────
function hasilPosKeAlat(p: PanggilanAlat, hasil: HasilPos, cakupanOutlet: 'all' | 'limited' | 'none'): HasilAlat {
  // Izin layar POS tidak dimiliki / membership tanpa outlet = BATAS HAK, bukan data kosong.
  if (hasil.status === 'forbidden' || cakupanOutlet === 'none') return tolak(p, 'pos', 'tidak_berhak');
  if (hasil.status !== 'ok') {
    const status: StatusAlat = hasil.status === 'invalid_args' ? 'argumen_salah' : hasil.status === 'error' ? 'galat' : 'ditolak';
    const pesan =
      status === 'argumen_salah'
        ? 'Argumen tidak valid (tanggal YYYY-MM-DD, awal <= akhir, maks 92 hari).'
        : status === 'ditolak'
          ? 'Alat ini tidak ada. Katakan pertanyaan ini tidak bisa dijawab dengan alat yang tersedia.'
          : 'Alat gagal dijalankan.';
    return { untukModel: { status, pesan }, tabel: [], catatan: catatan(p.name, p.args, 'pos', status, null) };
  }
  if (hasil.outletFilter === 'not_visible') return tolak(p, 'pos', 'outlet_di_luar_hak');

  const ubahStatus = (b: Baris): Baris => ({
    ...b,
    ...(typeof b.status_harian === 'string' ? { status_harian: LABEL_STATUS[b.status_harian] ?? b.status_harian } : {}),
    ...(typeof b.status_mingguan === 'string' ? { status_mingguan: LABEL_STATUS[b.status_mingguan] ?? b.status_mingguan } : {}),
  });
  const baris = hasil.rows.map(ubahStatus);
  const mingguan = (hasil.extra?.weekly ?? []).map(ubahStatus);

  const outlet =
    hasil.outletFilter === 'matched'
      ? hasil.matchedOutlet
      : cakupanOutlet === 'all'
        ? 'semua outlet'
        : 'semua outlet yang boleh dilihat penanya';
  const batasHak =
    cakupanOutlet === 'limited' && hasil.outletFilter !== 'matched'
      ? 'Hanya outlet yang boleh dilihat penanya di POS; outlet lain tidak termasuk.'
      : null;
  const nama = typeof p.args.periode === 'string' ? NAMA_PERIODE[p.args.periode] : undefined;
  const periode =
    hasil.period && 'from' in hasil.period
      ? { dari: hasil.period.from, sampai: hasil.period.to, ...(nama ? { nama } : {}) }
      : hasil.period;

  const tabelTabel: TabelAi[] = [];
  if (baris.length > 0) tabelTabel.push(tabel(p.name, baris, hasil.totalCount));
  if (mingguan.length > 0) tabelTabel.push(tabel('status_opname_mingguan', mingguan, mingguan.length));
  const cakupanResep = hasil.extra?.recipeCoverage;
  if (p.name === 'cakupan_resep' && cakupanResep && cakupanResep.products.length > 0) {
    tabelTabel.push(tabel('cakupan_resep_produk', cakupanResep.products, cakupanResep.productTotal));
  }

  const cakupanStok = hasil.extra?.stockCoverage;
  const catatanWajib: string[] = [];
  const tambahanStok: Record<string, unknown> = {};
  if (p.name === 'stok_bahan' && cakupanStok) {
    if (cakupanStok.outletsWithoutStock.length > 0) {
      catatanWajib.push(`Outlet tanpa catatan stok sama sekali: ${cakupanStok.outletsWithoutStock.join(', ')}.`);
      tambahanStok.outlet_tanpa_catatan_stok = cakupanStok.outletsWithoutStock;
    }
    if (cakupanStok.withoutMinimum > 0) {
      catatanWajib.push(
        `${cakupanStok.withoutMinimum} dari ${cakupanStok.stockRows} catatan stok belum punya stok minimum, jadi "di bawah minimum" belum bisa dinilai untuk bahan itu.`,
      );
      tambahanStok.catatan_stok_tanpa_minimum = cakupanStok.withoutMinimum;
    }
  }

  if (p.name === 'cakupan_resep' && cakupanResep) {
    const perOutlet = cakupanResep.perOutlet
      .map((o) => `${o.outletName} ${o.ingredientsWithoutRecipe} bahan / ${o.productsWithoutRecipe} produk`)
      .join('; ');
    if (perOutlet) catatanWajib.push(`Tanpa resep per outlet (bahan tidak pernah terpotong / produk tidak memotong bahan): ${perOutlet}.`);
    const kosong = cakupanResep.perOutlet.filter((o) => o.stockRows === 0).map((o) => o.outletName);
    if (kosong.length > 0) {
      catatanWajib.push(`Outlet tanpa catatan stok (bahan tanpa resep di sana belum bisa dihitung): ${kosong.join(', ')}.`);
    }
    catatanWajib.push(
      `Di master bahan: ${cakupanResep.masterIngredientsWithoutRecipe} dari ${cakupanResep.masterIngredients} bahan tidak dipakai resep mana pun.`,
    );
    tambahanStok.per_outlet = cakupanResep.perOutlet;
    tambahanStok.produk_tanpa_resep_total = cakupanResep.productTotal;
  }

  const untukModel = ringkasUntukModel(
    baris,
    hasil.totalCount,
    { periode, outlet, ...tambahanStok, ...(baris.length > 0 ? { ringkasan: ringkasan(p.name, baris, hasil.totalCount) } : {}) },
    batasHak,
  );
  if (mingguan.length > 0) untukModel.opname_mingguan = mingguan;

  return {
    untukModel,
    tabel: tabelTabel,
    ...(catatanWajib.length > 0 ? { catatanWajib } : {}),
    catatan: catatan(p.name, p.args, 'pos', hasil.totalCount > 0 ? 'ok' : batasHak ? 'kosong_dalam_hak' : 'kosong', hasil.totalCount),
  };
}

/**
 * Jalankan SATU putaran panggilan alat. Urutan hasil = urutan panggilan.
 * Semua panggilan POS di putaran ini digabung jadi satu permintaan jembatan.
 */
export async function jalankanPutaranAlat(
  supabase: SupabaseClient,
  user: { id: string; email: string },
  panggilan: PanggilanAlat[],
  hariIni: string,
): Promise<HasilAlat[]> {
  const hasil: (HasilAlat | null)[] = panggilan.map(() => null);

  const pos = panggilan.map((p, i) => ({ p, i })).filter(({ p }) => Object.hasOwn(NAMA_POS, p.name));
  if (pos.length > 0) {
    // Akses POS penanya SENDIRI (dihitung database laporan), ikut di token.
    const { data: aksesPos } = await supabase.rpc('akses_pos_saya');
    const kirim = () =>
      panggilAlatPos(user, pos.map(({ p }) => ({ name: NAMA_POS[p.name]!, args: p.args })), (aksesPos as AksesPos | null) ?? null);
    let jawaban = await kirim();
    // Koreksi CEO 29 September 2026: pertanyaan tentang outlet yang boleh
    // dilihat TIDAK BOLEH berakhir "tidak bisa diambil" gara-gara galat
    // sesaat. Catat sebabnya, coba ulang SEKALI (token baru).
    const alatGalat = jawaban.akses === 'ok' ? pos.filter((_, urut) => jawaban.akses === 'ok' && jawaban.hasil[urut]?.status === 'error') : [];
    if (jawaban.akses === 'galat' || alatGalat.length > 0) {
      console.warn(
        `alat POS gagal, coba ulang sekali: ${jawaban.akses === 'galat' ? 'jembatan galat' : `galat di ${alatGalat.map(({ p }) => p.name).join(', ')}`}`,
      );
      const ulang = await kirim();
      if (ulang.akses !== 'galat') jawaban = ulang;
      else console.error('alat POS tetap gagal sesudah coba ulang');
    }
    pos.forEach(({ p, i }, urut) => {
      if (jawaban.akses === 'ok') hasil[i] = hasilPosKeAlat(p, jawaban.hasil[urut]!, jawaban.cakupanOutlet);
      else if (jawaban.akses === 'tanpa_akses_pos') hasil[i] = tolak(p, 'pos', 'tanpa_akses_pos');
      else {
        hasil[i] = { untukModel: { status: 'galat', pesan: 'Data POS tidak bisa diambil saat ini.' }, tabel: [], catatan: catatan(p.name, p.args, 'pos', 'galat', null) };
      }
    });
  }

  // Hak baca lokal dibaca SEKALI per putaran, hanya kalau ada alat lokal.
  let cakupan: CakupanLokal | null | undefined;
  for (let i = 0; i < panggilan.length; i++) {
    const p = panggilan[i]!;
    if (hasil[i]) continue;
    if (NAMA_LOKAL.has(p.name)) {
      if (cakupan === undefined) {
        const { data, error } = await supabase.rpc('ai_cakupan').single<CakupanLokal>();
        cakupan = error ? null : data;
      }
      hasil[i] = await jalankanLokal(supabase, p, cakupan, hariIni);
    } else {
      hasil[i] = {
        untukModel: { status: 'alat_tidak_ada', pesan: 'Alat ini tidak ada. Katakan pertanyaan ini tidak bisa dijawab dengan alat yang tersedia.' },
        tabel: [],
        catatan: catatan(p.name.slice(0, 80), p.args, 'lokal', 'ditolak', null),
      };
    }
  }
  return hasil as HasilAlat[];
}
