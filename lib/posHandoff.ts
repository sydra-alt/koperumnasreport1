import { createHmac, randomUUID } from 'crypto';

/**
 * Penandatangan token "satu pintu masuk" ke dashboard pos-fnb (25 September
 * 2026). Reimplementasi SISI VERIFIKASI ada di pos-fnb
 * (`src/lib/auth/handoff-token.ts`, repo terpisah) -- kalau bentuk payload
 * di sini diubah, berkas itu WAJIB ikut diubah, tidak ada cara berbagi kode
 * antara dua repo terpisah total.
 *
 * PENTING, jangan dilanggar: token ini HANYA pembawa "orang ini SEDANG
 * login di reportkoperumnasgroup sebagai email X, baru saja". TIDAK PERNAH
 * membawa role/outlet/izin apa pun -- pos-fnb yang menentukan itu semua
 * dari membership-nya sendiri SETELAH sesi Supabase asli terbentuk di
 * sana. reportkoperumnasgroup di sini murni PEMBAWA, bukan otoritas.
 *
 * Kedaluwarsa SANGAT pendek (60 detik) sengaja -- token ini cuma dipakai
 * untuk satu redirect, bukan disimpan/dipakai ulang.
 */

const HANDOFF_AUDIENCE = 'pos-fnb-handoff';
const HANDOFF_TOKEN_TTL_SECONDS = 60;

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Melempar kalau POS_HANDOFF_SECRET belum diisi -- pemanggil (route
 * handler) WAJIB menangkapnya dan menampilkan pesan gagal yang wajar,
 * bukan 500 mentah ke pengguna.
 */
export function buatTokenHandoffPos(user: { id: string; email: string }): string {
  const secret = process.env.POS_HANDOFF_SECRET;
  if (!secret) {
    throw new Error('POS_HANDOFF_SECRET belum diset di server.');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: HANDOFF_AUDIENCE,
    email: user.email,
    uid: user.id,
    nonce: randomUUID(),
    iat: now,
    exp: now + HANDOFF_TOKEN_TTL_SECONDS,
  };

  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const sig = base64UrlEncode(createHmac('sha256', secret).update(payloadB64).digest());
  return `${payloadB64}.${sig}`;
}
