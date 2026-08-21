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

const NAMA_HARI: Record<number, string> = {
  1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu', 7: 'Minggu',
};

const NAMA_BULAN: Record<string, string> = {
  '01': 'Januari', '02': 'Februari', '03': 'Maret', '04': 'April',
  '05': 'Mei', '06': 'Juni', '07': 'Juli', '08': 'Agustus',
  '09': 'September', '10': 'Oktober', '11': 'November', '12': 'Desember',
};

export function tanggalIndonesiaWIB(d = new Date()): string {
  // → 'Jumat, 21 Agustus 2026'
  const [tahun, bulan, tanggal] = tanggalWIB(d).split('-');
  const namaHari = NAMA_HARI[hariISOWIB(d)];
  return `${namaHari}, ${Number(tanggal)} ${NAMA_BULAN[bulan]} ${tahun}`;
}
