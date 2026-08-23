import type { FormSchema } from '../forms/types';

export type Warna = 'hijau' | 'kuning' | 'merah';

const URUTAN: Record<Warna, number> = { hijau: 0, kuning: 1, merah: 2 };

function warnaValid(v: unknown): v is Warna {
  return v === 'hijau' || v === 'kuning' || v === 'merah';
}

/** 03-CALC-SPEC.md §5: warna_akhir = yang paling buruk (merah > kuning > hijau). */
export function warnaTerburuk(...warna: (Warna | null | undefined)[]): Warna {
  let hasil: Warna = 'hijau';
  for (const w of warna) {
    if (w && URUTAN[w] > URUTAN[hasil]) hasil = w;
  }
  return hasil;
}

/** Key field `type:'status_warna'` pertama di schema -- itulah warna yang dipilih pengisi sendiri. */
export function cariFieldStatusWarna(schema: FormSchema): string | null {
  for (const block of schema.blocks) {
    for (const field of block.fields) {
      if (field.type === 'status_warna') return field.key;
    }
  }
  return null;
}

export function warnaDipilihDari(schema: FormSchema, isiKirim: Record<string, unknown>): Warna {
  const kunci = cariFieldStatusWarna(schema);
  const v = kunci ? isiKirim[kunci] : undefined;
  return warnaValid(v) ? v : 'hijau';
}

/**
 * Urgensi TERBURUK (angka terkecil = paling mendesak) di antara `decision`
 * yang akan tercipta dari pengiriman ini -- dihitung dari data yang SAMA
 * dipakai untuk benar-benar membuat baris `decision` (components/LaporForm.tsx
 * `tanganiKirim`), supaya tidak ada dua tempat menghitung hal yang sama
 * berbeda hasilnya (CLAUDE.md aturan #7 versi lokal). `null` = tidak ada
 * decision yang akan terbuat dari laporan ini.
 */
export function urgensiTerburukDariKirim(schema: FormSchema, isiKirim: Record<string, unknown>): number | null {
  const daftar: number[] = [];

  if (isiKirim.keputusan_ceo === true) {
    const judul = typeof isiKirim.keputusan_ceo_judul === 'string' ? isiKirim.keputusan_ceo_judul.trim() : '';
    if (judul) daftar.push(2); // default decision.urgensi (0001_init.sql) -- blokKeputusanCeo tidak menentukan urgensi sendiri
  }

  for (const block of schema.blocks) {
    for (const field of block.fields) {
      if (field.type !== 'tabel' || !field.sumberKeputusan) continue;
      const baris = (isiKirim[field.key] as Record<string, unknown>[] | undefined) ?? [];
      baris.forEach((r, i) => {
        const judul = typeof r.judul === 'string' ? r.judul.trim() : '';
        if (judul) daftar.push(Math.min(i + 1, 3));
      });
    }
  }

  return daftar.length ? Math.min(...daftar) : null;
}

/**
 * 03-CALC-SPEC.md §5, dua dari tiga pemicu merah/kuning: decision urgensi 1
 * -> merah; laporan terlambat ATAU ada decision urgensi 2/3 -> kuning.
 *
 * TIDAK diimplementasikan di sini: pemicu merah "ada selisih uang/stok yang
 * belum ada penyebabnya" -- setiap field selisih di seluruh form (manager_resto,
 * ita, accounting) sudah dipaksa `wajibJika` (forms/validasi.ts) mengharuskan
 * field penyebab terisi SEBELUM submit bisa lolos sama sekali, jadi kondisi
 * "selisih tanpa penyebab" sudah dicegah di lapisan validasi, bukan tidak
 * ditangani. Dicatat sebagai keputusan desain di docs/PROGRESS.md, bukan
 * dibiarkan diam-diam.
 */
export function warnaOtomatis(urgensiTerburuk: number | null, terlambat: boolean): Warna {
  if (urgensiTerburuk === 1) return 'merah';
  if (terlambat || urgensiTerburuk !== null) return 'kuning';
  return 'hijau';
}
