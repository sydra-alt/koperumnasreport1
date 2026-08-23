/**
 * Sel tabel berupa teks bebas ("Rp 5.000.000", "5000000", dst.) -- ambil
 * angkanya. Dipakai di mana pun tabel `type:'teks'` menyimpan nominal (kolom
 * `tabel` belum punya tipe uang per sel), mis. `sumberKeputusan`
 * (components/LaporForm.tsx) dan rekap cashflow accounting (lib/api/accounting.ts).
 */
export function angkaDariTeks(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 0;
  const bersih = v.replace(/[^0-9-]/g, '');
  const n = Number(bersih);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Sel tabel tanggal berupa teks bebas -- CUMA diterima kalau sudah persis
 * format YYYY-MM-DD, tidak dicoba-parse format lain (mis. "01/09" atau
 * "besok") supaya tidak ada tebakan zona waktu yang bisa meleset -- lihat
 * CLAUDE.md aturan #2, jangan pernah menebak tanggal lewat konversi yang
 * tidak pasti. Kalau tidak cocok, dikosongkan daripada memasukkan tanggal
 * yang salah.
 */
export function tanggalDariTeks(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const cocok = /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
  return cocok ? v.trim() : null;
}
