import { createHmac, randomUUID } from 'crypto';

/**
 * Penandatangan token "satu pintu masuk" ke dashboard pos-fnb (25 September
 * 2026). Reimplementasi SISI VERIFIKASI ada di pos-fnb
 * (`src/lib/auth/handoff-token.ts`, repo terpisah) -- kalau bentuk payload
 * di sini diubah, berkas itu WAJIB ikut diubah, tidak ada cara berbagi kode
 * antara dua repo terpisah total.
 *
 * SEJAK 29 September 2026 (disetujui CEO -- CLAUDE.md #13): sistem laporan
 * adalah SUMBER KEBENARAN siapa bekerja di mana. Token membawa `akses` hasil
 * `akses_pos_saya()` (dihitung di database laporan dari peran/form penugasan
 * + outlet_pos_map) dan pos-fnb menyesuaikan akun & membership orang itu
 * dengannya. Batas keras dijaga pos-fnb SENDIRI, tidak bergantung isi token:
 * paling tinggi 'manager', owner tidak pernah disentuh, outlet disaring ke
 * bisnisnya. `akses` HANYA boleh berasal dari akses_pos_saya() milik orang
 * yang SEDANG login di request ini -- tidak pernah atas nama orang lain.
 *
 * Kedaluwarsa SANGAT pendek (60 detik) sengaja -- token ini cuma dipakai
 * untuk satu redirect / satu putaran alat, bukan disimpan/dipakai ulang.
 */

const HANDOFF_AUDIENCE = 'pos-fnb-handoff';
/**
 * Audience KEDUA (28 September 2026): token jembatan asisten AI ke
 * `POST /api/ai/tools` pos-fnb (lib/ai/jembatanPos.ts). Skema, secret, TTL,
 * dan isi payload SAMA PERSIS -- cuma `aud` beda, dan pos-fnb memeriksa aud
 * secara eksplisit, jadi token AI tidak bisa dipakai login /handoff dan
 * sebaliknya.
 */
export const AI_QUERY_AUDIENCE = 'pos-fnb-ai-query';
/**
 * Audience KETIGA (5 Oktober 2026, koreksi CEO): token jembatan Laba Rugi Bulanan
 * ke `POST /api/integrasi/pnl` pos-fnb (lib/labaRugi.ts).
 */
export const PNL_BRIDGE_AUDIENCE = 'pos-fnb-pnl-bridge';
const HANDOFF_TOKEN_TTL_SECONDS = 60;

/** Hasil `akses_pos_saya()` (migrasi 0068), dibawa apa adanya. */
export type AksesPos = {
  boleh: boolean;
  alasan?: string;
  peran_pos?: string;
  semua_outlet?: boolean;
  audit_semua?: boolean;
  outlet_pos_ids?: string[] | null;
};

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Melempar kalau POS_HANDOFF_SECRET belum diisi -- pemanggil (route
 * handler) WAJIB menangkapnya dan menampilkan pesan gagal yang wajar,
 * bukan 500 mentah ke pengguna.
 */
export function buatTokenPos(
  user: { id: string; email: string },
  audience: typeof HANDOFF_AUDIENCE | typeof AI_QUERY_AUDIENCE | typeof PNL_BRIDGE_AUDIENCE,
  tambahan: { nama?: string | null; akses: AksesPos | null },
): string {
  const secret = process.env.POS_HANDOFF_SECRET;
  if (!secret) {
    throw new Error('POS_HANDOFF_SECRET belum diset di server.');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    email: user.email,
    uid: user.id,
    nonce: randomUUID(),
    iat: now,
    exp: now + HANDOFF_TOKEN_TTL_SECONDS,
    nama: tambahan.nama ?? null,
    akses: tambahan.akses,
  };

  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const sig = base64UrlEncode(createHmac('sha256', secret).update(payloadB64).digest());
  return `${payloadB64}.${sig}`;
}

export function buatTokenHandoffPos(user: { id: string; email: string }, tambahan: { nama?: string | null; akses: AksesPos | null }): string {
  return buatTokenPos(user, HANDOFF_AUDIENCE, tambahan);
}

export function buatTokenPnlBridge(user: { id: string; email: string }, tambahan: { nama?: string | null; akses: AksesPos | null }): string {
  return buatTokenPos(user, PNL_BRIDGE_AUDIENCE, tambahan);
}
