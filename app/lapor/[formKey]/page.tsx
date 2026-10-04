import Link from 'next/link';
import { LaporForm } from '../../../components/LaporForm';
import { LaporanKebersihan } from '../../../components/LaporanKebersihan';
import { createClient } from '../../../lib/supabase/server';
import { TEKS_PENUGASAN } from '../../../lib/istilah';

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
      <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl" style={{ color: 'var(--merah)' }}>
          {error ? 'Gagal memeriksa penugasan' : 'Anda tidak ditugaskan untuk form ini'}
        </h1>
        <p style={{ maxWidth: 360 }}>
          {error
            ? 'Muat ulang halaman ini. Kalau tetap gagal, hubungi Admin.'
            : 'Form ini hanya bisa diisi oleh yang ditugaskan. Kalau ini memang tugas Anda, minta Admin menambahkan penugasannya.'}
        </p>
        {!error && (
          <p className="text-sm" style={{ maxWidth: 360, color: 'var(--label)' }}>
            {TEKS_PENUGASAN}
          </p>
        )}
        <Link href="/" className="tombol-utama" style={{ minHeight: 48, paddingInline: 24, display: 'inline-flex', alignItems: 'center' }}>
          Kembali ke Beranda
        </Link>
      </main>
    );
  }

  // Laporan Kebersihan BUKAN form berbasis field (5 foto lewat kamera
  // langsung, tanpa FormRenderer) -- lihat forms/f18-kebersihan.ts.
  if (formKey === 'kebersihan') return <LaporanKebersihan />;
  return <LaporForm formKey={formKey} />;
}
