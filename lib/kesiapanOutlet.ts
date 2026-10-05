import type { RingkasanCadangan } from './cadanganStatus';

/**
 * Kesiapan Outlet (8 Oktober 2026) -- baca saja untuk CEO/Admin. Butir POS (perangkat, akun & PIN,
 * pembayaran, stok, resep, harga, Hitung Tiap Shift, penerima WA, cadangan POS) dihitung di pos-fnb
 * (/api/integrasi/kesiapan-outlet, SQL teragregasi). Di sini hanya ditambah butir milik sistem
 * laporan: penugasan Kontrol F&B, pelatihan runbook, cadangan database laporan. Murni -- diuji
 * di scripts/uji-kesiapan-outlet.mts. Sumber butir: docs/KONTROL-DAN-LABA-RUGI-DESIGN-2026-10.md §9.
 */

export type StatusButir = 'ok' | 'kurang' | 'risiko';
export type Butir = { kunci: string; butir: string; status: StatusButir; keadaan: string; siapa: string | null };
export type OutletPosKesiapan = { posOutletId: string; nama: string; butir: Butir[] };
export type BarisKesiapan = OutletPosKesiapan & { hitung: Record<StatusButir, number> };

export const LABEL_STATUS: Record<StatusButir, string> = { ok: 'OK', kurang: 'Kurang', risiko: 'Risiko' };

/** adaPenugasan: true/false dari kontrol_harian_penugasan(); null = outlet POS belum dipetakan ke outlet laporan. */
export function gabungKesiapan(pos: OutletPosKesiapan, adaPenugasan: boolean | null, cadanganLaporan: RingkasanCadangan): BarisKesiapan {
  const tambahan: Butir[] = [];
  if (adaPenugasan === null) {
    tambahan.push({ kunci: 'kontrol_fnb', butir: 'Penugasan Kontrol F&B', status: 'kurang', keadaan: 'Outlet POS ini belum dipetakan ke outlet laporan', siapa: 'Admin: pemetaan outlet laporan ↔ POS' });
  } else if (!adaPenugasan) {
    tambahan.push({ kunci: 'kontrol_fnb', butir: 'Penugasan Kontrol F&B', status: 'kurang', keadaan: 'Belum ada penugasan: uang masuk di Kontrol Harian belum bisa diisi', siapa: 'Admin: tambah penugasan kontrol_fnb (Ita) untuk outlet ini' });
  } else {
    tambahan.push({ kunci: 'kontrol_fnb', butir: 'Penugasan Kontrol F&B', status: 'ok', keadaan: 'Ada penugasan Kontrol F&B', siapa: null });
  }
  tambahan.push({ kunci: 'runbook', butir: 'Pelatihan runbook', status: 'risiko', keadaan: 'Tidak tercatat di sistem', siapa: 'Manajer outlet + Ita: latih kasir dengan RUNBOOK-HARI-PERTAMA.md' });
  tambahan.push({
    kunci: 'cadangan_laporan',
    butir: 'Cadangan database laporan',
    status: cadanganLaporan.peringatan ? 'risiko' : 'ok',
    keadaan: cadanganLaporan.catatan ? `${cadanganLaporan.teks}. ${cadanganLaporan.catatan}` : cadanganLaporan.teks,
    siapa: cadanganLaporan.peringatan ? 'CEO/Admin: laptop cadangan (docs/PEMULIHAN-DATA.md)' : null,
  });

  // Butir laporan disisipkan sebelum butir cadangan POS supaya dua butir cadangan berdampingan.
  const iCadangan = pos.butir.findIndex((b) => b.kunci === 'cadangan_pos');
  const butir = iCadangan < 0
    ? [...pos.butir, ...tambahan]
    : [...pos.butir.slice(0, iCadangan), ...tambahan.slice(0, 2), pos.butir[iCadangan]!, ...tambahan.slice(2), ...pos.butir.slice(iCadangan + 1)];
  const hitung: Record<StatusButir, number> = { ok: 0, kurang: 0, risiko: 0 };
  for (const b of butir) hitung[b.status] += 1;
  return { posOutletId: pos.posOutletId, nama: pos.nama, butir, hitung };
}
