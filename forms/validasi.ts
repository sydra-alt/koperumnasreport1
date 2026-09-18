import { z } from 'zod';
import type { Field, FieldType, FormSchema } from './types';
import { hariISOWIB } from '../lib/tanggal';

/** Blok yang benar-benar berlaku hari ini -- `hanyaHari` menyaring blok yang
 * cuma muncul hari tertentu (mis. Stock Opname Senin, forms/f16-ita.ts).
 * Dipakai FormRenderer (tampilan) DAN buildZodSchema (validasi) supaya
 * keduanya selalu sinkron -- field di blok yang sedang tersembunyi tidak
 * pernah dituntut wajib. */
export function blokBerlakuHariIni(schema: FormSchema, tanggal = new Date()): FormSchema['blocks'] {
  const hariIni = hariISOWIB(tanggal);
  return schema.blocks.filter((b) => !b.hanyaHari || b.hanyaHari.includes(hariIni));
}

function skemaPerField(f: Field): z.ZodTypeAny {
  switch (f.type) {
    case 'angka':
    case 'uang':
      return f.wajib
        ? z.number({ error: `${f.label} wajib diisi` })
        : z.number().optional();
    case 'teks':
    case 'teks_panjang':
      return f.wajib ? z.string().min(1, `${f.label} wajib diisi`) : z.string().optional();
    case 'ya_tidak':
      if (f.wajibYa) return z.literal('ya', { error: `${f.label} wajib dicentang` });
      return f.wajib ? z.string().min(1, `${f.label} wajib dipilih`) : z.string().optional();
    case 'pilih':
    case 'status_warna':
      return f.wajib ? z.string().min(1, `${f.label} wajib dipilih`) : z.string().optional();
    case 'centang':
      return z.boolean().optional();
    case 'tabel':
      return z.array(z.record(z.string(), z.unknown())).optional();
    case 'lampiran':
      return z.array(z.object({ nama: z.string() })).optional();
  }
}

/** Diekspor juga untuk FormRenderer (peta kemajuan §5 DESIGN.md) -- "selesai" satu bagian dihitung dari fungsi yang SAMA dengan validasi wajib, bukan logika kedua yang bisa melenceng. */
export function terisi(type: FieldType, nilai: unknown): boolean {
  switch (type) {
    case 'centang':
      return nilai === true;
    case 'ya_tidak':
      // "terisi" berarti jawabannya YA -- kalau user jawab "tidak", tidak masuk akal
      // menuntut bukti untuk sesuatu yang dia bilang tidak dikerjakan.
      return nilai === 'ya';
    case 'pilih':
    case 'status_warna':
      return typeof nilai === 'string' && nilai.length > 0;
    case 'teks':
    case 'teks_panjang':
      return typeof nilai === 'string' && nilai.trim().length > 0;
    case 'angka':
    case 'uang':
      return typeof nilai === 'number' && nilai > 0;
    case 'tabel':
      return Array.isArray(nilai) && nilai.length > 0;
    default:
      return Boolean(nilai);
  }
}

function kataKerja(type: FieldType): string {
  if (type === 'centang') return 'dicentang';
  if (type === 'pilih' || type === 'ya_tidak' || type === 'status_warna') return 'dipilih';
  return 'diisi';
}

/** Skema zod dinamis: satu field + syarat bukti wajib, dibangun dari `FormSchema`. */
export function buildZodSchema(schema: FormSchema) {
  const shape: Record<string, z.ZodTypeAny> = {};
  const buktiShape: Record<string, z.ZodTypeAny> = {};

  // Field di blok `hanyaHari` yang tidak berlaku hari ini TETAP dimasukkan ke
  // shape (data lama dari hari lain tidak boleh ditolak zod), tapi TIDAK
  // dituntut wajib/bukti -- lihat loop superRefine di bawah, yang cuma
  // memeriksa blok yang berlaku hari ini.
  for (const block of schema.blocks) {
    for (const f of block.fields) {
      shape[f.key] = skemaPerField(f);
      if (f.buktiWajib) {
        // Tabel+buktiPerBaris: satu bukti PER BARIS, kunci dinamis (id baris)
        // -- bentuknya record, bukan array tetap seperti field biasa (lihat
        // forms/types.ts komentar buktiPerBaris dan Tabel.tsx).
        buktiShape[f.key] =
          f.type === 'tabel' && f.buktiPerBaris
            ? z.record(z.string(), z.array(z.object({ nama: z.string() }))).optional()
            : z.array(z.object({ nama: z.string() })).optional();
      }
    }
  }

  const dasar = z.object({ ...shape, _bukti: z.object(buktiShape).optional() });

  return dasar.superRefine((val, ctx) => {
    const record = val as Record<string, unknown>;
    const bukti = (record._bukti as Record<string, unknown> | undefined) ?? {};
    for (const block of blokBerlakuHariIni(schema)) {
      for (const f of block.fields) {
        if (f.buktiWajib && f.type === 'tabel' && f.buktiPerBaris) {
          const buktiPerBarisField = (bukti[f.key] as Record<string, { nama: string }[]> | undefined) ?? {};
          const baris = (record[f.key] as Record<string, unknown>[] | undefined) ?? [];
          baris.forEach((b, i) => {
            for (const k of f.kolom ?? []) {
              if (!k.wajib) continue;
              const nilai = b[k.key];
              const kosong = typeof nilai === 'string' ? nilai.trim().length === 0 : nilai == null;
              if (kosong) {
                ctx.addIssue({ code: 'custom', path: [f.key, i, k.key], message: `${k.label} wajib diisi` });
              }
            }
            const kunciBaris = typeof b.kunci === 'string' ? b.kunci : null;
            const jumlahBukti = kunciBaris ? (buktiPerBarisField[kunciBaris]?.length ?? 0) : 0;
            if (jumlahBukti === 0) {
              ctx.addIssue({ code: 'custom', path: [f.key, i], message: `Baris ${i + 1} pada "${f.label}" belum ada bukti` });
            }
          });
          continue;
        }
        if (f.buktiWajib) {
          const isiTerisi = terisi(f.type, record[f.key]);
          const jumlahBukti = (bukti[f.key] as { nama: string }[] | undefined)?.length ?? 0;
          if (isiTerisi && jumlahBukti === 0) {
            ctx.addIssue({
              code: 'custom',
              path: [f.key],
              message: `${f.label} ${kataKerja(f.type)} tapi belum ada bukti`,
            });
          }
        }
        if (f.wajibJika && record[f.wajibJika.field] === f.wajibJika.nilai && !terisi(f.type, record[f.key])) {
          ctx.addIssue({
            code: 'custom',
            path: [f.key],
            message: `${f.label} wajib diisi kalau ada selisih`,
          });
        }
      }
    }
  });
}
