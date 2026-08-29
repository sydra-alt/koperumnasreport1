/**
 * Fungsi murni presensi (docs/06-RENCANA-PRESENSI-MOBILE.md §3) -- tidak ada
 * dependensi React/Supabase di file ini, supaya diuji langsung lewat skrip
 * Node biasa (pola sama `lib/tugasHariIni.ts`/`lib/tanggal.ts`).
 */

const JARI_JARI_BUMI_METER = 6371000;

/** Jarak antara dua koordinat (derajat) dalam meter, rumus haversine -- cukup untuk skala ini, tidak perlu PostGIS (§3.2). */
export function jarakHaversineMeter(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return JARI_JARI_BUMI_METER * c;
}

export interface TitikAbsen {
  id: string;
  nama: string;
  latitude: number;
  longitude: number;
  radiusMeter: number;
  jamMasuk: string | null; // override per (user, titik) -- null = pakai default policy
  jamPulang: string | null;
}

export interface TitikDenganJarak extends TitikAbsen {
  jarakMeter: number;
}

/** Urutkan titik yang ditugaskan berdasar jarak TERDEKAT dulu -- dipakai untuk auto-pilih + daftar "Ganti". */
export function urutkanTitikTerdekat(titik: TitikAbsen[], lat: number, lon: number): TitikDenganJarak[] {
  return titik
    .map((t) => ({ ...t, jarakMeter: jarakHaversineMeter(lat, lon, t.latitude, t.longitude) }))
    .sort((a, b) => a.jarakMeter - b.jarakMeter);
}

/** "HH:mm" + toleransi menit -> berapa menit terlambat (0 kalau tidak/belum lewat toleransi). Matematika menit murni, bukan Date -- sama pola `labelSisaWaktu` di lib/tugasHariIni.ts. */
export function hitungTerlambatMenit(jamMasuk: string, jamSekarang: string, toleransiMenit: number): number {
  const [jm, mm] = jamMasuk.split(':').map(Number);
  const [js, ms] = jamSekarang.split(':').map(Number);
  const menitMasuk = jm * 60 + mm;
  const menitSekarang = js * 60 + ms;
  const selisih = menitSekarang - menitMasuk - toleransiMenit;
  return selisih > 0 ? selisih : 0;
}

export type StatusAbsenOtomatis = 'valid' | 'di_luar_radius';

/** Tentukan status baris (BUKAN keputusan tolak/lanjut -- itu diputuskan di layar sebelum foto). */
export function statusDariJarak(jarakMeter: number, radiusMeter: number): StatusAbsenOtomatis {
  return jarakMeter <= radiusMeter ? 'valid' : 'di_luar_radius';
}
