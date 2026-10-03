// Daftar akun karyawan (scripts/akun.json) -- 3 Oktober 2026: berisi data
// pribadi 40+ karyawan sungguhan (email, nama, jabatan, divisi, peran),
// karena itu TIDAK di-commit (.gitignore) dan dihapus dari seluruh riwayat
// git. Berkas hanya ada LOKAL di mesin admin; skrip yang membutuhkannya
// berhenti dengan pesan jelas kalau berkas tidak ada.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BERKAS_AKUN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'akun.json');

export function bacaAkunLokal() {
  if (!existsSync(BERKAS_AKUN)) {
    console.error(
      `Berkas daftar akun tidak ada: ${BERKAS_AKUN}\n` +
        'Berkas ini sengaja TIDAK ada di git (data pribadi karyawan). Salin dari mesin admin ' +
        '(atau backup lokal) ke lokasi di atas, lalu jalankan ulang. Jangan pernah meng-commit-nya.',
    );
    process.exit(1);
  }
  return JSON.parse(readFileSync(BERKAS_AKUN, 'utf8'));
}
