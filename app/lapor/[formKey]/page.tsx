import Link from 'next/link';
import { LaporForm } from '../../../components/LaporForm';
import { LaporanKebersihan } from '../../../components/LaporanKebersihan';
import { createClient } from '../../../lib/supabase/server';
import { TEKS_PENUGASAN } from '../../../lib/istilah';
import { PESAN_MARKETING_NONAKTIF } from '../../../lib/marketing';

export default async function LaporPage({ params }: PageProps<'/lapor/[formKey]'>) {
  const { formKey } = await params;

  // Gerbang server (4 Oktober 2026, audit UI R01, migrasi 0069): form hanya
  // dirender untuk yang ditugaskan (atau CEO/Admin, atau pengecualian
  // personal_marketing/kebersihan -- lihat boleh_buka_form). Form yang tidak
  // dirender tidak pernah membuat baris apa pun (draf/kebersihan). RLS
  // report_insert/report_update menegakkan aturan yang sama di database.
  const supabase = await createClient();
  const { data: boleh, error } = await supabase.rpc('boleh_buka_form', { f: formKey });
  if (error || boleh !== true) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center p-6 text-center" style={{ background: 'var(--halaman)' }}>
        <div className="neumo-kartu flex w-full max-w-sm flex-col items-center gap-3 p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(217, 37, 37, 0.1)', color: 'var(--merah)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--merah)' }}>
            {error ? 'Gagal memeriksa penugasan' : 'Tidak Ditugaskan'}
          </h1>
          <p className="text-xs" style={{ color: 'var(--tinta)' }}>
            {error
              ? 'Muat ulang halaman ini. Kalau tetap gagal, hubungi Admin.'
              : 'Form ini hanya bisa diisi oleh personil yang ditugaskan.'}
          </p>
          {!error && (
            <p className="text-xs" style={{ color: 'var(--label)' }}>
              {TEKS_PENUGASAN}
            </p>
          )}
          <Link href="/" className="tombol-utama mt-2 w-full text-center">
            Kembali ke Beranda
          </Link>
        </div>
      </main>
    );
  }

  // Personal Marketing tidak berlaku lagi (keputusan CEO 6 Oktober 2026, policy marketing_aktif,
  // lib/marketing.ts) -- form tidak dirender, tidak ada baris yang dibuat; data lama tetap ada.
  if (formKey === 'personal_marketing') {
    const { data: saklar } = await supabase.from('policy').select('value').eq('key', 'marketing_aktif').maybeSingle();
    if (saklar?.value === false) {
      return (
        <main className="flex min-h-svh flex-col items-center justify-center p-6 text-center" style={{ background: 'var(--halaman)' }}>
          <div className="neumo-kartu flex w-full max-w-sm flex-col items-center gap-3 p-8">
            <h1 className="text-lg font-bold" style={{ color: 'var(--tinta)' }}>Laporan Marketing</h1>
            <p className="text-xs" style={{ color: 'var(--label)' }}>{PESAN_MARKETING_NONAKTIF}</p>
            <Link href="/" className="tombol-utama mt-2 w-full text-center">
              Kembali ke Beranda
            </Link>
          </div>
        </main>
      );
    }
  }

  // Laporan Kebersihan BUKAN form berbasis field (5 foto lewat kamera
  // langsung, tanpa FormRenderer) -- lihat forms/f18-kebersihan.ts.
  if (formKey === 'kebersihan') return <LaporanKebersihan />;
  return <LaporForm formKey={formKey} />;
}
