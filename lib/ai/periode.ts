import { geserTanggalYmd, hariIsoDariTanggal } from '../tanggal';

/**
 * Periode relatif asisten AI (29 September 2026, koreksi CEO): "minggu ini"
 * dan kawannya SELALU periode KALENDER, bukan jendela bergulir N hari.
 * Model TIDAK PERNAH menghitung tanggal relatif sendiri -- ia mengisi
 * argumen `periode`, dan tanggalnya dihitung di sini dari hari ini
 * (tanggalWIB, tanggal yang sama yang dipakai `report.tanggal`). Minggu
 * mulai Senin.
 *
 * Kembar persis pos-fnb src/lib/calc/relative-period.ts (di sana dijangkarkan
 * ke hari bisnis outlet, dengan batas hari/cutoff). Kalau aturannya diubah,
 * ubah keduanya.
 */

export const PERIODE_RELATIF = ['hari_ini', 'kemarin', 'minggu_ini', 'minggu_lalu', 'bulan_ini', 'bulan_lalu'] as const;
export type PeriodeRelatif = (typeof PERIODE_RELATIF)[number];

export function periodeRelatifValid(nilai: unknown): nilai is PeriodeRelatif {
  return typeof nilai === 'string' && (PERIODE_RELATIF as readonly string[]).includes(nilai);
}

export function rentangPeriode(hariIni: string, periode: PeriodeRelatif): { dari: string; sampai: string } {
  const senin = geserTanggalYmd(hariIni, 1 - hariIsoDariTanggal(hariIni));
  const tanggalSatu = `${hariIni.slice(0, 8)}01`;
  switch (periode) {
    case 'hari_ini':
      return { dari: hariIni, sampai: hariIni };
    case 'kemarin': {
      const k = geserTanggalYmd(hariIni, -1);
      return { dari: k, sampai: k };
    }
    case 'minggu_ini':
      return { dari: senin, sampai: hariIni };
    case 'minggu_lalu':
      return { dari: geserTanggalYmd(senin, -7), sampai: geserTanggalYmd(senin, -1) };
    case 'bulan_ini':
      return { dari: tanggalSatu, sampai: hariIni };
    case 'bulan_lalu': {
      const akhirBulanLalu = geserTanggalYmd(tanggalSatu, -1);
      return { dari: `${akhirBulanLalu.slice(0, 8)}01`, sampai: akhirBulanLalu };
    }
  }
}
