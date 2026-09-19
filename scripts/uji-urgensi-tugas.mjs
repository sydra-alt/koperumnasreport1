#!/usr/bin/env node
// Uji lib/urgensiTugas.ts (redesign Beranda, 19 September 2026). BERBEDA dari
// uji-tugas-beranda.mjs (yang menyalin fungsinya), file ini MENGIMPOR kode
// aslinya langsung -- lib/urgensiTugas.ts sengaja tanpa impor runtime
// (hanya tipe) supaya Node bisa mengupasnya sendiri. Tidak menyentuh database.

import {
  AMBANG_MENDEKATI_BAWAAN_MENIT,
  menitDariJam,
  tambahUrgensi,
  tentukanUrgensi,
  urutkanBerdasarkanBatas,
} from '../lib/urgensiTugas.ts';

let gagal = 0;
function cek(nama, aktual, harapan) {
  const a = JSON.stringify(aktual);
  const h = JSON.stringify(harapan);
  const ok = a === h;
  if (!ok) gagal++;
  console.log(`${ok ? 'OK   ' : 'GAGAL'} ${nama}${ok ? '' : `\n        harapan: ${h}\n        aktual : ${a}`}`);
}

// ── tentukanUrgensi: batas-batasnya ─────────────────────────────────────────
const A = AMBANG_MENDEKATI_BAWAAN_MENIT;
cek('ambang bawaan 60 menit', A, 60);
cek('sisa 61 menit -> santai (BUKAN amber)', tentukanUrgensi(61, A), 'santai');
cek('sisa 60 menit (tepat ambang) -> mendekati', tentukanUrgensi(60, A), 'mendekati');
cek('sisa 1 menit -> mendekati', tentukanUrgensi(1, A), 'mendekati');
cek('sisa 0 (tepat di menit batas) -> masih mendekati, BELUM merah', tentukanUrgensi(0, A), 'mendekati');
cek('sisa -1 -> lewat (merah)', tentukanUrgensi(-1, A), 'lewat');
cek('sisa -300 -> lewat', tentukanUrgensi(-300, A), 'lewat');
cek('batas tidak diketahui -> santai, bukan merah/amber', tentukanUrgensi(null, A), 'santai');
cek('ambang bisa diubah (30): sisa 45 -> santai', tentukanUrgensi(45, 30), 'santai');
cek('ambang bisa diubah (30): sisa 30 -> mendekati', tentukanUrgensi(30, 30), 'mendekati');
cek('menitDariJam', menitDariJam('18:00'), 1080);

// ── tambahUrgensi ──────────────────────────────────────────────────────────
const SHIFT_PAGI = 'shift-pagi';
const assignments = [
  { form_key: 'kebersihan', lokasi_id: null, outlet_id: 'o-cempaka', shift_id: null },
  { form_key: 'manager_resto', lokasi_id: null, outlet_id: 'o-cempaka', shift_id: null },
  { form_key: 'security', lokasi_id: 'l-tajur', outlet_id: null, shift_id: SHIFT_PAGI },
];
const namaScope = { 'o-cempaka': 'Indosteak Cempaka', 'l-tajur': 'Tajur' };
const labelScope = (a) =>
  [a.lokasi_id ? namaScope[a.lokasi_id] : a.outlet_id ? namaScope[a.outlet_id] : null, a.shift_id ? 'Pagi' : null].filter(Boolean).join(' · ') || null;
// Meniru batasJamKirim: default 18:00, manager_resto 23:00, security per_shift (shift pagi 14:30)
const batasUntuk = (formKey, shiftId) => (formKey === 'manager_resto' ? '23:00' : formKey === 'security' ? (shiftId === SHIFT_PAGI ? '14:30' : '18:00') : '18:00');

const tugas = [
  { formKey: 'personal_marketing', namaForm: 'Laporan Personal Marketing', scopeLabel: null, status: 'belum', label: 'batas 18.00', lewatDeadline: false, tombol: 'Isi sekarang' },
  { formKey: 'kebersihan', namaForm: 'Laporan Kebersihan', scopeLabel: 'Indosteak Cempaka', status: 'draft', label: 'tersimpan, belum dikirim', lewatDeadline: false, tombol: 'Lanjutkan' },
  { formKey: 'manager_resto', namaForm: 'Laporan Harian Manager Resto', scopeLabel: 'Indosteak Cempaka', status: 'belum', label: 'batas 23.00', lewatDeadline: false, tombol: 'Isi sekarang' },
  { formKey: 'security', namaForm: 'Laporan Keamanan', scopeLabel: 'Tajur · Pagi', status: 'belum', label: 'terlambat 30 menit', lewatDeadline: true, tombol: 'Isi sekarang' },
];
const opsi = (jam) => ({ assignments, jamSekarang: jam, ambangMenit: 60, batasUntuk, labelScope });

let r = tambahUrgensi(tugas, opsi('15:00'));
cek('15:00 personal_marketing (18:00): sisa 180 -> santai', [r[0].batas, r[0].sisaMenit, r[0].urgensi], ['18:00', 180, 'santai']);
cek('15:00 DRAFT kebersihan: batas dihitung sendiri (draft tidak punya batas di label), sisa 180', [r[1].batas, r[1].sisaMenit, r[1].urgensi], ['18:00', 180, 'santai']);
cek('15:00 manager_resto (23:00): sisa 480 -> santai', [r[2].sisaMenit, r[2].urgensi], [480, 'santai']);
cek('15:00 security shift pagi (batas per-shift 14:30): sisa -30 -> lewat', [r[3].batas, r[3].sisaMenit, r[3].urgensi], ['14:30', -30, 'lewat']);

r = tambahUrgensi(tugas, opsi('17:15'));
cek('17:15 tugas 18:00: sisa 45 -> mendekati (amber)', [r[0].urgensi, r[1].urgensi], ['mendekati', 'mendekati']);
cek('17:15 manager_resto 23:00 tetap santai', r[2].urgensi, 'santai');

r = tambahUrgensi(tugas, opsi('18:30'));
cek('18:30 DRAFT lewat batas -> lewat (merah) walau tugas.lewatDeadline dari hitungTugasHariIni false untuk draft', [tugas[1].lewatDeadline, r[1].urgensi], [false, 'lewat']);

const selesai = tambahUrgensi([{ ...tugas[0], status: 'selesai', label: '', tombol: '' }], opsi('23:59'));
cek('tugas selesai tidak diberi batas/urgensi', [selesai[0].batas, selesai[0].sisaMenit, selesai[0].urgensi], [null, null, 'santai']);

cek('form yang scope-nya tidak cocok dengan assignment manapun -> shift null (bukan salah tebak)',
  tambahUrgensi([{ ...tugas[3], scopeLabel: 'Label Asing' }], opsi('10:00'))[0].batas, '18:00');

// ── urutkanBerdasarkanBatas ────────────────────────────────────────────────
const urut = (jam) => urutkanBerdasarkanBatas(tambahUrgensi(tugas, opsi(jam))).map((t) => t.formKey);
cek('15:00: yang paling terlambat (security) dulu, lalu 18:00 sesuai urutan asal, manager_resto 23:00 terakhir', urut('15:00'), ['security', 'personal_marketing', 'kebersihan', 'manager_resto']);
cek('10:00: security 14:30 paling dekat, lalu dua tugas 18:00, lalu 23:00', urut('10:00'), ['security', 'personal_marketing', 'kebersihan', 'manager_resto']);
cek('urutan stabil untuk sisa yang sama', urutkanBerdasarkanBatas([{ id: 'a', sisaMenit: 5 }, { id: 'b', sisaMenit: 5 }, { id: 'c', sisaMenit: 5 }]).map((x) => x.id), ['a', 'b', 'c']);
cek('batas tidak diketahui (null) paling akhir', urutkanBerdasarkanBatas([{ id: 'x', sisaMenit: null }, { id: 'y', sisaMenit: 500 }, { id: 'z', sisaMenit: -10 }]).map((x) => x.id), ['z', 'y', 'x']);
cek('daftar kosong', urutkanBerdasarkanBatas([]), []);

console.log(gagal === 0 ? '\n✅ SEMUA LOLOS' : `\n🛑 ${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
