#!/usr/bin/env node
// Uji lib/navUtama.ts (nav bawah) -- fungsi murni, direplikasi 1:1 di sini
// (alasan sama dengan skrip uji murni lain di proyek ini -- .mjs tidak bisa
// mengimpor TypeScript langsung tanpa loader tambahan). registry form
// SINTETIS.
//
// Diperbarui 30 Agustus 2026 (tombol bundar Absen di tengah nav bawah) --
// `absen` BUKAN LAGI tab yang bersaing prioritas (dihapus dari
// PRIORITAS_TENGAH & dikecualikan eksplisit dari `tengahTerurut`), jadi
// slot tengah turun dari 3 jadi 2 SELAMA `punyaTitikAbsen=true`. `terpusat`
// dinaikkan di atas `keputusan` supaya CEO/Pusat dapat Papan+Terpusat di 2
// slot itu (Keputusan pindah ke Akun, instruksi eksplisit user) --
// SEMUA angka/urutan di bawah dihitung ulang manual dulu, baru dicocokkan.

const FORM_REGISTRY = {
  pic_lokasi: { nama: 'Laporan Lokasi', navLabel: 'Lapor Lokasi' },
  security: { nama: 'Laporan Keamanan', navLabel: 'Lapor Keamanan' },
};

const TAB_TETAP = [
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

function tabLaporDinamis(assignments, formRegistry) {
  const formKeyDitugaskan = Array.from(new Set(assignments.map((a) => a.form_key)));
  return formKeyDitugaskan
    .filter((k) => k !== 'personal_marketing' && formRegistry[k])
    .map((k) => ({ label: formRegistry[k].navLabel ?? formRegistry[k].nama, href: `/lapor/${k}` }));
}

function tabTerlihat(roles, assignments, formRegistry, divisi = null) {
  const tetap = TAB_TETAP.filter((t) => t.peran === null || (Array.isArray(t.peran) ? t.peran : [t.peran]).some((p) => roles.includes(p)));
  const dinamis = tabLaporDinamis(assignments, formRegistry).map((t, i) => ({ key: `lapor-dinamis-${i}-${t.href}`, ...t }));
  const bolehTinjauAbsen = roles.includes('ceo') || roles.includes('pusat') || (roles.includes('kadiv') && divisi === 'HRD');
  const tinjau = bolehTinjauAbsen ? [{ key: 'absen-tinjau', label: 'Tinjau Absensi', href: '/absen/tinjau' }] : [];
  return [...tetap, ...dinamis, ...tinjau];
}

const PRIORITAS_TENGAH = ['papan', 'terpusat', 'keputusan', 'absen-tinjau', 'lapor', 'riwayat', 'marketing', 'admin'];
function prioritasDari(key) {
  const dasar = key.startsWith('lapor-dinamis-') ? 'lapor' : key;
  const idx = PRIORITAS_TENGAH.indexOf(dasar);
  return idx === -1 ? PRIORITAS_TENGAH.length : idx;
}
function tengahTerurut(semua) {
  return semua.filter((t) => t.key !== 'beranda' && t.key !== 'akun' && t.key !== 'absen').slice().sort((a, b) => prioritasDari(a.key) - prioritasDari(b.key));
}
function tabBawah(semua, punyaTitikAbsen) {
  const beranda = semua.find((t) => t.key === 'beranda');
  const akun = semua.find((t) => t.key === 'akun');
  const jumlahSlot = punyaTitikAbsen ? 2 : 3;
  const hasil = [];
  if (beranda) hasil.push(beranda);
  hasil.push(...tengahTerurut(semua).slice(0, jumlahSlot));
  if (akun) hasil.push(akun);
  return hasil;
}
function tabLuapan(semua, punyaTitikAbsen) {
  const jumlahSlot = punyaTitikAbsen ? 2 : 3;
  return tengahTerurut(semua).slice(jumlahSlot);
}

function cek(kondisi, pesan) {
  console.log((kondisi ? 'OK: ' : 'SALAH: ') + pesan);
  if (!kondisi) process.exitCode = 1;
}
function labelJoin(daftar) {
  return daftar.map((t) => t.label).join(' · ');
}

console.log('\n════ Karyawan biasa, PUNYA titik absen -- [ABSEN] di tengah, 2 slot (Lapor kiri, Riwayat kanan) ════');
const semuaKaryawan = tabTerlihat(['karyawan'], [], FORM_REGISTRY);
const bawahKaryawanFab = tabBawah(semuaKaryawan, true);
cek(labelJoin(bawahKaryawanFab) === 'Beranda · Lapor · Laporan Saya · Akun', `dapat "${labelJoin(bawahKaryawanFab)}" (4 elemen -- [ABSEN] disisipkan terpisah oleh KopHalaman, bukan bagian larik ini)`);
cek(bawahKaryawanFab.length === 4, `4 tab biasa (dapat ${bawahKaryawanFab.length}), + 1 tombol bundar = 5 elemen visual total`);

console.log('\n════ Karyawan biasa, TIDAK punya titik absen -- tombol bundar HILANG, kembali 3 slot tab biasa ════');
const bawahKaryawanTanpaFab = tabBawah(semuaKaryawan, false);
cek(labelJoin(bawahKaryawanTanpaFab) === 'Beranda · Lapor · Laporan Saya · Akun', `dapat "${labelJoin(bawahKaryawanTanpaFab)}" (cuma 2 kandidat non-absen, keduanya muat walau 3 slot tersedia)`);

console.log('\n════ CEO (Putri, TANPA role karyawan), PUNYA titik absen -- Papan+[ABSEN]+Terpusat, Keputusan pindah ke Akun ════');
const semuaCeo = tabTerlihat(['ceo'], [], FORM_REGISTRY);
const bawahCeo = tabBawah(semuaCeo, true);
cek(labelJoin(bawahCeo) === 'Beranda · Papan Kontrol · Terpusat · Akun', `dapat "${labelJoin(bawahCeo)}" -- Papan & Terpusat menang, PERSIS instruksi user`);
const luapanCeo = tabLuapan(semuaCeo, true);
cek(
  labelJoin(luapanCeo) === 'Keputusan · Tinjau Absensi · Laporan Saya · Marketing · Admin',
  `Keputusan kalah prioritas, pindah ke Akun (dapat "${labelJoin(luapanCeo)}")`,
);

console.log('\n════ Pusat-only -- tab Keputusan & Tinjau Absensi tetap MUNCUL di daftar lengkap (RLS mengizinkan), walau kalah slot nav bawah ════');
const semuaPusatSaja = tabTerlihat(['pusat'], [], FORM_REGISTRY);
cek(semuaPusatSaja.some((t) => t.key === 'keputusan'), 'tab Keputusan tetap ada di `semua` (RLS dec_select), cuma kalah slot nav bawah');
cek(semuaPusatSaja.some((t) => t.key === 'absen-tinjau'), 'tab Tinjau Absensi tetap ada di `semua` utk role pusat');

console.log('\n════ Sabrina sungguhan (pusat + kadiv + karyawan, divisi HRD), PUNYA titik absen -- pola sama CEO ════');
const semuaSabrina = tabTerlihat(['pusat', 'kadiv', 'karyawan'], [], FORM_REGISTRY, 'HRD');
const bawahSabrina = tabBawah(semuaSabrina, true);
cek(labelJoin(bawahSabrina) === 'Beranda · Papan Kontrol · Terpusat · Akun', `dapat "${labelJoin(bawahSabrina)}"`);
const luapanSabrina = tabLuapan(semuaSabrina, true);
cek(
  labelJoin(luapanSabrina) === 'Keputusan · Tinjau Absensi · Lapor · Laporan Saya · Marketing',
  `sisanya tetap ada di Akun (dapat "${labelJoin(luapanSabrina)}")`,
);

console.log('\n════ Dadang (pic_lokasi + karyawan, tab Lapor dinamis), PUNYA titik absen -- kedua tab Lapor menang, Riwayat kalah (2 slot, bukan 3) ════');
const semuaDadang = tabTerlihat(['pic_lokasi', 'karyawan'], [{ form_key: 'pic_lokasi' }], FORM_REGISTRY);
const bawahDadang = tabBawah(semuaDadang, true);
cek(
  labelJoin(bawahDadang) === 'Beranda · Lapor · Lapor Lokasi · Akun',
  `2 slot tengah penuh oleh Lapor+Lapor Lokasi (dapat "${labelJoin(bawahDadang)}")`,
);
const luapanDadang = tabLuapan(semuaDadang, true);
cek(labelJoin(luapanDadang) === 'Laporan Saya', `Laporan Saya pindah ke Akun -- TETAP ada, bukan hilang (dapat "${labelJoin(luapanDadang)}")`);

console.log('\n════ Kontrol Marketing (Fauzy: kontrol_marketing + karyawan), PUNYA titik absen -- Lapor+Riwayat tetap menang lawan Marketing ════');
const semuaFauzy = tabTerlihat(['kontrol_marketing', 'karyawan'], [], FORM_REGISTRY);
const bawahFauzy = tabBawah(semuaFauzy, true);
cek(labelJoin(bawahFauzy) === 'Beranda · Lapor · Laporan Saya · Akun', `dapat "${labelJoin(bawahFauzy)}" -- Marketing kalah (perilaku lama tidak berubah)`);
cek(labelJoin(tabLuapan(semuaFauzy, true)) === 'Marketing', 'Marketing pindah ke Akun, tetap ada');

console.log('\n════ Tinjau Absensi -- kadiv+HRD boleh, kadiv+divisi lain TIDAK boleh, karyawan biasa TIDAK boleh ════');
cek(tabTerlihat(['kadiv', 'karyawan'], [], FORM_REGISTRY, 'HRD').some((t) => t.key === 'absen-tinjau'), 'kadiv + divisi HRD -> tab Tinjau Absensi MUNCUL');
cek(!tabTerlihat(['kadiv', 'karyawan'], [], FORM_REGISTRY, 'CS').some((t) => t.key === 'absen-tinjau'), 'kadiv + divisi CS (BUKAN HRD) -> tab Tinjau Absensi TIDAK muncul');
cek(!tabTerlihat(['karyawan'], [], FORM_REGISTRY, 'HRD').some((t) => t.key === 'absen-tinjau'), 'karyawan biasa di divisi HRD (bukan kadiv) -> tab Tinjau Absensi TIDAK muncul');

console.log(process.exitCode ? '\n❌ ADA YANG GAGAL' : '\n✅ SEMUA LOLOS');
