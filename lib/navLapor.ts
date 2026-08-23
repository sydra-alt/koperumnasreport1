import type { FormSchema } from '../forms/types';

export interface AssignmentRingkas {
  form_key: string;
}

export interface TabLapor {
  label: string;
  href: string;
}

/**
 * Tab "Lapor ..." dibangun dari `assignment`, bukan daftar tetap di kode --
 * satu sumber yang sama nanti dipakai Papan Kontrol (Task 18). Dipisah jadi
 * fungsi murni (bukan inline di KopHalaman.tsx) supaya bisa diuji langsung
 * tanpa render React/DOM.
 *
 * `personal_marketing` SENGAJA tidak lewat sini -- itu kewajiban SEMUA
 * karyawan (bukan assignment per-orang, lihat 0003_seed.sql), sudah dicakup
 * tab tetap berbasis peran `karyawan` di KopHalaman.tsx.
 *
 * Beberapa baris assignment dengan `form_key` sama (mis. PIC 2 lokasi, atau
 * satpam 2 shift) disatukan jadi SATU tab -- pemilihan lokasi/shift terjadi
 * di dalam form itu sendiri (`LaporForm.tsx`), bukan satu tab per baris.
 * `form_key` yang belum ada schema-nya di `formRegistry` (mis. 'accounting'
 * sebelum Task 17) dilewati -- tidak menampilkan tab ke rute yang belum ada.
 */
export function tabLaporDinamis(assignments: AssignmentRingkas[], formRegistry: Record<string, FormSchema>): TabLapor[] {
  const formKeyDitugaskan = Array.from(new Set(assignments.map((a) => a.form_key)));
  return formKeyDitugaskan
    .filter((k) => k !== 'personal_marketing' && formRegistry[k])
    .map((k) => ({ label: formRegistry[k].navLabel ?? formRegistry[k].nama, href: `/lapor/${k}` }));
}
