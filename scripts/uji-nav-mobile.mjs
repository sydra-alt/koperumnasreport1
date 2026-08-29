#!/usr/bin/env node
// Uji lib/navUtama.ts (nav bawah, §2 06-RENCANA-PRESENSI-MOBILE.md) --
// fungsi murni, direplikasi 1:1 di sini (alasan sama dengan skrip uji
// murni lain di proyek ini -- .mjs tidak bisa mengimpor TypeScript
// langsung tanpa loader tambahan). registry form SINTETIS.
//
// Diperbarui 29 Agustus 2026 (presensi, §3): tab `absen` (peran:null,
// prioritas tinggi tapi DI BAWAH papan/keputusan/terpusat -- sengaja,
// supaya CEO/Pusat tidak kehilangan Terpusat dari 3 slotnya) dan
// `absen-tinjau` (ceo/pusat/kadiv+divisi=HRD, parameter ke-4 `divisi`
// ditambah ke `tabTerlihat`) ditambahkan -- SEMUA angka/urutan yang
// diharapkan di bawah dihitung ulang manual dulu (bukan disalin dari hasil
// run), baru dicocokkan lewat skrip ini.

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

const PRIORITAS_TENGAH = ['papan', 'keputusan', 'terpusat', 'absen', 'absen-tinjau', 'lapor', 'riwayat', 'marketing', 'admin'];
function prioritasDari(key) {
  const dasar = key.startsWith('lapor-dinamis-') ? 'lapor' : key;
  const idx = PRIORITAS_TENGAH.indexOf(dasar);
  return idx === -1 ? PRIORITAS_TENGAH.length : idx;
}
function tabBawah(semua) {
  const beranda = semua.find((t) => t.key === 'beranda');
  const akun = semua.find((t) => t.key === 'akun');
  const tengah = semua.filter((t) => t.key !== 'beranda' && t.key !== 'akun').slice().sort((a, b) => prioritasDari(a.key) - prioritasDari(b.key));
  const hasil = [];
  if (beranda) hasil.push(beranda);
  hasil.push(...tengah.slice(0, 3));
  if (akun) hasil.push(akun);
  return hasil;
}
function tabLuapan(semua) {
  const tengah = semua.filter((t) => t.key !== 'beranda' && t.key !== 'akun').slice().sort((a, b) => prioritasDari(a.key) - prioritasDari(b.key));
  return tengah.slice(3);
}

function cek(kondisi, pesan) {
  console.log((kondisi ? 'OK: ' : 'SALAH: ') + pesan);
  if (!kondisi) process.exitCode = 1;
}
function labelJoin(daftar) {
  return daftar.map((t) => t.label).join(' · ');
}

console.log('\n════ Karyawan biasa (tanpa pic_lokasi) -- Absen sekarang ikut 3 kandidat ════');
const semuaKaryawan = tabTerlihat(['karyawan'], [], FORM_REGISTRY);
const bawahKaryawan = tabBawah(semuaKaryawan);
cek(labelJoin(bawahKaryawan) === 'Beranda · Absen · Lapor · Laporan Saya · Akun', `dapat "${labelJoin(bawahKaryawan)}"`);
cek(bawahKaryawan.length === 5, `5 tombol, 3 kandidat (absen+lapor+riwayat) semua muat (dapat ${bawahKaryawan.length})`);

console.log('\n════ CEO (Putri, TANPA role karyawan) -- Papan/Keputusan/Terpusat TETAP menang (absen SENGAJA prioritas di bawahnya) ════');
const semuaCeo = tabTerlihat(['ceo'], [], FORM_REGISTRY);
const bawahCeo = tabBawah(semuaCeo);
cek(labelJoin(bawahCeo) === 'Beranda · Papan Kontrol · Keputusan · Terpusat · Akun', `dapat "${labelJoin(bawahCeo)}" -- TIDAK BOLEH berubah oleh penambahan absen`);
const luapanCeo = tabLuapan(semuaCeo);
cek(
  labelJoin(luapanCeo) === 'Absen · Tinjau Absensi · Laporan Saya · Marketing · Admin',
  `Absen+Tinjau Absensi ikut kalah prioritas, tetap ada di Akun (dapat "${labelJoin(luapanCeo)}")`,
);

console.log('\n════ Pusat-only -- tab Keputusan & Tinjau Absensi MUNCUL (RLS dec_select & is_hrd_kadiv mengizinkan pusat) ════');
const semuaPusatSaja = tabTerlihat(['pusat'], [], FORM_REGISTRY);
cek(semuaPusatSaja.some((t) => t.key === 'keputusan'), 'tab Keputusan muncul utk role pusat');
cek(semuaPusatSaja.some((t) => t.key === 'absen-tinjau'), 'tab Tinjau Absensi muncul utk role pusat (bukan cuma ceo/kadiv-HRD)');

console.log('\n════ Sabrina sungguhan (pusat + kadiv + karyawan) -- Papan/Keputusan/Terpusat tetap menang ════');
const semuaSabrina = tabTerlihat(['pusat', 'kadiv', 'karyawan'], [], FORM_REGISTRY, 'HRD');
const bawahSabrina = tabBawah(semuaSabrina);
cek(labelJoin(bawahSabrina) === 'Beranda · Papan Kontrol · Keputusan · Terpusat · Akun', `dapat "${labelJoin(bawahSabrina)}"`);
const luapanSabrina = tabLuapan(semuaSabrina);
cek(
  labelJoin(luapanSabrina) === 'Absen · Tinjau Absensi · Lapor · Laporan Saya · Marketing',
  `Absen/Tinjau Absensi/Lapor/Laporan Saya/Marketing semua tetap ada di Akun (dapat "${labelJoin(luapanSabrina)}")`,
);

console.log('\n════ Dadang (pic_lokasi + karyawan, tab Lapor dinamis) -- Absen menang, Riwayat yang kalah (bukan Lapor Lokasi) ════');
const semuaDadang = tabTerlihat(['pic_lokasi', 'karyawan'], [{ form_key: 'pic_lokasi' }], FORM_REGISTRY);
const bawahDadang = tabBawah(semuaDadang);
cek(
  labelJoin(bawahDadang) === 'Beranda · Absen · Lapor · Lapor Lokasi · Akun',
  `4 kandidat (absen+lapor+lapor-dinamis+riwayat) rebutan 3 slot, Riwayat yang kalah prioritas (dapat "${labelJoin(bawahDadang)}")`,
);
const luapanDadang = tabLuapan(semuaDadang);
cek(labelJoin(luapanDadang) === 'Laporan Saya', `Laporan Saya pindah ke Akun, TETAP ada bukan hilang (dapat "${labelJoin(luapanDadang)}")`);

console.log('\n════ Kontrol Marketing (Fauzy: kontrol_marketing + karyawan) -- Absen menang, Marketing yang kalah ════');
const semuaFauzy = tabTerlihat(['kontrol_marketing', 'karyawan'], [], FORM_REGISTRY);
const bawahFauzy = tabBawah(semuaFauzy);
cek(
  labelJoin(bawahFauzy) === 'Beranda · Absen · Lapor · Laporan Saya · Akun',
  `4 kandidat (absen+lapor+riwayat+marketing), Marketing kalah prioritas (dapat "${labelJoin(bawahFauzy)}")`,
);
cek(labelJoin(tabLuapan(semuaFauzy)) === 'Marketing', 'Marketing pindah ke Akun, tetap ada');

console.log('\n════ Tinjau Absensi -- kadiv+HRD boleh, kadiv+divisi lain TIDAK boleh, karyawan biasa TIDAK boleh ════');
const kadivHrd = tabTerlihat(['kadiv', 'karyawan'], [], FORM_REGISTRY, 'HRD');
cek(kadivHrd.some((t) => t.key === 'absen-tinjau'), 'kadiv + divisi HRD -> tab Tinjau Absensi MUNCUL');
const kadivCs = tabTerlihat(['kadiv', 'karyawan'], [], FORM_REGISTRY, 'CS');
cek(!kadivCs.some((t) => t.key === 'absen-tinjau'), 'kadiv + divisi CS (BUKAN HRD) -> tab Tinjau Absensi TIDAK muncul');
const karyawanBiasaDivisiHrd = tabTerlihat(['karyawan'], [], FORM_REGISTRY, 'HRD');
cek(!karyawanBiasaDivisiHrd.some((t) => t.key === 'absen-tinjau'), 'karyawan biasa di divisi HRD (bukan kadiv) -> tab Tinjau Absensi TIDAK muncul');

console.log(process.exitCode ? '\n❌ ADA YANG GAGAL' : '\n✅ SEMUA LOLOS');
