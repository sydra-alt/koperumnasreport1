// Kredensial akun uji (uji-ceo, uji1..uji6) -- 3 Oktober 2026.
//
// Password akun uji TIDAK PERNAH ada di kode atau di repo. Disimpan di berkas
// LOKAL di luar semua repo (bawaan ~/.koperumnas/akun-uji.json, bisa diganti
// lewat env UJI_KREDENSIAL), dibuat/diganti oleh scripts/rotasi-akun-uji.mjs.
// Skrip uji yang mengganti password sementara WAJIB memulihkannya ke nilai
// di berkas ini -- tidak pernah ke password awal karyawan (PASSWORD_AWAL).
// Nilai tidak pernah dicetak.
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const BERKAS_KREDENSIAL_UJI = process.env.UJI_KREDENSIAL ?? path.join(os.homedir(), '.koperumnas', 'akun-uji.json');

export function semuaKredensialUji() {
  if (!existsSync(BERKAS_KREDENSIAL_UJI)) {
    throw new Error(`Berkas kredensial akun uji tidak ada: ${BERKAS_KREDENSIAL_UJI}. Jalankan scripts/rotasi-akun-uji.mjs (atau set UJI_KREDENSIAL).`);
  }
  return JSON.parse(readFileSync(BERKAS_KREDENSIAL_UJI, 'utf8'));
}

/** Password akun uji untuk email ini (melempar kalau tidak ada -- tidak pernah jatuh ke password bawaan). */
export function passwordUji(email) {
  const v = semuaKredensialUji()[email];
  if (typeof v !== 'string' || v.length < 16) throw new Error(`Kredensial akun uji ${email} tidak ada / terlalu pendek di ${BERKAS_KREDENSIAL_UJI}.`);
  return v;
}

/** Password sementara acak untuk satu kali jalan uji (pengganti literal tetap). */
export function passwordSementaraAcak() {
  return `Uji-${crypto.randomBytes(18).toString('base64url')}`;
}
