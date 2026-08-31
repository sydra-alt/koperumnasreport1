export const TZ = 'Asia/Jakarta';

export function tanggalWIB(d = new Date()): string {
  // → 'YYYY-MM-DD'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

export function jamWIB(d = new Date()): string {
  // → 'HH:mm'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

export function hariISOWIB(d = new Date()): number {
  // 1 = Senin … 7 = Minggu
  const nama = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d);
  return ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as const)[nama as 'Mon'];
}

/**
 * Hari-ISO dari tanggal KALENDER yang sudah diketahui (string 'YYYY-MM-DD',
 * mis. `report.tanggal` yang tersimpan) -- BUKAN dari sebuah instant/`Date`.
 * Ini matematika kalender murni (`Date.UTC` dipakai cuma untuk hitung hari
 * dalam minggu dari tiga angka Y/M/D, bukan untuk mengonversi zona waktu),
 * jadi aman dipakai untuk tanggal MASA LALU -- beda dari `hariISOWIB()` yang
 * menjawab "hari apa SEKARANG".
 */
export function hariIsoDariTanggal(tanggalYmd: string): number {
  const [t, b, h] = tanggalYmd.split('-').map(Number);
  const dow = new Date(Date.UTC(t, b - 1, h)).getUTCDay();
  return dow === 0 ? 7 : dow;
}

const NAMA_HARI: Record<number, string> = {
  1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu', 7: 'Minggu',
};

const NAMA_BULAN: Record<string, string> = {
  '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April',
  '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Agustus',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember',
};

/** → 'Jumat, 21 Agustus 2026' dari tanggal KALENDER 'YYYY-MM-DD' (bisa masa lalu) -- lihat `hariIsoDariTanggal`. */
export function tanggalIndonesiaDariYmd(tanggalYmd: string): string {
  const [tahun, bulan, tanggal] = tanggalYmd.split('-');
  const namaHari = NAMA_HARI[hariIsoDariTanggal(tanggalYmd)];
  return `${namaHari}, ${Number(tanggal)} ${NAMA_BULAN[bulan]} ${tahun}`;
}

export function tanggalIndonesiaWIB(d = new Date()): string {
  // → 'Jumat, 21 Agustus 2026'
  return tanggalIndonesiaDariYmd(tanggalWIB(d));
}

/**
 * Ubah sebuah INSTANT (timestamptz, mis. `absensi.waktu`) jadi `Date` yang
 * getter-UTC-nya berisi jam-dinding WIB -- SATU-SATUNYA cara aman memberi
 * jam ke ExcelJS (`numFmt: 'hh:mm'`/`'dd/mm/yyyy hh:mm'`). ExcelJS
 * menyerialkan `Date` lewat `getUTC*()`, TANPA konsep zona waktu -- kalau
 * instant WIB dikirim mentah (`new Date(r.waktu)`), Excel menulis jam UTC
 * (mundur 7 jam dari yang tampil di layar). Ini jebakan yang sama dengan
 * CLAUDE.md #2 / 04-CATATAN-TEKNIS §7 poin 1, muncul lagi di jalur ekspor
 * (dilaporkan user 31 Agustus 2026).
 *
 * JANGAN pakai hasilnya untuk aritmetika waktu atau dibandingkan dengan
 * instant lain -- nilainya BUKAN instant yang benar, cuma "kontainer" angka
 * Y/M/D/H/M/S WIB yang dibaca lewat getter UTC. Hanya untuk sel Excel.
 */
export function jamUntukExcel(instant: Date | string): Date {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  const bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const ambil = (tipe: string) => Number(bagian.find((p) => p.type === tipe)?.value);
  return new Date(Date.UTC(
    ambil('year'), ambil('month') - 1, ambil('day'),
    ambil('hour'), ambil('minute'), ambil('second'),
  ));
}
