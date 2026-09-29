import type { NilaiSel } from './tabel';

/**
 * Angka utama jawaban asisten AI -- DIHITUNG SERVER (koreksi CEO 29
 * September 2026): untuk alat yang angka utamanya hitungan atau jumlah,
 * server yang menghitung, model HANYA mengutip. Model tidak pernah
 * menjumlahkan baris sendiri.
 *
 * Pemicunya: "stok di semua outlet" dijawab "Indokopi Jatinegara (66 bahan)"
 * padahal 66 = 65 Jatinegara + 1 Cempaka Putih -- model menempelkan total ke
 * satu outlet.
 *
 * Dua lapis:
 * 1. `hitungAngkaUtama` -> `ringkasan` (+ `ringkasan_per_outlet`) yang
 *    dikirim ke model, dan kalimat utama buatan server.
 * 2. `periksaKalimat` -> setiap angka di kalimat model harus salah satu angka
 *    yang dihitung server (atau bagian tanggal periode), dan angka yang
 *    langsung mengikuti nama outlet harus milik outlet itu. Gagal -> kalimat
 *    model DIGANTI kalimat server (lib/ai/agen.ts).
 *
 * Kalau tidak semua baris terambil (baris < total), jumlah dari baris TIDAK
 * dibuat -- hanya jumlah total dari sumber, dan kalimat server menyebut
 * bahwa jumlahnya tidak dihitung.
 */

type Baris = Record<string, NilaiSel>;

export type Periode = { dari: string; sampai: string; nama?: string };

export type AngkaUtama = {
  /** Kalimat utama buatan server -- pengganti kalau kalimat model gagal diperiksa. */
  kalimat: string;
  /** Semua angka yang boleh muncul di kalimat model. */
  angka: number[];
  /** Nama outlet -> angka miliknya (untuk memeriksa angka yang ditempel ke outlet). */
  perOutlet: Record<string, number[]>;
  /** Bagian tanggal periode -- boleh di mana saja, termasuk sesudah nama outlet. */
  tanggal: number[];
};

export type HasilAngkaUtama = {
  ringkasan: Record<string, number>;
  ringkasanPerOutlet?: Record<string, Record<string, number>>;
  utama: AngkaUtama;
};

export type KonteksAngka = {
  periode?: Periode | null;
  /** Tanggal hari ini (YYYY-MM-DD) -- "per 29 Sep" boleh disebut walau alat tanpa periode. */
  hariIni?: string;
  /** Teks cakupan outlet dari hasil alat ("semua outlet", nama outlet, ...). */
  outlet?: string | null;
  /** Baris opname mingguan (status_opname). */
  mingguan?: Baris[];
  /** Ringkasan cakupan resep dari pos-fnb (cakupan_resep). */
  resep?: {
    perOutlet: { outletName: string; ingredientsWithoutRecipe: number; productsWithoutRecipe: number }[];
    productTotal: number;
    masterIngredientsWithoutRecipe: number;
    masterIngredients: number;
  };
  /** Outlet tanpa catatan stok (stok_bahan). */
  outletTanpaStok?: string[];
  /** Hitungan anomali dari pos-fnb (anomali_data). */
  anomali?: { perAturan: Record<string, number>; jenisBelumDitentukan: number; bahanDicek: number };
};

const LABEL_ANOMALI: Record<string, string> = {
  satuan_nama: 'satuan di nama beda dengan satuan dasar',
  harga_masuk: 'biaya masuk 10x atau lebih dari rata-rata',
  biaya_nol: 'ada stok tapi biaya nol',
  stok_minus: 'stok minus',
  stok_berlebih: 'stok 100x atau lebih dari pemakaian harian',
  satuan_jenis: 'satuan dasar bukan jenis ukuran bahan',
  konversi_jenis: 'konversi beli menyeberang jenis ukuran',
};

/** Baris sedikit = pertanyaan satu-dua bahan; nilai barisnya boleh dikutip apa adanya. */
const BARIS_BOLEH_DIKUTIP = 5;

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

function tgl(ymd: string): { h: number; b: string; t: string } {
  const [t, b, h] = ymd.split('-');
  return { h: Number(h), b: BULAN[Number(b) - 1] ?? b!, t: t! };
}

/** 'minggu ini (28-29 Sep 2026)' / '1 Sep - 3 Okt 2026' / '29 Sep 2026'. */
export function teksPeriode(p: Periode | null | undefined): string {
  if (!p) return '';
  const a = tgl(p.dari);
  const z = tgl(p.sampai);
  const rentang =
    p.dari === p.sampai
      ? `${z.h} ${z.b} ${z.t}`
      : a.b === z.b && a.t === z.t
        ? `${a.h}-${z.h} ${z.b} ${z.t}`
        : a.t === z.t
          ? `${a.h} ${a.b} - ${z.h} ${z.b} ${z.t}`
          : `${a.h} ${a.b} ${a.t} - ${z.h} ${z.b} ${z.t}`;
  return p.nama ? `${p.nama} (${rentang})` : rentang;
}

function angkaId(n: number): string {
  const bulat = Math.round(n * 100) / 100;
  const [utuh, pecahan] = Math.abs(bulat).toString().split('.');
  const kelompok = utuh!.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${bulat < 0 ? '-' : ''}${kelompok}${pecahan ? `,${pecahan}` : ''}`;
}
const rp = (n: number) => `Rp${angkaId(n)}`;

const num = (v: NilaiSel | undefined): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const jumlah = (baris: Baris[], kunci: string) => baris.reduce((s, b) => s + num(b[kunci]), 0);

function perOutletHitung(baris: Baris[], syarat: (b: Baris) => boolean = () => true): Record<string, number> {
  const m: Record<string, number> = {};
  for (const b of baris) {
    if (!syarat(b) || typeof b.outlet !== 'string') continue;
    m[b.outlet] = (m[b.outlet] ?? 0) + 1;
  }
  return m;
}

function cakupanTeks(outlet: string | null | undefined): string {
  return outlet && outlet !== 'semua outlet' ? ` di ${outlet}` : '';
}

/** Bagian tanggal periode (tanggal, bulan, tahun) -- boleh muncul di kalimat. */
function angkaTanggal(ymd: (string | undefined)[]): number[] {
  const out: number[] = [];
  for (const s of ymd) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) continue;
    const [t, b, h] = s.split('-').map(Number);
    out.push(t!, b!, h!);
  }
  return out;
}

export function hitungAngkaUtama(alat: string, baris: Baris[], totalBaris: number, k: KonteksAngka = {}): HasilAngkaUtama {
  const lengkap = baris.length === totalBaris;
  const per = teksPeriode(k.periode);
  const di = cakupanTeks(k.outlet);
  let ringkasan: Record<string, number>;
  let perOutlet: Record<string, Record<string, number>> | undefined;
  let kalimat: string;

  const unik = (kunci: string, syarat: (b: Baris) => boolean = () => true) =>
    new Set(baris.filter(syarat).map((b) => String(b[kunci]))).size;

  switch (alat) {
    case 'status_laporan': {
      ringkasan = {
        orang_total: unik('pic_nama'),
        orang_belum_lapor: unik('pic_nama', (b) => num(b.hari_belum) > 0),
        penugasan_total: baris.length,
        penugasan_belum: baris.filter((b) => num(b.hari_belum) > 0).length,
        hari_belum_total: jumlah(baris, 'hari_belum'),
      };
      kalimat = `${ringkasan.orang_belum_lapor} dari ${ringkasan.orang_total} orang belum mengirim laporan ${per}; ${ringkasan.penugasan_belum} dari ${ringkasan.penugasan_total} penugasan belum lengkap.`;
      break;
    }
    case 'presensi': {
      ringkasan = {
        orang_total: baris.length,
        orang_pernah_terlambat: baris.filter((b) => num(b.hari_terlambat) > 0).length,
        hari_terlambat_total: jumlah(baris, 'hari_terlambat'),
        menit_terlambat_total: jumlah(baris, 'total_menit_terlambat'),
        orang_tanpa_absen_masuk: baris.filter((b) => num(b.hari_tanpa_absen_masuk) > 0).length,
      };
      kalimat = `${ringkasan.orang_pernah_terlambat} dari ${ringkasan.orang_total} orang pernah terlambat ${per}: total ${ringkasan.hari_terlambat_total} hari, ${angkaId(ringkasan.menit_terlambat_total!)} menit.`;
      break;
    }
    case 'omzet_pos_harian': {
      // Total dari baris 'total' & 'outlet' yang dihitung Postgres (ai_omzet_pos), bukan dijumlahkan di sini.
      const total = baris.find((b) => b.tingkat === 'total');
      const perO = baris.filter((b) => b.tingkat === 'outlet' && typeof b.outlet === 'string');
      ringkasan = {
        penjualan_bersih_total: num(total?.penjualan_bersih),
        jumlah_order_total: num(total?.jumlah_order),
        uang_diterima_total: num(total?.uang_diterima),
        refund_total: num(total?.refund),
        outlet_dengan_data: perO.length,
      };
      perOutlet = Object.fromEntries(
        perO.map((b) => [String(b.outlet), { penjualan_bersih: num(b.penjualan_bersih), jumlah_order: num(b.jumlah_order), uang_diterima: num(b.uang_diterima) }]),
      );
      const rinci = perO.length > 1 ? `; ${perO.map((b) => `${b.outlet} ${rp(num(b.penjualan_bersih))}`).join(', ')}` : '';
      kalimat = `Penjualan bersih${di} ${per}: ${rp(ringkasan.penjualan_bersih_total!)} dari ${angkaId(ringkasan.jumlah_order_total!)} order${rinci}.`;
      break;
    }
    case 'penjualan_per_item': {
      if (lengkap) {
        ringkasan = {
          baris_total: totalBaris,
          qty_total: jumlah(baris, 'qty'),
          penjualan_total: jumlah(baris, 'penjualan'),
          diskon_total: jumlah(baris, 'diskon'),
          modal_total: jumlah(baris, 'modal'),
          baris_hpp_belum_lengkap: baris.filter((b) => typeof b.modal_belum_lengkap === 'string' && b.modal_belum_lengkap !== '').length,
        };
        kalimat =
          `${angkaId(totalBaris)} baris item terjual${di} ${per}: ${angkaId(ringkasan.qty_total!)} qty, penjualan ${rp(ringkasan.penjualan_total!)}` +
          (ringkasan.baris_hpp_belum_lengkap! > 0 ? `; ${ringkasan.baris_hpp_belum_lengkap} baris HPP-nya belum lengkap (harga bahan biaya saja belum diisi).` : '.');
      } else {
        ringkasan = { baris_total: totalBaris };
        kalimat = `${angkaId(totalBaris)} baris item terjual${di} ${per}; total qty dan penjualan tidak dihitung karena tidak semua baris terambil.`;
      }
      break;
    }
    case 'stok_bahan': {
      if (lengkap) {
        const catatan = perOutletHitung(baris);
        const bawah = perOutletHitung(baris, (b) => b.di_bawah_minimum === true);
        ringkasan = {
          bahan_total: totalBaris,
          bahan_di_bawah_minimum: baris.filter((b) => b.di_bawah_minimum === true).length,
          outlet_dengan_data: Object.keys(catatan).length,
        };
        perOutlet = Object.fromEntries(Object.entries(catatan).map(([o, n]) => [o, { catatan_stok: n, di_bawah_minimum: bawah[o] ?? 0 }]));
        kalimat = `${angkaId(totalBaris)} catatan stok bahan${di}; ${ringkasan.bahan_di_bawah_minimum} di bawah minimum.`;
      } else {
        ringkasan = { bahan_total: totalBaris };
        kalimat = `${angkaId(totalBaris)} catatan stok bahan${di}.`;
      }
      if (k.outletTanpaStok) ringkasan.outlet_tanpa_catatan_stok = k.outletTanpaStok.length;
      break;
    }
    case 'status_opname': {
      const mingguan = k.mingguan ?? [];
      ringkasan = {
        outlet_total: baris.length,
        outlet_opname_harian_kurang: baris.filter((b) => b.status_harian === 'Kurang').length,
        outlet_wajib_tanpa_bahan: baris.filter((b) => b.status_harian === 'Wajib, belum ada bahan Hitung Tiap Shift').length,
        outlet_opname_mingguan_lewat_batas: mingguan.filter((b) => b.status_mingguan === 'Lewat batas').length,
      };
      const tanggal = typeof baris[0]?.tanggal === 'string' ? teksPeriode({ dari: baris[0].tanggal, sampai: baris[0].tanggal }) : per;
      kalimat =
        `${ringkasan.outlet_opname_harian_kurang} dari ${ringkasan.outlet_total} outlet kurang opname harian pada ${tanggal}` +
        (ringkasan.outlet_wajib_tanpa_bahan! > 0 ? `; ${ringkasan.outlet_wajib_tanpa_bahan} outlet wajib tapi belum punya bahan Hitung Tiap Shift` : '') +
        (mingguan.length > 0 ? `; opname mingguan lewat batas di ${ringkasan.outlet_opname_mingguan_lewat_batas} outlet.` : '.');
      break;
    }
    case 'cakupan_resep': {
      ringkasan = { bahan_tanpa_resep_total: totalBaris };
      if (k.resep) {
        ringkasan.produk_tanpa_resep_total = k.resep.productTotal;
        ringkasan.master_bahan_tanpa_resep = k.resep.masterIngredientsWithoutRecipe;
        ringkasan.master_bahan_total = k.resep.masterIngredients;
        perOutlet = Object.fromEntries(
          k.resep.perOutlet.map((o) => [o.outletName, { bahan_tanpa_resep: o.ingredientsWithoutRecipe, produk_tanpa_resep: o.productsWithoutRecipe }]),
        );
        ringkasan.outlet_total = k.resep.perOutlet.length;
      }
      kalimat = `${angkaId(totalBaris)} bahan tanpa resep${k.resep ? ` dan ${angkaId(k.resep.productTotal)} produk tanpa resep` : ''}${di}.`;
      break;
    }
    case 'anomali_data': {
      // Semua hitungan dari pos-fnb (lib/anomaly/check.ts), bukan dari baris.
      const a = k.anomali;
      ringkasan = { temuan_total: totalBaris };
      if (a) {
        for (const [kode, jumlahAturan] of Object.entries(a.perAturan)) ringkasan[`aturan_${kode}`] = jumlahAturan;
        ringkasan.bahan_jenis_belum_ditentukan = a.jenisBelumDitentukan;
        ringkasan.bahan_dicek = a.bahanDicek;
      }
      const rinci = a
        ? Object.entries(a.perAturan)
            .filter(([, j]) => j > 0)
            .map(([kode, j]) => `${j} ${LABEL_ANOMALI[kode] ?? kode}`)
            .join(', ')
        : '';
      kalimat =
        `${angkaId(totalBaris)} temuan anomali dari ${a ? angkaId(a.bahanDicek) : '?'} bahan yang dilacak stoknya${rinci ? `: ${rinci}` : ''}.` +
        (a && a.jenisBelumDitentukan > 0 ? ` ${a.jenisBelumDitentukan} bahan jenis ukurannya belum ditentukan, jadi belum dicek aturan jenis.` : '');
      break;
    }
    case 'penjualan_vs_stok': {
      ringkasan = { baris_total: totalBaris };
      if (lengkap) {
        const c = perOutletHitung(baris);
        perOutlet = Object.fromEntries(Object.entries(c).map(([o, n]) => [o, { bahan: n }]));
        ringkasan.outlet_dengan_data = Object.keys(c).length;
      }
      kalimat = `${angkaId(totalBaris)} baris bahan dengan pergerakan stok${di} ${per}.`;
      break;
    }
    default: {
      ringkasan = { baris_total: totalBaris };
      kalimat = `${angkaId(totalBaris)} baris${di} ${per}.`;
    }
  }
  kalimat = kalimat.replace(/\s+([.;:,])/g, '$1').replace(/\s{2,}/g, ' ');

  // Angka yang boleh dikutip model.
  const angka: number[] = [...Object.values(ringkasan)];
  const milikOutlet: Record<string, number[]> = {};
  for (const [o, nilai] of Object.entries(perOutlet ?? {})) {
    milikOutlet[o] = Object.values(nilai);
    angka.push(...milikOutlet[o]!);
  }
  const tanggal = angkaTanggal([k.hariIni, k.periode?.dari, k.periode?.sampai, ...baris.map((b) => (typeof b.tanggal === 'string' ? b.tanggal : undefined))]);
  angka.push(...tanggal);
  for (const b of baris) {
    for (const v of Object.values(b)) {
      // Angka di dalam nama (bahan "Cup 16oz", produk "Paket 2") bukan hasil hitungan.
      if (typeof v === 'string' && !/^-?\d+(\.\d+)?$/.test(v)) for (const d of v.match(/\d+/g) ?? []) angka.push(Number(d));
    }
  }
  if (baris.length <= BARIS_BOLEH_DIKUTIP) {
    for (const b of baris) {
      const nilaiBaris = Object.values(b).filter((v) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))).map(num);
      angka.push(...nilaiBaris);
      if (typeof b.outlet === 'string') milikOutlet[b.outlet] = [...(milikOutlet[b.outlet] ?? []), ...nilaiBaris];
    }
  }

  return {
    ringkasan,
    ...(perOutlet && Object.keys(perOutlet).length > 0 ? { ringkasanPerOutlet: perOutlet } : {}),
    utama: { kalimat, angka, perOutlet: milikOutlet, tanggal },
  };
}

/** Tafsiran angka di teks: 1.448 / 1.448,5 (Indonesia), 1,448.5 (Inggris), 12,5. */
function tafsiran(token: string): number[] {
  const out = new Set<number>();
  const indo = Number(token.replace(/\./g, '').replace(',', '.'));
  const ingg = Number(token.replace(/,/g, ''));
  if (Number.isFinite(indo)) out.add(indo);
  if (Number.isFinite(ingg)) out.add(ingg);
  return [...out];
}

const sama = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * 1e-9);
const adaDi = (daftar: number[], token: string) => tafsiran(token).some((t) => daftar.some((d) => sama(t, d)));

const POLA_ANGKA = /\d+(?:[.,]\d+)*/g;
/** Jarak maksimum (karakter bukan angka) dari nama outlet ke angka yang dianggap miliknya. */
const JARAK_MILIK = 20;

/**
 * Setiap angka di kalimat model harus angka hitungan server; angka yang
 * langsung mengikuti nama outlet harus milik outlet itu.
 */
export function periksaKalimat(kalimat: string, utama: AngkaUtama[]): { ok: true } | { ok: false; alasan: string } {
  const boleh = utama.flatMap((u) => u.angka);
  for (const m of kalimat.matchAll(POLA_ANGKA)) {
    if (!adaDi(boleh, m[0])) return { ok: false, alasan: `angka ${m[0]} tidak dihitung server` };
  }
  const milik: Record<string, number[]> = {};
  for (const u of utama) for (const [o, n] of Object.entries(u.perOutlet)) milik[o] = [...(milik[o] ?? []), ...n];
  const namaOutlet = Object.keys(milik).sort((a, b) => b.length - a.length);
  const tanggal = utama.flatMap((u) => u.tanggal);
  const kecil = kalimat.toLowerCase();
  for (const o of namaOutlet) {
    let dari = 0;
    for (;;) {
      const i = kecil.indexOf(o.toLowerCase(), dari);
      if (i < 0) break;
      dari = i + o.length;
      const sisa = kalimat.slice(dari);
      const m = /^(\D*?)(\d+(?:[.,]\d+)*)/.exec(sisa);
      if (!m || m[1]!.length > JARAK_MILIK) continue;
      // Nama outlet lain di antaranya: angka itu milik outlet lain.
      if (namaOutlet.some((lain) => lain !== o && m[1]!.toLowerCase().includes(lain.toLowerCase()))) continue;
      if (!adaDi([...milik[o]!, ...tanggal], m[2]!)) return { ok: false, alasan: `angka ${m[2]} ditempel ke ${o}, bukan miliknya` };
    }
  }
  return { ok: true };
}
