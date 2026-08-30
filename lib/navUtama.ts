import type { FormSchema } from '../forms/types';
import { tabLaporDinamis, type AssignmentRingkas } from './navLapor';

export interface TabNav {
  key: string;
  label: string;
  href: string;
}

interface TabTetapDef {
  key: string;
  label: string;
  href: string;
  peran: string | string[] | null; // null = selalu tampil untuk yang sudah login
}

/**
 * Satu daftar tab tetap, dipakai TopNav (semua yang berhak, tanpa batas) dan
 * BottomNav (Beranda + 2-3 prioritas teratas + Akun, lihat `tabBawah()`) --
 * SATU sumber, bukan didefinisikan dua kali (Task tampilan mobile, 24
 * Agustus 2026). `key: 'keputusan'` diperbaiki ke `['ceo','pusat']` (dulu
 * cuma `'ceo'`) -- ditemukan saat menulis ulang nav ini: `Terlindungi` di
 * `app/keputusan/page.tsx` dan RLS `dec_select` (Task 19) SUDAH mengizinkan
 * `pusat` melihat antrean, tapi tab navigasinya sendiri tidak pernah
 * menampilkannya ke Sabrina -- dia tidak akan pernah menemukan halaman itu
 * lewat menu, walau berhak membukanya.
 *
 * `absen` di daftar ini HANYA dipakai TopNav (desktop, tidak diubah 30
 * Agustus 2026) -- di BottomNav tombolnya sendiri yang bundar & terpisah
 * (`components/AbsenFab.tsx`), `tabBawah()`/`tabLuapan()` sengaja
 * mengecualikannya dari daftar tab biasa supaya tidak dobel.
 */
const TAB_TETAP: TabTetapDef[] = [
  { key: 'beranda', label: 'Beranda', href: '/', peran: null },
  { key: 'absen', label: 'Absen', href: '/absen', peran: null },
  { key: 'riwayat', label: 'Laporan Saya', href: '/riwayat', peran: null },
  { key: 'lapor', label: 'Lapor', href: '/lapor/personal_marketing', peran: 'karyawan' },
  { key: 'papan', label: 'Papan Kontrol', href: '/papan', peran: ['ceo', 'pusat'] },
  { key: 'keputusan', label: 'Keputusan', href: '/keputusan', peran: ['ceo', 'pusat'] },
  { key: 'marketing', label: 'Marketing', href: '/marketing', peran: ['kontrol_marketing', 'ceo', 'pusat'] },
  { key: 'terpusat', label: 'Terpusat', href: '/terpusat', peran: ['pusat', 'ceo'] },
  { key: 'admin', label: 'Admin', href: '/admin', peran: 'ceo' },
  // Shabita (accounting) login lalu tidak punya jalan ke mana-mana selain
  // form (ditemukan user, 30 Agustus 2026) -- 'keuangan' SATU-satunya tab
  // tetap yang menyertakan 'accounting' di daftar perannya.
  { key: 'keuangan', label: 'Keuangan', href: '/keuangan', peran: ['accounting', 'ceo'] },
  { key: 'akun', label: 'Akun', href: '/akun', peran: null },
];

/** Semua tab yang berhak dilihat user ini -- dipakai TopNav apa adanya, dan bahan baku `tabBawah()`. */
export function tabTerlihat(
  roles: string[],
  assignments: AssignmentRingkas[],
  formRegistry: Record<string, FormSchema>,
  divisi: string | null = null,
): TabNav[] {
  const tetap = TAB_TETAP.filter(
    (t) => t.peran === null || (Array.isArray(t.peran) ? t.peran : [t.peran]).some((p) => roles.includes(p)),
  );
  const dinamis = tabLaporDinamis(assignments, formRegistry).map((t, i) => ({ key: `lapor-dinamis-${i}-${t.href}`, ...t }));
  // "Tinjau Absensi" (presensi) -- ceo/pusat, ATAU kadiv KHUSUS divisi HRD
  // (role 'kadiv' generik dipegang banyak kepala divisi lain, jadi tidak
  // bisa dinyatakan lewat `peran` biasa seperti tab di TAB_TETAP -- sama
  // alasan dengan `is_hrd_kadiv()` di RLS, lihat migrasi 0022_presensi.sql).
  const bolehTinjauAbsen = roles.includes('ceo') || roles.includes('pusat') || (roles.includes('kadiv') && divisi === 'HRD');
  const tinjau: TabNav[] = bolehTinjauAbsen ? [{ key: 'absen-tinjau', label: 'Tinjau Absensi', href: '/absen/tinjau' }] : [];
  return [...tetap, ...dinamis, ...tinjau];
}

/**
 * Urutan prioritas SLOT TENGAH nav bawah (§2 06-RENCANA-PRESENSI-MOBILE.md)
 * -- Beranda dan Akun SELALU dua slot tetap (awal & akhir); sisanya diisi
 * dari daftar ini urut prioritas -- yang KALAH prioritas TETAP bisa dibuka
 * lewat halaman Akun (`app/akun/page.tsx`), bukan hilang.
 *
 * `absen` TIDAK ADA di daftar ini sama sekali (30 Agustus 2026, redesain
 * tombol bundar) -- bukan lagi tab yang bersaing prioritas, sekarang tombol
 * TERPISAH di tengah nav (lihat `tabBawah` param `punyaTitikAbsen` dan
 * `components/AbsenFab.tsx`). Karena satu slot visual dipakai tombol itu,
 * jumlah slot tengah yang bersaing turun dari 3 jadi 2 SELAMA tombolnya
 * tampil -- `terpusat` dinaikkan di atas `keputusan` supaya CEO/Pusat tetap
 * dapat Papan+Terpusat di 2 slot itu (Keputusan pindah ke Akun, instruksi
 * eksplisit user). Urutan sisanya (absen-tinjau/lapor/riwayat/marketing/
 * admin) TIDAK diubah dari sebelumnya -- minim disrupsi ke kombinasi peran
 * yang sudah diuji (Fauzy: Lapor+Riwayat tetap menang lawan Marketing).
 *
 * `keuangan` (30 Agustus 2026) DITARUH PALING BAWAH sengaja -- untuk
 * Shabita (accounting, TANPA ceo/pusat) kandidatnya cuma lapor+riwayat+
 * keuangan (persis 3), semuanya muat berapa pun urutannya; untuk CEO,
 * menaruhnya rendah memastikan TIDAK PERNAH menggeser Papan/Terpusat yang
 * sudah diuji sungguhan di HP.
 */
const PRIORITAS_TENGAH = ['papan', 'terpusat', 'keputusan', 'absen-tinjau', 'lapor', 'riwayat', 'marketing', 'admin', 'keuangan'];

function prioritasDari(key: string): number {
  const dasar = key.startsWith('lapor-dinamis-') ? 'lapor' : key;
  const idx = PRIORITAS_TENGAH.indexOf(dasar);
  return idx === -1 ? PRIORITAS_TENGAH.length : idx;
}

function tengahTerurut(semua: TabNav[]): TabNav[] {
  return semua
    .filter((t) => t.key !== 'beranda' && t.key !== 'akun' && t.key !== 'absen')
    .slice()
    .sort((a, b) => prioritasDari(a.key) - prioritasDari(b.key));
}

/**
 * Nav bawah: Beranda + (2 atau 3, urut prioritas) + Akun.
 * `punyaTitikAbsen` -- `true` kalau user punya >=1 `penugasan_absen`
 * (lihat `lib/api/absensi.ts`, `useTitikAbsenSaya`): tombol bundar Absen
 * tampil DI LUAR daftar ini (disisipkan terpisah oleh `KopHalaman.tsx`),
 * jadi cuma 2 slot tengah biasa yang tersisa. `false` -- presensi tidak
 * berlaku untuk orang ini (belum/tidak ditugaskan ke titik mana pun):
 * TIDAK ADA tombol bundar sama sekali ("jangan tampilkan tombol yang tidak
 * berlaku untuknya", instruksi eksplisit user) -- slotnya kembali jadi 3
 * tab biasa, persis nav bawah sebelum tombol bundar ada.
 */
export function tabBawah(semua: TabNav[], punyaTitikAbsen: boolean): TabNav[] {
  const beranda = semua.find((t) => t.key === 'beranda');
  const akun = semua.find((t) => t.key === 'akun');
  const jumlahSlot = punyaTitikAbsen ? 2 : 3;

  const hasil: TabNav[] = [];
  if (beranda) hasil.push(beranda);
  hasil.push(...tengahTerurut(semua).slice(0, jumlahSlot));
  if (akun) hasil.push(akun);
  return hasil;
}

/** Tab yang KALAH prioritas dan tidak muat di nav bawah -- ditampilkan sebagai tautan tambahan di halaman Akun. */
export function tabLuapan(semua: TabNav[], punyaTitikAbsen: boolean): TabNav[] {
  const jumlahSlot = punyaTitikAbsen ? 2 : 3;
  return tengahTerurut(semua).slice(jumlahSlot);
}
