/**
 * Logika sinkron omzet POS -> laporan (19 September 2026) -- MURNI: tanpa impor
 * runtime dan tanpa akses jaringan/database sendiri. Semua efek samping
 * dipasok lewat `SinkronDeps` oleh Route Handler (app/api/sinkron/pos), supaya
 * seluruh alur (sukses, POS mati, payload ditolak, log gagal) bisa diuji
 * langsung dari skrip Node (scripts/uji-sinkron-pos.mjs) tanpa menyentuh
 * database produksi.
 *
 * Alur: catat log 'berjalan' -> tarik dari POS -> terapkan_sinkron_pos() (SATU
 * transaksi di database: menyalin agregat, menutup log 'berhasil') -> kalau
 * tahap mana pun gagal, log ditutup 'gagal' dengan pesan yang SUDAH DIBERSIHKAN
 * dari rahasia. Kegagalan mencatat log sendiri tidak boleh menutupi galat asli.
 */

export interface HasilTerapkan {
  jumlah_baris: number;
  outlet_terpetakan: number;
  tak_terpetakan: unknown[];
}

export interface SinkronDeps {
  /** Tarik + urai JSON dari POS. Wajib melempar Error (tanpa rahasia di pesan) untuk non-2xx/timeout/bukan JSON. */
  ambilRingkasanPos(): Promise<unknown>;
  /** Buat baris log 'berjalan', kembalikan id-nya. */
  mulaiLog(): Promise<string>;
  /** Panggil terapkan_sinkron_pos(logId, payload); melempar kalau database menolak. */
  terapkan(logId: string, payload: unknown): Promise<HasilTerapkan>;
  /** Tutup log sebagai 'gagal'. */
  gagalkanLog(logId: string, galat: string): Promise<void>;
  /** Rahasia yang TIDAK BOLEH muncul di pesan galat (token dsb). */
  rahasia?: string[];
}

export type Tahap = 'log' | 'tarik' | 'terapkan';

export type HasilSinkron =
  | { ok: true; logId: string; hasil: HasilTerapkan }
  | { ok: false; tahap: Tahap; galat: string; logId: string | null };

const BATAS_PANJANG_GALAT = 500;

/** Buang rahasia dari teks galat dan batasi panjangnya (kolom log + respons). */
export function bersihkanGalat(pesan: unknown, rahasia: string[] = []): string {
  let teks = pesan instanceof Error ? pesan.message : typeof pesan === 'string' ? pesan : 'galat tidak dikenal';
  for (const r of rahasia) {
    if (r && r.length >= 4) teks = teks.split(r).join('***');
  }
  return teks.length > BATAS_PANJANG_GALAT ? `${teks.slice(0, BATAS_PANJANG_GALAT)}…` : teks;
}

export async function jalankanSinkronPos(deps: SinkronDeps): Promise<HasilSinkron> {
  const rahasia = deps.rahasia ?? [];

  let logId: string;
  try {
    logId = await deps.mulaiLog();
  } catch (e) {
    return { ok: false, tahap: 'log', galat: bersihkanGalat(e, rahasia), logId: null };
  }

  const gagalkan = async (tahap: Tahap, e: unknown): Promise<HasilSinkron> => {
    const galat = bersihkanGalat(e, rahasia);
    try {
      await deps.gagalkanLog(logId, galat);
    } catch {
      // Gagal mencatat kegagalan: galat ASLI tetap yang dilaporkan.
    }
    return { ok: false, tahap, galat, logId };
  };

  let payload: unknown;
  try {
    payload = await deps.ambilRingkasanPos();
  } catch (e) {
    return gagalkan('tarik', e);
  }

  try {
    const hasil = await deps.terapkan(logId, payload);
    return { ok: true, logId, hasil };
  } catch (e) {
    return gagalkan('terapkan', e);
  }
}

/**
 * Bandingkan header Authorization dengan `Bearer <rahasia>` dalam waktu
 * konstan (tidak membocorkan panjang/awalan). Rahasia < 16 karakter dianggap
 * TIDAK dikonfigurasi -> selalu false (lebih baik mati daripada hidup dengan
 * rahasia yang bisa ditebak).
 */
export function bearerCocok(header: string | null, rahasia: string | undefined): boolean {
  if (!rahasia || rahasia.length < 16 || !header) return false;
  const cocok = /^Bearer (.+)$/.exec(header);
  if (!cocok) return false;
  const a = new TextEncoder().encode(cocok[1]);
  const b = new TextEncoder().encode(rahasia);
  let selisih = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) selisih |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return selisih === 0;
}
