#!/usr/bin/env node
// Uji lib/navUtama.ts (nav bawah, §2 06-RENCANA-PRESENSI-MOBILE.md) --
// fungsi murni, direplikasi 1:1 di sini (alasan sama dengan skrip uji
// murni lain di proyek ini -- .mjs tidak bisa mengimpor TypeScript
// langsung tanpa loader tambahan). registry form SINTETIS.

const FORM_REGISTRY = {
  pic_lokasi: { nama: 'Laporan Lokasi', navLabel: 'Lapor Lokasi' },
  security: { nama: 'Laporan Keamanan', navLabel: 'Lapor Keamanan' },
};

const TAB_TETAP = [
  { key: 'beranda', label: 'Beranda', href: '/', peran: null },
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

function tabTerlihat(roles, assignments, formRegistry) {
  const tetap = TAB_TETAP.filter((t) => t.peran === null || (Array.isArray(t.peran) ? t.peran : [t.peran]).some((p) => roles.includes(p)));
  const dinamis = tabLaporDinamis(assignments, formRegistry).map((t, i) => ({ key: `lapor-dinamis-${i}-${t.href}`, ...t }));
  return [...tetap, ...dinamis];
}

const PRIORITAS_TENGAH = ['papan', 'keputusan', 'terpusat', 'lapor', 'riwayat', 'marketing', 'admin'];
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

console.log('\n════ Contoh eksplisit dokumen -- karyawan biasa (tanpa pic_lokasi) ════');
const semuaKaryawan = tabTerlihat(['karyawan'], [], FORM_REGISTRY);
const bawahKaryawan = tabBawah(semuaKaryawan);
cek(labelJoin(bawahKaryawan) === 'Beranda · Lapor · Laporan Saya · Akun', `dapat "${labelJoin(bawahKaryawan)}" (harap "Beranda · Lapor · Laporan Saya · Akun")`);
cek(bawahKaryawan.length === 4, `4 tombol (dapat ${bawahKaryawan.length})`);

console.log('\n════ Contoh eksplisit dokumen -- CEO (Putri, TANPA role karyawan lagi) ════');
const semuaCeo = tabTerlihat(['ceo'], [], FORM_REGISTRY);
const bawahCeo = tabBawah(semuaCeo);
cek(labelJoin(bawahCeo) === 'Beranda · Papan Kontrol · Keputusan · Terpusat · Akun', `dapat "${labelJoin(bawahCeo)}" (harap "Beranda · Papan Kontrol · Keputusan · Terpusat · Akun")`);
cek(bawahCeo.length === 5, `5 tombol, pas batas maksimal (dapat ${bawahCeo.length})`);
const luapanCeo = tabLuapan(semuaCeo);
// "Laporan Saya" peran:null -- SELALU kandidat, ikut kalah prioritas juga (bukan cuma Marketing/Admin).
cek(
  labelJoin(luapanCeo) === 'Laporan Saya · Marketing · Admin',
  `Laporan Saya/Marketing/Admin TIDAK hilang, cuma pindah ke luapan Akun (dapat "${labelJoin(luapanCeo)}")`,
);

console.log('\n════ Perbaikan bug -- Pusat (role pusat) sekarang BISA lihat tab Keputusan ════');
const semuaPusatSaja = tabTerlihat(['pusat'], [], FORM_REGISTRY);
cek(semuaPusatSaja.some((t) => t.key === 'keputusan'), 'tab Keputusan MUNCUL utk role pusat (dulu cuma ceo -- Sabrina tidak pernah bisa membukanya lewat menu)');

console.log('\n════ Sabrina sungguhan (pusat + kadiv + karyawan) -- 5 kandidat tengah, oversight menang atas Lapor/Riwayat ════');
const semuaSabrina = tabTerlihat(['pusat', 'kadiv', 'karyawan'], [], FORM_REGISTRY);
const bawahSabrina = tabBawah(semuaSabrina);
cek(labelJoin(bawahSabrina) === 'Beranda · Papan Kontrol · Keputusan · Terpusat · Akun', `Lapor/Laporan Saya kalah prioritas dari Papan/Keputusan/Terpusat (dapat "${labelJoin(bawahSabrina)}")`);
const luapanSabrina = tabLuapan(semuaSabrina);
// role pusat JUGA mengqualifikasi Marketing (peran: ['kontrol_marketing','ceo','pusat']) -- ikut keluapan bareng Lapor/Laporan Saya.
cek(
  labelJoin(luapanSabrina) === 'Lapor · Laporan Saya · Marketing',
  `Lapor/Laporan Saya/Marketing tetap ada, di Akun (dapat "${labelJoin(luapanSabrina)}")`,
);

console.log('\n════ Dadang (pic_lokasi + karyawan, tab Lapor dinamis) ════');
const semuaDadang = tabTerlihat(['pic_lokasi', 'karyawan'], [{ form_key: 'pic_lokasi' }], FORM_REGISTRY);
const bawahDadang = tabBawah(semuaDadang);
cek(
  labelJoin(bawahDadang) === 'Beranda · Lapor · Lapor Lokasi · Laporan Saya · Akun',
  `tab dinamis "Lapor Lokasi" ikut prioritas "lapor", 3 kandidat semua muat (dapat "${labelJoin(bawahDadang)}")`,
);
cek(bawahDadang.length === 5, `5 tombol total termasuk Akun (dapat ${bawahDadang.length})`);

console.log('\n════ Kontrol Marketing (Fauzy: kontrol_marketing + karyawan) ════');
const semuaFauzy = tabTerlihat(['kontrol_marketing', 'karyawan'], [], FORM_REGISTRY);
const bawahFauzy = tabBawah(semuaFauzy);
cek(labelJoin(bawahFauzy) === 'Beranda · Lapor · Laporan Saya · Marketing · Akun', `3 kandidat semua muat, tidak ada yang keluapan (dapat "${labelJoin(bawahFauzy)}")`);

console.log(process.exitCode ? '\n❌ ADA YANG GAGAL' : '\n✅ SEMUA LOLOS');
