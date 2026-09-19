import type { AssignmentRingkas, TugasHariIni } from './tugasHariIni';

/**
 * Urgensi tugas di Beranda (redesign 19 September 2026) -- fungsi MURNI,
 * tanpa impor runtime (hanya tipe), supaya bisa diuji langsung dari skrip
 * Node. TIDAK mengubah `hitungTugasHariIni`: tugas dari sana dipakai apa
 * adanya, di sini cuma DITAMBAH informasi batas waktu untuk urutan dan warna.
 *
 * Kenapa perlu: `TugasHariIni` tidak memuat jam batas (hanya `label` teks,
 * dan untuk draft cuma "tersimpan, belum dikirim" -- tanpa batas sama
 * sekali). Batas dihitung ulang lewat `batasUntuk` yang dipasok pemanggil
 * (halaman memakai `batasJamKirim` PERSIS seperti `hitungTugasHariIni`),
 * jadi tidak ada aturan batas baru yang ditulis di sini.
 *
 * Warna (aturan CEO): MERAH hanya untuk yang SUDAH lewat batas; AMBER untuk
 * yang mendekati; selain itu netral. Ambang "mendekati" bawaan 60 menit,
 * bisa ditimpa `policy.tugas_mendekati_batas_menit` (kunci belum ada di
 * database -- bawaan berlaku sampai ada yang mengisinya lewat Admin).
 */
export const AMBANG_MENDEKATI_BAWAAN_MENIT = 60;

export type Urgensi = 'lewat' | 'mendekati' | 'santai';

export interface TugasDenganUrgensi extends TugasHariIni {
  /** 'HH:mm' WIB, null kalau batasnya tidak bisa ditentukan. */
  batas: string | null;
  /** Menit sampai batas; NEGATIF = sudah lewat; null = batas tidak diketahui. */
  sisaMenit: number | null;
  urgensi: Urgensi;
}

export function menitDariJam(hhmm: string): number {
  const [j, m] = hhmm.split(':').map(Number);
  return j * 60 + m;
}

/**
 * sisa < 0            -> 'lewat'      (BARU merah setelah lewat -- persis di jam batas masih 'mendekati')
 * 0 <= sisa <= ambang -> 'mendekati'
 * selain itu          -> 'santai'     (termasuk batas tidak diketahui -- jangan menakut-nakuti tanpa dasar)
 */
export function tentukanUrgensi(sisaMenit: number | null, ambangMenit: number): Urgensi {
  if (sisaMenit === null) return 'santai';
  if (sisaMenit < 0) return 'lewat';
  if (sisaMenit <= ambangMenit) return 'mendekati';
  return 'santai';
}

export interface OpsiUrgensi {
  assignments: AssignmentRingkas[];
  jamSekarang: string; // 'HH:mm' WIB
  ambangMenit: number;
  /** Batas 'HH:mm' untuk form + shift (pakai batasJamKirim, sama dengan hitungTugasHariIni). */
  batasUntuk: (formKey: string, shiftId: string | null) => string;
  /** Susun label scope PERSIS seperti hitungTugasHariIni: [nama lokasi/outlet, nama shift].filter(Boolean).join(' · ') || null */
  labelScope: (a: AssignmentRingkas) => string | null;
}

export function tambahUrgensi(tugas: TugasHariIni[], opsi: OpsiUrgensi): TugasDenganUrgensi[] {
  const sekarang = menitDariJam(opsi.jamSekarang);
  return tugas.map((t) => {
    if (t.status === 'selesai') return { ...t, batas: null, sisaMenit: null, urgensi: 'santai' as const };
    // personal_marketing berasal dari peran (bukan assignment) -> tanpa shift.
    // Lainnya: cari assignment yang label scope-nya sama dengan tugas ini.
    const a = t.formKey === 'personal_marketing'
      ? undefined
      : opsi.assignments.find((x) => x.form_key === t.formKey && opsi.labelScope(x) === t.scopeLabel);
    const batas = opsi.batasUntuk(t.formKey, a?.shift_id ?? null);
    const sisaMenit = menitDariJam(batas) - sekarang;
    return { ...t, batas, sisaMenit, urgensi: tentukanUrgensi(sisaMenit, opsi.ambangMenit) };
  });
}

/** Paling mendesak dulu: paling terlambat, lalu batas terdekat; batas tidak diketahui paling akhir; urutan asal dipertahankan untuk yang sama. */
export function urutkanBerdasarkanBatas<T extends { sisaMenit: number | null }>(daftar: T[]): T[] {
  return daftar
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const sa = a.t.sisaMenit;
      const sb = b.t.sisaMenit;
      if (sa === null && sb === null) return a.i - b.i;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return sa - sb || a.i - b.i;
    })
    .map((x) => x.t);
}
