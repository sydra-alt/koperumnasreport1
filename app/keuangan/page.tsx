'use client';

import { Terlindungi } from '../../components/Terlindungi';
import { LaporForm } from '../../components/LaporForm';
import { TombolEkspor } from '../../components/TombolEkspor';

/**
 * Halaman Keuangan -- satu-satunya jalan navigasi Shabita (accounting)
 * selain menu Akun (30 Agustus 2026, ditemukan user: dia login lalu tidak
 * punya jalan ke mana-mana selain form). Gabung form harian + ekspor
 * bulanan supaya SATU halaman, bukan dua tempat terpisah. Digerbangi lebih
 * ketat daripada rute generik `/lapor/accounting` (yang tidak ada
 * `Terlindungi` sama sekali) -- `ceo` ikut diizinkan karena dia juga boleh
 * lihat/unduh keuangan (sama seperti gerbang `app/api/ekspor/keuangan`).
 */
export default function KeuanganPage() {
  return (
    <Terlindungi peran={['accounting', 'ceo']}>
      <main className="flex flex-col gap-4 p-6">
        <TombolEkspor path="/api/ekspor/keuangan" label="Rekap keuangan bulanan (Excel)" />
        <LaporForm formKey="accounting" />
      </main>
    </Terlindungi>
  );
}
