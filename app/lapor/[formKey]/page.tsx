import { LaporForm } from '../../../components/LaporForm';
import { LaporanKebersihan } from '../../../components/LaporanKebersihan';

export default async function LaporPage({ params }: PageProps<'/lapor/[formKey]'>) {
  const { formKey } = await params;
  // Laporan Kebersihan BUKAN form berbasis field (5 foto lewat kamera
  // langsung, tanpa FormRenderer) -- lihat forms/f18-kebersihan.ts.
  if (formKey === 'kebersihan') return <LaporanKebersihan />;
  return <LaporForm formKey={formKey} />;
}
