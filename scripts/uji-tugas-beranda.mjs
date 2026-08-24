#!/usr/bin/env node
// Uji lib/tugasHariIni.ts (Beranda, 24 Agustus 2026) -- fungsi MURNI, tidak
// bisa diimpor langsung dari skrip .mjs (TypeScript + resolusi path tanpa
// ekstensi, tidak didukung Node native type-stripping tanpa loader
// tambahan) -- direplikasi 1:1 di sini, dijaga tetap identik lewat
// perbandingan manual dengan isi file aslinya sebelum tiap uji dijalankan.
// registry form yang dipakai di sini SINTETIS (bukan forms/index.ts asli)
// -- yang diuji kontrak fungsinya (dedup, status, label), bukan nama form
// sungguhan.

const LABEL_SHIFT = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };
const FORM_REGISTRY = {
  personal_marketing: { nama: 'Laporan Personal Marketing' },
  pic_lokasi: { nama: 'Laporan Lokasi' },
  security: { nama: 'Laporan Keamanan' },
};

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

function kunciScope(lokasiId, outletId, shift) {
  return `${lokasiId ?? ''}|${outletId ?? ''}|${shift ?? ''}`;
}

function labelSisaWaktu(deadline, jamSekarang) {
  const [dj, dm] = deadline.split(':').map(Number);
  const [sj, sm] = jamSekarang.split(':').map(Number);
  const menitDeadline = dj * 60 + dm;
  const menitSekarang = sj * 60 + sm;
  const selisih = menitSekarang - menitDeadline;
  if (selisih <= 0) return { label: `batas ${deadline.replace(':', '.')}`, lewat: false };
  const jam = Math.floor(selisih / 60);
  const menit = selisih % 60;
  const label = jam > 0 ? `terlambat ${jam} jam${menit > 0 ? ` ${menit} menit` : ''}` : `terlambat ${menit} menit`;
  return { label, lewat: true };
}

function sapaanWaktu(jamSekarang) {
  const jam = Number(jamSekarang.split(':')[0]);
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function hitungTugasHariIni(assignments, roles, laporanHariIni, policy, jamSekarang, namaLokasi, namaOutlet) {
  function statusUntuk(formKey, lokasiId, outletId, shift) {
    const cocok = laporanHariIni.find(
      (r) => r.form_key === formKey && kunciScope(r.lokasi_id, r.outlet_id, r.shift) === kunciScope(lokasiId, outletId, shift),
    );
    if (!cocok) return 'belum';
    return cocok.status === 'draft' ? 'draft' : 'selesai';
  }
  function baris(formKey, namaForm, scopeLabel, lokasiId, outletId, shift) {
    const status = statusUntuk(formKey, lokasiId, outletId, shift);
    if (status === 'draft') return { formKey, namaForm, scopeLabel, status, label: 'tersimpan, belum dikirim', lewatDeadline: false, tombol: 'Lanjutkan' };
    if (status === 'selesai') return { formKey, namaForm, scopeLabel, status, label: '', lewatDeadline: false, tombol: '' };
    const { label, lewat } = labelSisaWaktu(batasJamKirim(policy, formKey, shift), jamSekarang);
    return { formKey, namaForm, scopeLabel, status, label, lewatDeadline: lewat, tombol: 'Isi sekarang' };
  }

  const hasil = [];
  if (roles.includes('karyawan')) {
    hasil.push(baris('personal_marketing', FORM_REGISTRY.personal_marketing.nama, null, null, null, null));
  }
  const peta = new Map();
  for (const a of assignments) {
    if (a.form_key === 'personal_marketing') continue;
    if (!FORM_REGISTRY[a.form_key]) continue;
    const kunci = `${a.form_key}|${kunciScope(a.lokasi_id, a.outlet_id, a.shift)}`;
    if (!peta.has(kunci)) peta.set(kunci, a);
  }
  for (const a of peta.values()) {
    const namaScope = a.lokasi_id ? namaLokasi(a.lokasi_id) : a.outlet_id ? namaOutlet(a.outlet_id) : null;
    const scopeLabel = [namaScope, a.shift ? LABEL_SHIFT[a.shift] : null].filter(Boolean).join(' · ') || null;
    hasil.push(baris(a.form_key, FORM_REGISTRY[a.form_key].nama, scopeLabel, a.lokasi_id, a.outlet_id, a.shift));
  }
  return hasil;
}

function cek(kondisi, pesan) {
  console.log((kondisi ? 'OK: ' : 'SALAH: ') + pesan);
  if (!kondisi) process.exitCode = 1;
}

console.log('\n════ UJI labelSisaWaktu ════');
cek(labelSisaWaktu('18:00', '17:59').label === 'batas 18.00', 'sebelum deadline -> "batas 18.00"');
cek(labelSisaWaktu('18:00', '18:00').lewat === false, 'tepat di deadline -> BELUM lewat (selisih=0)');
cek(labelSisaWaktu('18:00', '19:05').label === 'terlambat 1 jam 5 menit', 'lewat 1 jam 5 menit -> label benar');
cek(labelSisaWaktu('18:00', '18:30').label === 'terlambat 30 menit', 'lewat 30 menit (< 1 jam) -> tanpa kata "jam"');

console.log('\n════ UJI sapaanWaktu (batas jam) ════');
cek(sapaanWaktu('10:59') === 'Selamat pagi', '10:59 -> pagi');
cek(sapaanWaktu('11:00') === 'Selamat siang', '11:00 -> siang (batas)');
cek(sapaanWaktu('14:59') === 'Selamat siang', '14:59 -> siang');
cek(sapaanWaktu('15:00') === 'Selamat sore', '15:00 -> sore (batas)');
cek(sapaanWaktu('17:59') === 'Selamat sore', '17:59 -> sore');
cek(sapaanWaktu('18:00') === 'Selamat malam', '18:00 -> malam (batas)');

console.log('\n════ UJI hitungTugasHariIni ════');
const policy = { deadline_default: '18:00', deadline_by_form: { security: 'per_shift' }, shift_deadline: { pagi: '14:30' } };
const namaLokasi = (id) => ({ tajur: 'Tajur', bekasi: 'Bekasi' })[id] ?? id;
const namaOutlet = (id) => id;

// Karyawan biasa, PIC 2 lokasi, belum kirim apa pun -- harap 3 tugas (personal_marketing + 2 lokasi).
const t1 = hitungTugasHariIni(
  [
    { form_key: 'pic_lokasi', lokasi_id: 'tajur', outlet_id: null, shift: null },
    { form_key: 'pic_lokasi', lokasi_id: 'bekasi', outlet_id: null, shift: null },
  ],
  ['pic_lokasi', 'karyawan'],
  [],
  policy,
  '10:00',
  namaLokasi,
  namaOutlet,
);
cek(t1.length === 3, `3 tugas (personal_marketing + 2 lokasi) -- dapat ${t1.length}`);
cek(t1.every((t) => t.status === 'belum'), 'semuanya status "belum" (belum ada laporan hari ini)');
cek(t1.find((t) => t.formKey === 'pic_lokasi' && t.scopeLabel === 'Tajur') !== undefined, 'tugas Tajur ada dengan label scope benar');

// Assignment DOBEL ke lokasi yang sama (data kotor) -- harap TETAP 1 tugas, bukan 2.
const t2 = hitungTugasHariIni(
  [
    { form_key: 'pic_lokasi', lokasi_id: 'tajur', outlet_id: null, shift: null },
    { form_key: 'pic_lokasi', lokasi_id: 'tajur', outlet_id: null, shift: null },
  ],
  ['pic_lokasi', 'karyawan'],
  [],
  policy,
  '10:00',
  namaLokasi,
  namaOutlet,
);
cek(t2.filter((t) => t.formKey === 'pic_lokasi').length === 1, 'assignment dobel ke scope sama -> dedup jadi 1 tugas');

// CEO tanpa role karyawan -- TIDAK ada tugas personal_marketing sama sekali.
const t3 = hitungTugasHariIni([], ['ceo'], [], policy, '10:00', namaLokasi, namaOutlet);
cek(t3.length === 0, `CEO tanpa role karyawan -> 0 tugas (dapat ${t3.length})`);

// Draft hari ini -- status "draft", label "tersimpan, belum dikirim", tombol "Lanjutkan".
const t4 = hitungTugasHariIni(
  [],
  ['karyawan'],
  [{ form_key: 'personal_marketing', lokasi_id: null, outlet_id: null, shift: null, status: 'draft' }],
  policy,
  '10:00',
  namaLokasi,
  namaOutlet,
);
cek(t4[0].status === 'draft' && t4[0].label === 'tersimpan, belum dikirim' && t4[0].tombol === 'Lanjutkan', 'laporan draft -> status/label/tombol benar');

// Terkirim hari ini -- status "selesai".
const t5 = hitungTugasHariIni(
  [],
  ['karyawan'],
  [{ form_key: 'personal_marketing', lokasi_id: null, outlet_id: null, shift: null, status: 'terkirim' }],
  policy,
  '10:00',
  namaLokasi,
  namaOutlet,
);
cek(t5[0].status === 'selesai', 'laporan terkirim -> status "selesai"');

// form_key yang TIDAK terdaftar di registry -- dilewati, tidak jadi tugas mati.
const t6 = hitungTugasHariIni(
  [{ form_key: 'form_belum_ada', lokasi_id: null, outlet_id: null, shift: null }],
  ['karyawan'],
  [],
  policy,
  '10:00',
  namaLokasi,
  namaOutlet,
);
cek(t6.length === 1 && t6[0].formKey === 'personal_marketing', 'form_key tak terdaftar dilewati, cuma personal_marketing yang muncul');

// Shift -- deadline per_shift dipakai benar (security, shift pagi, deadline 14:30).
const t7 = hitungTugasHariIni(
  [{ form_key: 'security', lokasi_id: 'tajur', outlet_id: null, shift: 'pagi' }],
  ['karyawan'],
  [],
  policy,
  '15:00',
  namaLokasi,
  namaOutlet,
);
const tugasSecurity = t7.find((t) => t.formKey === 'security');
cek(tugasSecurity.lewatDeadline === true && tugasSecurity.label.startsWith('terlambat'), `security shift pagi jam 15:00 (deadline 14:30) -> terlambat (dapat "${tugasSecurity.label}")`);
cek(tugasSecurity.scopeLabel === 'Tajur · Pagi', `label scope gabung lokasi + shift (dapat "${tugasSecurity.scopeLabel}")`);

console.log(process.exitCode ? '\n❌ ADA YANG GAGAL' : '\n✅ SEMUA LOLOS');
