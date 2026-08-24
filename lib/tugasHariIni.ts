import type { PolicyMap } from './api/policy';
import { batasJamKirim } from './api/report';
import { formRegistry } from '../forms';

const LABEL_SHIFT: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

export interface AssignmentRingkas {
  form_key: string;
  lokasi_id: string | null;
  outlet_id: string | null;
  shift: string | null;
}

export interface LaporanHariIniRingkas {
  form_key: string;
  lokasi_id: string | null;
  outlet_id: string | null;
  shift: string | null;
  status: 'draft' | 'terkirim' | 'terlambat';
}

export interface TugasHariIni {
  formKey: string;
  namaForm: string;
  scopeLabel: string | null;
  status: 'belum' | 'draft' | 'selesai';
  /** "batas 18.00" / "terlambat 2 jam" / "tersimpan, belum dikirim" / "" (kalau selesai). */
  label: string;
  lewatDeadline: boolean;
  tombol: string;
}

function kunciScope(lokasiId: string | null, outletId: string | null, shift: string | null): string {
  return `${lokasiId ?? ''}|${outletId ?? ''}|${shift ?? ''}`;
}

/** "batas 18.00" kalau belum lewat, "terlambat X jam Y menit" kalau sudah -- dua jam WIB 'HH:mm', bukan Date/instant, jadi tidak ada risiko tebakan zona waktu. */
function labelSisaWaktu(deadline: string, jamSekarang: string): { label: string; lewat: boolean } {
  const [dj, dm] = deadline.split(':').map(Number);
  const [sj, sm] = jamSekarang.split(':').map(Number);
  const menitDeadline = dj * 60 + dm;
  const menitSekarang = sj * 60 + sm;
  const selisih = menitSekarang - menitDeadline;

  if (selisih <= 0) {
    return { label: `batas ${deadline.replace(':', '.')}`, lewat: false };
  }
  const jam = Math.floor(selisih / 60);
  const menit = selisih % 60;
  const label = jam > 0 ? `terlambat ${jam} jam${menit > 0 ? ` ${menit} menit` : ''}` : `terlambat ${menit} menit`;
  return { label, lewat: true };
}

/**
 * Beranda (24 Agustus 2026) -- daftar "yang perlu dikerjakan hari ini",
 * digabung dari DUA sumber: kewajiban `personal_marketing` (siapa pun
 * berperan `karyawan`, BUKAN dari `assignment` -- lihat catatan
 * `lib/navLapor.ts`) dan penugasan `assignment` biasa (dedup per
 * form_key+lokasi/outlet+shift, pola sama dengan `kombinasiDitugaskan` di
 * `components/LaporForm.tsx`). TIDAK ADA view/tabel baru -- murni menyusun
 * ulang data yang sudah diambil hook lain (`useAuth().assignments`,
 * laporan hari ini milik sendiri, `usePolicy()`).
 */
export function hitungTugasHariIni(
  assignments: AssignmentRingkas[],
  roles: string[],
  laporanHariIni: LaporanHariIniRingkas[],
  policy: PolicyMap,
  jamSekarang: string,
  namaLokasi: (id: string) => string,
  namaOutlet: (id: string) => string,
): TugasHariIni[] {
  function statusUntuk(formKey: string, lokasiId: string | null, outletId: string | null, shift: string | null): 'belum' | 'draft' | 'selesai' {
    const cocok = laporanHariIni.find(
      (r) => r.form_key === formKey && kunciScope(r.lokasi_id, r.outlet_id, r.shift) === kunciScope(lokasiId, outletId, shift),
    );
    if (!cocok) return 'belum';
    return cocok.status === 'draft' ? 'draft' : 'selesai';
  }

  function baris(formKey: string, namaForm: string, scopeLabel: string | null, lokasiId: string | null, outletId: string | null, shift: string | null): TugasHariIni {
    const status = statusUntuk(formKey, lokasiId, outletId, shift);
    if (status === 'draft') {
      return { formKey, namaForm, scopeLabel, status, label: 'tersimpan, belum dikirim', lewatDeadline: false, tombol: 'Lanjutkan' };
    }
    if (status === 'selesai') {
      return { formKey, namaForm, scopeLabel, status, label: '', lewatDeadline: false, tombol: '' };
    }
    const { label, lewat } = labelSisaWaktu(batasJamKirim(policy, formKey, shift), jamSekarang);
    return { formKey, namaForm, scopeLabel, status, label, lewatDeadline: lewat, tombol: 'Isi sekarang' };
  }

  const hasil: TugasHariIni[] = [];

  if (roles.includes('karyawan')) {
    hasil.push(baris('personal_marketing', formRegistry.personal_marketing?.nama ?? 'Laporan Personal Marketing', null, null, null, null));
  }

  const peta = new Map<string, AssignmentRingkas>();
  for (const a of assignments) {
    if (a.form_key === 'personal_marketing') continue;
    if (!formRegistry[a.form_key]) continue;
    const kunci = `${a.form_key}|${kunciScope(a.lokasi_id, a.outlet_id, a.shift)}`;
    if (!peta.has(kunci)) peta.set(kunci, a);
  }

  for (const a of peta.values()) {
    const namaScope = a.lokasi_id ? namaLokasi(a.lokasi_id) : a.outlet_id ? namaOutlet(a.outlet_id) : null;
    const scopeLabel = [namaScope, a.shift ? LABEL_SHIFT[a.shift] : null].filter(Boolean).join(' · ') || null;
    hasil.push(baris(a.form_key, formRegistry[a.form_key].nama, scopeLabel, a.lokasi_id, a.outlet_id, a.shift));
  }

  return hasil;
}

export function sapaanWaktu(jamSekarang: string): string {
  const jam = Number(jamSekarang.split(':')[0]);
  if (jam < 11) return 'Selamat pagi';
  if (jam < 15) return 'Selamat siang';
  if (jam < 18) return 'Selamat sore';
  return 'Selamat malam';
}
