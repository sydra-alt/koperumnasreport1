#!/usr/bin/env -S npx tsx
// Uji validasi field 'angka'/'uang' di FormRenderer (18 September 2026,
// ditemukan lewat uji HP sungguhan): <input type="number"> KOSONG -> NaN
// (bukan undefined) lewat valueAsNumber react-hook-form, dan z.number()
// TIDAK menganggap NaN sebagai kosong -- field OPSIONAL yang dikosongkan
// ikut ditolak, dengan pesan Zod mentah pula ("Invalid input: expected
// number, received NaN") yang tidak menyebut field mana.
//
// Jalankan: npx tsx scripts/uji-validasi-form.mts
// (murni logika Zod, tidak menyentuh database -- tidak perlu .env.local)

import { buildZodSchema } from '../forms/validasi';
import type { FormSchema } from '../forms/types';

const hasil: { nomor: number; skenario: string; harapan: string; mentah: string; lolos: boolean }[] = [];
function catat(nomor: number, skenario: string, harapan: string, mentah: string, lolos: boolean) {
  hasil.push({ nomor, skenario, harapan, mentah, lolos });
}

const schema: FormSchema = {
  key: 'uji',
  nama: 'Uji',
  scope: 'user',
  blocks: [
    {
      id: 'blok',
      judul: 'Blok',
      fields: [
        { key: 'target_closing', label: 'Target Closing', type: 'angka', wajib: true },
        { key: 'prospek_aktif', label: 'Prospek Aktif', type: 'angka' },
        { key: 'omzet_sistem', label: 'Omzet Sistem', type: 'uang', wajib: true },
      ],
    },
  ],
};
const zodSchema = buildZodSchema(schema);

// #1 -- field OPSIONAL dikosongkan (NaN, persis nilai yang keluar dari
// Angka.tsx SEBELUM diperbaiki) -- form harus TETAP BISA dikirim.
const r1 = zodSchema.safeParse({ target_closing: 5, prospek_aktif: NaN, omzet_sistem: 100000 });
catat(
  1,
  'field angka OPSIONAL dikosongkan (NaN)',
  'validasi lolos (sukses), prospek_aktif jadi undefined',
  `success=${r1.success}; data=${r1.success ? JSON.stringify(r1.data) : JSON.stringify(r1.error.issues)}`,
  // buildZodSchema membangun shape-nya DINAMIS saat runtime (Record<string,
  // ZodTypeAny>) -- TypeScript tidak bisa tahu key spesifiknya, jadi diakses
  // lewat cast di sini, bukan properti langsung.
  r1.success && (r1.data as Record<string, unknown>).prospek_aktif === undefined,
);

// #2 -- field WAJIB dikosongkan (NaN) -- ditolak, pesan MENYEBUT NAMA field, bukan teks Zod mentah.
const r2 = zodSchema.safeParse({ target_closing: NaN, prospek_aktif: NaN, omzet_sistem: 100000 });
const pesan2 = !r2.success ? r2.error.issues.map((i) => i.message) : [];
catat(
  2,
  'field angka WAJIB dikosongkan (NaN)',
  'ditolak, pesan "Target Closing wajib diisi" -- BUKAN "Invalid input: expected number..."',
  `success=${r2.success}; pesan=${JSON.stringify(pesan2)}`,
  !r2.success && pesan2.includes('Target Closing wajib diisi') && !pesan2.some((p) => p.toLowerCase().includes('invalid input')),
);

// #3 -- field 'uang' WAJIB dikosongkan (NaN) -- sama, pesan berlabel.
const r3 = zodSchema.safeParse({ target_closing: 5, prospek_aktif: undefined, omzet_sistem: NaN });
const pesan3 = !r3.success ? r3.error.issues.map((i) => i.message) : [];
catat(
  3,
  'field uang WAJIB dikosongkan (NaN)',
  'ditolak, pesan "Omzet Sistem wajib diisi"',
  `success=${r3.success}; pesan=${JSON.stringify(pesan3)}`,
  !r3.success && pesan3.includes('Omzet Sistem wajib diisi'),
);

// #4 -- field opsional benar-benar undefined (belum pernah disentuh) -- tetap lolos, seperti sebelumnya.
const r4 = zodSchema.safeParse({ target_closing: 5, prospek_aktif: undefined, omzet_sistem: 100000 });
catat(4, 'field angka opsional undefined (belum disentuh)', 'validasi lolos', `success=${r4.success}`, r4.success);

// #5 -- semua terisi wajar -- tetap lolos (regresi jalur normal).
const r5 = zodSchema.safeParse({ target_closing: 3, prospek_aktif: 7, omzet_sistem: 5000000 });
catat(5, 'semua field terisi wajar', 'validasi lolos', `success=${r5.success}`, r5.success);

console.table(hasil.map((h) => ({ '#': h.nomor, skenario: h.skenario, harapan: h.harapan, 'hasil mentah': h.mentah, 'lolos?': h.lolos ? 'LOLOS' : 'GAGAL' })));
const semuaLolos = hasil.length === 5 && hasil.every((h) => h.lolos);
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
