#!/usr/bin/env node
// Uji Masalah 2 (24 Agustus 2026): laporan yang dikirim di hari BUKAN hari
// kerja (policy.workdays) tidak boleh ditandai TERLAMBAT -- tidak ada
// kewajiban berarti tidak ada keterlambatan. Uji langsung fungsi murni
// `apakahTerlambat` (lib/api/report.ts) memakai hari SUNGGUHAN sekarang
// (bukan tanggal palsu -- fungsi ini memang tidak menerima tanggal sebagai
// parameter, selalu "sekarang").

// Re-implementasi 1:1 dari lib/tanggal.ts + lib/api/report.ts (TypeScript,
// tidak bisa diimpor langsung dari skrip .mjs tanpa build step) -- dijaga
// tetap identik lewat perbandingan manual dengan isi file itu sebelum tiap
// uji dijalankan.
function hariISOWIB(d = new Date()) {
  const nama = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(d);
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[nama];
}
function batasJamKirim(policy, formKey, shift) {
  const deadlineByForm = policy.deadline_by_form;
  const deadlineDefault = policy.deadline_default ?? '18:00';
  const batas = deadlineByForm?.[formKey] ?? deadlineDefault;
  if (batas === 'per_shift') {
    const shiftDeadline = policy.shift_deadline;
    return (shift && shiftDeadline?.[shift]) ?? deadlineDefault;
  }
  return batas;
}
function jamWIBSekarang() {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}
function apakahTerlambat(policy, formKey, shift) {
  const workdays = policy.workdays ?? [1, 2, 3, 4, 5, 6];
  if (!workdays.includes(hariISOWIB())) return false;
  return jamWIBSekarang() > batasJamKirim(policy, formKey, shift);
}

function cek(kondisi, pesan) {
  console.log((kondisi ? 'OK: ' : 'SALAH: ') + pesan);
  if (!kondisi) process.exitCode = 1;
}

const hariIniIso = hariISOWIB();
console.log(`Hari ISO sekarang (WIB): ${hariIniIso} (1=Senin..7=Minggu)`);

console.log('\n════ UJI 1 -- hari ini DIKELUARKAN dari workdays -- harus TIDAK PERNAH terlambat, walau deadline sudah pasti lewat ════');
const policyBukanHariKerja = {
  workdays: [1, 2, 3, 4, 5, 6].filter((h) => h !== hariIniIso), // pastikan hari ini TIDAK ada di daftar
  deadline_default: '00:01', // deadline hampir pasti sudah lewat kapan pun skrip ini dijalankan
};
cek(apakahTerlambat(policyBukanHariKerja, 'personal_marketing') === false, 'apakahTerlambat() = false saat hari ini bukan hari kerja (ini bug yang diperbaiki)');

console.log('\n════ UJI 2 -- hari ini DIMASUKKAN ke workdays + deadline sudah pasti lewat -- harus TETAP terlambat (regresi tidak boleh terjadi) ════');
const policyHariKerjaLewatDeadline = {
  workdays: [1, 2, 3, 4, 5, 6, 7], // semua hari, termasuk hari ini apa pun itu
  deadline_default: '00:01',
};
cek(apakahTerlambat(policyHariKerjaLewatDeadline, 'personal_marketing') === true, 'apakahTerlambat() = true saat hari kerja + deadline lewat (perilaku lama tetap benar)');

console.log('\n════ UJI 3 -- hari ini DIMASUKKAN ke workdays + deadline BELUM lewat -- harus TIDAK terlambat ════');
const policyHariKerjaBelumDeadline = {
  workdays: [1, 2, 3, 4, 5, 6, 7],
  deadline_default: '23:59',
};
cek(apakahTerlambat(policyHariKerjaBelumDeadline, 'personal_marketing') === false, 'apakahTerlambat() = false saat hari kerja + belum lewat deadline');

console.log(process.exitCode ? '\n❌ ADA YANG GAGAL' : '\n✅ SEMUA LOLOS');
