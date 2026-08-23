export interface HariKalenderPte {
  tanggal: string; // YYYY-MM-DD
  hariIso: number; // 1=Senin..7=Minggu
  status: 'lengkap' | 'bolong' | 'bukan_wajib' | 'akan_datang';
}

/**
 * Kalender visual PER HARI untuk Task 22 (detail per karyawan, "hari bolong
 * ditandai merah") -- TIDAK menghitung ulang `hari_bolong` (itu tetap
 * SATU-SATUNYA kebenaran dari `v_marketing_bulanan`, dibaca apa adanya).
 * Fungsi ini murni memutuskan warna TIAP TANGGAL untuk digambar, dari data
 * `pte_daily` yang sudah diambil per baris -- rendering, bukan agregasi.
 *
 * `tahunBulan` = 'YYYY-MM' (dari `tanggalWIB()`, bukan `toISOString()`).
 * "Awal wajib" = paling akhir dari (tgl 1 bulan ini, pte_mulai_berlaku,
 * mulai_kerja) -- perbandingan STRING 'YYYY-MM-DD' aman dipakai leksikografis
 * karena formatnya seragam, sama seperti `greatest()` di 03-CALC-SPEC.md §3.
 */
export function kalenderPteBulanIni(
  tahunBulan: string,
  workdays: number[],
  pteMulaiBerlaku: string | null,
  mulaiKerja: string | null,
  hariIni: string,
  dataHarian: { tanggal: string; lengkap: boolean }[],
): HariKalenderPte[] {
  const [tahun, bulan] = tahunBulan.split('-').map(Number);
  const jumlahHari = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();

  if (!pteMulaiBerlaku) {
    // Kewajiban belum berlaku sama sekali -- seluruh bulan netral, bukan bolong.
    return Array.from({ length: jumlahHari }, (_, i) => {
      const tanggal = `${tahunBulan}-${String(i + 1).padStart(2, '0')}`;
      return { tanggal, hariIso: hariIsoDariTanggal(tanggal), status: 'bukan_wajib' as const };
    });
  }

  const awalWajib = [`${tahunBulan}-01`, pteMulaiBerlaku, mulaiKerja].filter((s): s is string => Boolean(s)).sort().pop()!;
  const petaLengkap = new Map(dataHarian.map((d) => [d.tanggal, d.lengkap]));

  const hasil: HariKalenderPte[] = [];
  for (let hari = 1; hari <= jumlahHari; hari++) {
    const tanggal = `${tahunBulan}-${String(hari).padStart(2, '0')}`;
    const hariIso = hariIsoDariTanggal(tanggal);
    let status: HariKalenderPte['status'];
    if (tanggal < awalWajib || !workdays.includes(hariIso)) {
      status = 'bukan_wajib';
    } else if (tanggal > hariIni) {
      status = 'akan_datang';
    } else {
      status = petaLengkap.get(tanggal) === true ? 'lengkap' : 'bolong';
    }
    hasil.push({ tanggal, hariIso, status });
  }
  return hasil;
}

/** Hari-ISO dari tanggal kalender YANG SUDAH DIKETAHUI (bukan dari instant) -- matematika kalender murni, bukan tebakan zona waktu. */
function hariIsoDariTanggal(tanggalYmd: string): number {
  const [t, b, h] = tanggalYmd.split('-').map(Number);
  const dow = new Date(Date.UTC(t, b - 1, h)).getUTCDay();
  return dow === 0 ? 7 : dow;
}
