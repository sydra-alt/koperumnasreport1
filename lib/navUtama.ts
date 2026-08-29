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
 * BottomNav (Beranda + 3 prioritas teratas + Akun, lihat `tabBawah()`) --
 * SATU sumber, bukan didefinisikan dua kali (Task tampilan mobile, 24
 * Agustus 2026). `key: 'keputusan'` diperbaiki ke `['ceo','pusat']` (dulu
 * cuma `'ceo'`) -- ditemukan saat menulis ulang nav ini: `Terlindungi` di
 * `app/keputusan/page.tsx` dan RLS `dec_select` (Task 19) SUDAH mengizinkan
 * `pusat` melihat antrean, tapi tab navigasinya sendiri tidak pernah
 * menampilkannya ke Sabrina -- dia tidak akan pernah menemukan halaman itu
 * lewat menu, walau berhak membukanya.
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
 * -- "Papan Kontrol" isinya menyesuaikan peran, maksimal 5 tombol. Beranda
 * dan Akun SELALU dua slot tetap (awal & akhir); sisanya cuma 3 slot,
 * diisi dari daftar ini urut prioritas -- kalau seseorang berhak atas
 * lebih dari 3 (mis. CEO: papan+keputusan+terpusat+marketing+admin = 5
 * kandidat), yang KALAH prioritas TETAP bisa dibuka lewat halaman Akun
 * (lihat `app/akun/page.tsx`), bukan hilang.
 *
 * Urutan ini dipilih supaya cocok PERSIS dengan dua contoh eksplisit di
 * dokumen: karyawan biasa -> Lapor+Riwayat (cuma 2 kandidat, keduanya
 * muat); CEO/Pusat -> Papan+Keputusan+Terpusat (yang menang lawan
 * Marketing/Admin).
 *
 * `absen` DITAMBAH setelah `terpusat` (presensi, 29 Agustus 2026) --
 * dipakai 2x sehari oleh hampir semua karyawan biasa, tapi SENGAJA tidak
 * diletakkan di atas papan/keputusan/terpusat: itu akan menggeser Terpusat
 * keluar dari 3 slot CEO/Pusat (yang sudah teruji sungguhan di HP,
 * Checkpoint 4, 29 Agustus 2026) -- padahal untuk karyawan biasa posisi
 * `absen` relatif terhadap `lapor`/`riwayat` TIDAK PENTING SAMA SEKALI,
 * cuma ada 3 kandidat buat mereka (absen+lapor+riwayat), semuanya muat di
 * 3 slot tengah apa pun urutannya. `absen-tinjau` (Tinjau Absensi, buat
 * ceo/pusat/kadiv-HRD) ditaruh sesudahnya -- dipakai sesekali, bukan harian.
 */
const PRIORITAS_TENGAH = ['papan', 'keputusan', 'terpusat', 'absen', 'absen-tinjau', 'lapor', 'riwayat', 'marketing', 'admin'];

function prioritasDari(key: string): number {
  const dasar = key.startsWith('lapor-dinamis-') ? 'lapor' : key;
  const idx = PRIORITAS_TENGAH.indexOf(dasar);
  return idx === -1 ? PRIORITAS_TENGAH.length : idx;
}

/** Nav bawah: Beranda + (maksimal 3, urut prioritas) + Akun. */
export function tabBawah(semua: TabNav[]): TabNav[] {
  const beranda = semua.find((t) => t.key === 'beranda');
  const akun = semua.find((t) => t.key === 'akun');
  const tengah = semua
    .filter((t) => t.key !== 'beranda' && t.key !== 'akun')
    .slice()
    .sort((a, b) => prioritasDari(a.key) - prioritasDari(b.key));

  const hasil: TabNav[] = [];
  if (beranda) hasil.push(beranda);
  hasil.push(...tengah.slice(0, 3));
  if (akun) hasil.push(akun);
  return hasil;
}

/** Tab yang KALAH prioritas dan tidak muat di nav bawah -- ditampilkan sebagai tautan tambahan di halaman Akun. */
export function tabLuapan(semua: TabNav[]): TabNav[] {
  const tengah = semua
    .filter((t) => t.key !== 'beranda' && t.key !== 'akun')
    .slice()
    .sort((a, b) => prioritasDari(a.key) - prioritasDari(b.key));
  return tengah.slice(3);
}
