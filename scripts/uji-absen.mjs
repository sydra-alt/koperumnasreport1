#!/usr/bin/env node
// Uji fungsi murni presensi (lib/absen.ts) -- direplikasi 1:1 di sini karena
// skrip .mjs tidak bisa mengimpor TypeScript langsung tanpa loader tambahan
// (pola sama uji-terlambat-workday.mjs/uji-tugas-beranda.mjs/uji-nav-mobile.mjs
// -- risiko drift dari implementasi asli, harus dicek ulang manual kalau
// lib/absen.ts berubah).

const R = 6371000;
function jarakHaversineMeter(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function urutkanTitikTerdekat(titik, lat, lon) {
  return titik.map((t) => ({ ...t, jarakMeter: jarakHaversineMeter(lat, lon, t.latitude, t.longitude) })).sort((a, b) => a.jarakMeter - b.jarakMeter);
}
function hitungTerlambatMenit(jamMasuk, jamSekarang, toleransiMenit) {
  const [jm, mm] = jamMasuk.split(':').map(Number);
  const [js, ms] = jamSekarang.split(':').map(Number);
  const menitMasuk = jm * 60 + mm;
  const menitSekarang = js * 60 + ms;
  const selisih = menitSekarang - menitMasuk - toleransiMenit;
  return selisih > 0 ? selisih : 0;
}
function statusDariJarak(jarakMeter, radiusMeter) {
  return jarakMeter <= radiusMeter ? 'valid' : 'di_luar_radius';
}

const hasil = [];
function cek(nama, aktual, harapan) {
  const lolos = JSON.stringify(aktual) === JSON.stringify(harapan);
  hasil.push({ skenario: nama, harapan: JSON.stringify(harapan), aktual: JSON.stringify(aktual), 'lolos?': lolos ? 'LOLOS' : 'GAGAL' });
}

// Jarak nol untuk titik sama persis
cek('jarak titik sama persis', Math.round(jarakHaversineMeter(-6.914744, 107.60981, -6.914744, 107.60981)), 0);

// 1 derajat lintang di ekuator ~111.19 km -- cek dalam toleransi wajar (haversine, radius rata-rata)
const satuDerajat = jarakHaversineMeter(0, 0, 1, 0);
cek('1 derajat lintang di ekuator ~111km', satuDerajat > 110000 && satuDerajat < 112000, true);

// Titik contoh dokumen vs titik 200m offset kecil (~0.0018 derajat lintang ~ 200m) harus > radius default
const dekat = jarakHaversineMeter(-6.914744, 107.60981, -6.9145, 107.60981);
cek('offset kecil ~27m < radius 200m -> valid', statusDariJarak(dekat, 200), 'valid');

const jauh = jarakHaversineMeter(-6.914744, 107.60981, -6.918, 107.60981);
cek('offset besar (~360m) > radius 200m -> di_luar_radius', statusDariJarak(jauh, 200), 'di_luar_radius');

cek('status tepat di batas radius (jarak==radius) -> valid', statusDariJarak(200, 200), 'valid');

// urutkanTitikTerdekat: 2 titik, satu lebih dekat
const titikA = { id: 'a', nama: 'Jauh', latitude: -6.92, longitude: 107.61, radiusMeter: 200, jamMasuk: null, jamPulang: null };
const titikB = { id: 'b', nama: 'Dekat', latitude: -6.914744, longitude: 107.60981, radiusMeter: 200, jamMasuk: null, jamPulang: null };
const urut = urutkanTitikTerdekat([titikA, titikB], -6.914744, 107.60981);
cek('titik terdekat terpilih pertama', urut[0].id, 'b');
cek('jarak titik sendiri (b) mendekati 0', Math.round(urut[0].jarakMeter), 0);

// hitungTerlambatMenit
cek('datang sebelum jam masuk -> 0', hitungTerlambatMenit('08:00', '07:50', 15), 0);
cek('datang tepat jam masuk -> 0', hitungTerlambatMenit('08:00', '08:00', 15), 0);
cek('datang dalam toleransi (08:10, toleransi 15) -> 0', hitungTerlambatMenit('08:00', '08:10', 15), 0);
cek('datang PERSIS di batas toleransi (08:15) -> 0', hitungTerlambatMenit('08:00', '08:15', 15), 0);
cek('datang 1 menit lewat toleransi (08:16) -> 1', hitungTerlambatMenit('08:00', '08:16', 15), 1);
cek('datang jauh lewat (09:30) -> 75', hitungTerlambatMenit('08:00', '09:30', 15), 75);

console.table(hasil);
const semuaLolos = hasil.every((h) => h['lolos?'] === 'LOLOS');
console.log(semuaLolos ? '\n✅ SEMUA LOLOS' : '\n🛑 ADA YANG GAGAL');
process.exit(semuaLolos ? 0 : 1);
