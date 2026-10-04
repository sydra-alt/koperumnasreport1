// Uji murni "Cadangan terakhir: N hari lalu" (lib/cadanganStatus.ts). Jalankan: npx tsx scripts/uji-status-cadangan.mts
import { ringkasCadangan } from '../lib/cadanganStatus';

const hasil: boolean[] = [];
const cek = (n: string, ok: boolean, d?: unknown) => { hasil.push(ok); console.log(`${ok ? 'LOLOS' : 'GAGAL'}  ${n}${ok ? '' : `  (${JSON.stringify(d)})`}`); };
const SEKARANG = new Date('2026-10-07T03:00:00Z');
const jamLalu = (j: number) => new Date(SEKARANG.getTime() - j * 3_600_000);
const r = (terakhirOk: Date | null, hasilTerakhir = 'ok') => ringkasCadangan({ terakhirOk, hasilTerakhir, ukuranByte: 1 }, SEKARANG);

cek('hari ini', r(jamLalu(2)).teks === 'Cadangan terakhir: hari ini' && !r(jamLalu(2)).peringatan, r(jamLalu(2)));
cek('1 hari lalu (tanggal WIB, 23.30 kemarin)', r(new Date('2026-10-06T16:30:00Z')).teks === 'Cadangan terakhir: 1 hari lalu');
cek('8 hari kurang 1 jam: belum peringatan', r(jamLalu(8 * 24 - 1)).peringatan === false);
cek('8 hari lebih 1 jam: peringatan', r(jamLalu(8 * 24 + 1)).peringatan === true && /Lebih dari 8 hari/.test(r(jamLalu(8 * 24 + 1)).catatan ?? ''));
cek('belum pernah tercatat: peringatan', ringkasCadangan(null, SEKARANG).peringatan === true);
cek('percobaan terakhir gagal: peringatan', r(jamLalu(30), 'gagal').peringatan === true && /GAGAL/.test(r(jamLalu(30), 'gagal').catatan ?? ''));
console.log(`${hasil.filter(Boolean).length}/${hasil.length} lolos`);
process.exit(hasil.every(Boolean) ? 0 : 1);
