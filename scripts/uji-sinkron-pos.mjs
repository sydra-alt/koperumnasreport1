#!/usr/bin/env node
// Uji lib/sinkronPos.ts (sinkron omzet POS, 19 September 2026) -- mengimpor
// kode aslinya langsung (lib/sinkronPos.ts tanpa impor runtime). Semua efek
// samping diganti tiruan; TIDAK menyentuh database maupun jaringan.

import { bearerCocok, bersihkanGalat, jalankanSinkronPos } from '../lib/sinkronPos.ts';

let gagal = 0;
function cek(nama, aktual, harapan) {
  const a = JSON.stringify(aktual);
  const h = JSON.stringify(harapan);
  const ok = a === h;
  if (!ok) gagal++;
  console.log(`${ok ? 'OK   ' : 'GAGAL'} ${nama}${ok ? '' : `\n        harapan: ${h}\n        aktual : ${a}`}`);
}

const TOKEN = 'token-pos-rahasia-1234567890abcdef';
const HASIL = { jumlah_baris: 5, outlet_terpetakan: 2, tak_terpetakan: [{ nama: 'X' }] };

function tiruan(ubah = {}) {
  const catatan = { log: [], ditutup: [], terapkan: [] };
  const deps = {
    rahasia: [TOKEN],
    mulaiLog: async () => { catatan.log.push('mulai'); return 'log-1'; },
    ambilRingkasanPos: async () => ({ versi: 1, outlet: [] }),
    terapkan: async (id, payload) => { catatan.terapkan.push({ id, payload }); return HASIL; },
    gagalkanLog: async (id, galat) => { catatan.ditutup.push({ id, galat }); },
    ...ubah,
  };
  return { deps, catatan };
}

// ── jalankanSinkronPos ────────────────────────────────────────────────────
{
  const { deps, catatan } = tiruan();
  const r = await jalankanSinkronPos(deps);
  cek('sukses: ok, hasil diteruskan, log TIDAK ditutup gagal', [r.ok, r.hasil, catatan.ditutup.length], [true, HASIL, 0]);
  cek('sukses: payload dari POS diteruskan utuh ke terapkan bersama id log', catatan.terapkan, [{ id: 'log-1', payload: { versi: 1, outlet: [] } }]);
}
{
  const { deps, catatan } = tiruan({ ambilRingkasanPos: async () => { throw new Error('POS menjawab HTTP 503.'); } });
  const r = await jalankanSinkronPos(deps);
  cek('POS mati: tahap tarik, log ditutup GAGAL dengan pesan, terapkan TIDAK dipanggil', [r.ok, r.tahap, r.galat, catatan.ditutup, catatan.terapkan.length], [false, 'tarik', 'POS menjawab HTTP 503.', [{ id: 'log-1', galat: 'POS menjawab HTTP 503.' }], 0]);
}
{
  const { deps, catatan } = tiruan({ terapkan: async () => { throw new Error('Versi kontrak POS tidak dikenal: 2'); } });
  const r = await jalankanSinkronPos(deps);
  cek('database menolak payload: tahap terapkan, log GAGAL', [r.ok, r.tahap, catatan.ditutup.length], [false, 'terapkan', 1]);
}
{
  const { deps, catatan } = tiruan({ mulaiLog: async () => { throw new Error('tabel tidak ada'); } });
  const r = await jalankanSinkronPos(deps);
  cek('gagal membuat log: tahap log, TIDAK menarik dari POS (tidak ada gunanya tanpa jejak)', [r.ok, r.tahap, r.logId, catatan.terapkan.length], [false, 'log', null, 0]);
}
{
  const { deps } = tiruan({
    ambilRingkasanPos: async () => { throw new Error('POS ditolak'); },
    gagalkanLog: async () => { throw new Error('log juga gagal'); },
  });
  const r = await jalankanSinkronPos(deps);
  cek('galat ASLI tetap dilaporkan walau menutup log ikut gagal', [r.ok, r.galat], [false, 'POS ditolak']);
}
{
  const { deps, catatan } = tiruan({ ambilRingkasanPos: async () => { throw new Error(`fetch gagal pada Bearer ${TOKEN} host x`); } });
  const r = await jalankanSinkronPos(deps);
  cek('token TIDAK bocor ke hasil maupun log yang tersimpan', [r.galat.includes(TOKEN), catatan.ditutup[0].galat.includes(TOKEN), r.galat], [false, false, 'fetch gagal pada Bearer *** host x']);
}

// ── bersihkanGalat ────────────────────────────────────────────────────────
cek('rahasia terlalu pendek (<4) tidak dipakai menyensor (hindari merusak teks)', bersihkanGalat('abc def', ['ab']), 'abc def');
cek('semua kemunculan disensor', bersihkanGalat('xxxx-1234-xxxx', ['xxxx']), '***-1234-***');
cek('bukan Error / bukan string -> teks aman', bersihkanGalat({ a: 1 }), 'galat tidak dikenal');
cek('pesan panjang dipotong 500 + elipsis', bersihkanGalat('a'.repeat(900)).length, 501);

// ── bearerCocok ───────────────────────────────────────────────────────────
const S = 'rahasia-cron-abcdefghij1234567890';
cek('bearer benar', bearerCocok(`Bearer ${S}`, S), true);
cek('bearer salah satu karakter', bearerCocok(`Bearer ${S.slice(0, -1)}x`, S), false);
cek('awalan saja / lebih panjang', [bearerCocok(`Bearer ${S.slice(0, 10)}`, S), bearerCocok(`Bearer ${S}x`, S)], [false, false]);
cek('tanpa header / tanpa skema Bearer / skema lain', [bearerCocok(null, S), bearerCocok(S, S), bearerCocok(`Basic ${S}`, S), bearerCocok('Bearer ', S)], [false, false, false, false]);
cek('rahasia kosong / pendek / tidak ada -> SELALU ditolak (gagal tertutup)', [bearerCocok('Bearer ', ''), bearerCocok('Bearer abc', 'abc'), bearerCocok(`Bearer ${S}`, undefined)], [false, false, false]);

console.log(gagal === 0 ? '\n✅ SEMUA LOLOS' : `\n🛑 ${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
