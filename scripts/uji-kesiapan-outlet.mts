// Uji murni Kesiapan Outlet (lib/kesiapanOutlet.ts) + pesan Kontrol Harian tanpa penugasan (lib/kontrolHarian.ts).
// Jalankan: npx tsx scripts/uji-kesiapan-outlet.mts
// Butir POS diuji di pos-fnb (src/lib/integrasi/__tests__/kesiapan-outlet.test.ts); fungsi
// kontrol_harian_penugasan diuji di scripts/dry-run-0077.mjs (rollback).
import { gabungKesiapan, type OutletPosKesiapan } from '../lib/kesiapanOutlet';
import { gabungKontrol, PESAN_TANPA_PENUGASAN, type OutletPos, type UangOutlet } from '../lib/kontrolHarian';

const hasil: boolean[] = [];
const cek = (n: string, ok: boolean, d?: unknown) => { hasil.push(ok); console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${ok ? '' : `  (${JSON.stringify(d)})`}`); };

const pos: OutletPosKesiapan = {
  posOutletId: 'p1',
  nama: 'Indokopi Lite Kemayoran',
  butir: [
    { kunci: 'perangkat', butir: 'Perangkat kasir', status: 'kurang', keadaan: '0 perangkat kasir terdaftar', siapa: 'Owner' },
    { kunci: 'pin', butir: 'PIN kasir', status: 'risiko', keadaan: '2 dari 2 akun masih memakai PIN bawaan seed', siapa: 'Manajer' },
    { kunci: 'wa', butir: 'Penerima laporan WhatsApp', status: 'ok', keadaan: '1 penerima', siapa: null },
    { kunci: 'cadangan_pos', butir: 'Cadangan database POS', status: 'ok', keadaan: 'Cadangan terakhir: hari ini', siapa: null },
  ],
};
const cadOk = { teks: 'Cadangan terakhir: 2 hari lalu', peringatan: false, catatan: null };
const cadLama = { teks: 'Cadangan terakhir: 9 hari lalu', peringatan: true, catatan: 'Lebih dari 8 hari tanpa cadangan' };

const tanpa = gabungKesiapan(pos, false, cadOk);
const kf = tanpa.butir.find((b) => b.kunci === 'kontrol_fnb')!;
cek('tanpa penugasan Kontrol F&B -> Kurang, menyebut uang masuk tidak bisa diisi, Admin bertindak', kf.status === 'kurang' && /uang masuk/.test(kf.keadaan) && /Admin/.test(kf.siapa ?? ''), kf);
cek('urutan: butir POS, lalu Kontrol F&B & runbook, lalu dua butir cadangan berdampingan',
  tanpa.butir.map((b) => b.kunci).join(',') === 'perangkat,pin,wa,kontrol_fnb,runbook,cadangan_pos,cadangan_laporan', tanpa.butir.map((b) => b.kunci));
cek('hitungan OK/Kurang/Risiko per outlet', JSON.stringify(tanpa.hitung) === JSON.stringify({ ok: 3, kurang: 2, risiko: 2 }), tanpa.hitung);
cek('runbook selalu Risiko "tidak tercatat di sistem" (tidak pernah OK tanpa bukti)', tanpa.butir.find((b) => b.kunci === 'runbook')!.status === 'risiko');

const ada = gabungKesiapan(pos, true, cadOk);
cek('ada penugasan -> OK tanpa siapa bertindak', ada.butir.find((b) => b.kunci === 'kontrol_fnb')!.status === 'ok' && ada.butir.find((b) => b.kunci === 'kontrol_fnb')!.siapa === null);
const belumPeta = gabungKesiapan(pos, null, cadOk);
cek('outlet POS belum dipetakan -> Kurang (bukan dianggap ada penugasan)', /belum dipetakan/.test(belumPeta.butir.find((b) => b.kunci === 'kontrol_fnb')!.keadaan) && belumPeta.butir.find((b) => b.kunci === 'kontrol_fnb')!.status === 'kurang');
const lama = gabungKesiapan(pos, true, cadLama);
const cl = lama.butir.find((b) => b.kunci === 'cadangan_laporan')!;
cek('cadangan laporan lebih dari 8 hari -> Risiko dengan catatannya', cl.status === 'risiko' && /Lebih dari 8 hari/.test(cl.keadaan) && cl.siapa !== null, cl);

// Kontrol Harian: pesan tanpa penugasan
const posKH: OutletPos = {
  posOutletId: 'p1', nama: 'Indokopi Lite Kemayoran', tanggal: '2026-10-05',
  ambang: { persen: '3', nilai: '50000', toleransiUang: '0' },
  penjualan: { jumlahOrder: 1, bersih: '25000', refund: '0', uangSistem: '25000', perMetode: [{ metode: 'qris', jumlah: '25000' }] },
  pic: ['Fadil'], opname: { awal: 'buka', akhir: true }, bahan: [], produkTanpaResep: [], stok: { status: 'ok', kurang: [], tanpaHarga: [] },
};
const uangKosong: UangOutlet = { outlet_id: 'r1', outlet_nama: 'Indokopi Lite Kemayoran', pos_outlet_id: 'p1', status_laporan: null, cash: null, qris: null, bank: null };
const khTanpa = gabungKontrol(posKH, uangKosong, null, null, false);
cek('Kontrol Harian tanpa penugasan -> "uang masuk belum bisa diisi karena belum ada penugasan", status Data belum lengkap',
  khTanpa.status === 'Data belum lengkap' && khTanpa.kurang.includes(PESAN_TANPA_PENUGASAN) && /uang masuk belum bisa diisi karena belum ada penugasan/i.test(PESAN_TANPA_PENUGASAN), khTanpa.kurang);
const khAda = gabungKontrol(posKH, uangKosong, null, null, true);
cek('Kontrol Harian ada penugasan tapi laporan belum ada -> pesan lama "belum diisi"', khAda.kurang.some((k) => /belum diisi/.test(k)) && !khAda.kurang.includes(PESAN_TANPA_PENUGASAN), khAda.kurang);
const khBawaan = gabungKontrol(posKH, uangKosong, null);
cek('parameter penugasan tidak diberikan -> perilaku lama (tidak berubah)', JSON.stringify(khBawaan.kurang) === JSON.stringify(khAda.kurang));

console.log(`${hasil.filter(Boolean).length}/${hasil.length} lolos`);
process.exitCode = hasil.every(Boolean) ? 0 : 1;
