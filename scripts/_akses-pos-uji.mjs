// Akses POS SEMENTARA untuk akun uji (29 September 2026, instruksi CEO):
// uji-ceo punya akses manager ke semua outlet produksi kalau punya_akses_pos
// menyala, jadi tanda itu MATI secara bawaan. Skrip uji browser menyalakannya
// di awal dan memanggil fungsi pemulih yang dikembalikan di sini dari
// pasangPemulih() -- jalan juga saat uji gagal / Ctrl-C.
//
// Pemulihan = tanda dikembalikan ke nilai semula, LALU satu panggilan
// jembatan AI bertanda tangan dengan akses DITOLAK, supaya pos-fnb sendiri
// (provision.ts) menonaktifkan membership non-owner akun itu lewat jalur
// produksi -- bukan dengan menulis database pos-fnb dari sini.

import { createHmac, randomUUID } from 'node:crypto';

const b64 = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function tolakDiPos(email) {
  const posUrl = process.env.POS_INTEGRASI_URL;
  const secret = process.env.POS_HANDOFF_SECRET;
  if (!posUrl || !secret) throw new Error('POS_INTEGRASI_URL / POS_HANDOFF_SECRET tidak ada di .env.local');
  const now = Math.floor(Date.now() / 1000);
  const p = b64(Buffer.from(JSON.stringify({
    aud: 'pos-fnb-ai-query', email, uid: 'uji-pemulih', nonce: randomUUID(), iat: now, exp: now + 60,
    nama: null, akses: { boleh: false, alasan: 'tanpa_akses_pos' },
  })));
  const token = `${p}.${b64(createHmac('sha256', secret).update(p).digest())}`;
  const res = await fetch(`${posUrl.replace(/\/+$/, '')}/api/ai/tools`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, calls: [{ name: 'stock_levels', args: {} }] }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200 || body.access !== 'no_pos_access') throw new Error(`pos-fnb tidak menolak (HTTP ${res.status})`);
}

/**
 * Nyalakan punya_akses_pos akun uji `email`. Mengembalikan fungsi pemulih
 * (idempoten) yang mengembalikan tanda ke nilai semula dan mencabut
 * membership pos-fnb-nya.
 */
export async function aksesPosUjiSementara(db, email) {
  const { rows } = await db.query(
    `select p.id, p.punya_akses_pos, p.akun_uji from public.profile p join auth.users u on u.id = p.id where u.email = $1`,
    [email],
  );
  if (!rows[0]) throw new Error(`${email} tidak ditemukan`);
  if (!rows[0].akun_uji) throw new Error(`${email} BUKAN akun uji -- tidak boleh diubah skrip uji`);
  const { id, punya_akses_pos: semula } = rows[0];
  await db.query('update public.profile set punya_akses_pos = true where id = $1', [id]);
  let sudah = false;
  return async () => {
    if (sudah) return;
    sudah = true;
    await db.query('update public.profile set punya_akses_pos = $2 where id = $1', [id, semula]);
    if (!semula) await tolakDiPos(email);
    console.log(`[pulih] ${email}: punya_akses_pos=${semula}${semula ? '' : ', membership pos-fnb dinonaktifkan lewat jembatan'}.`);
  };
}
