import { LaporForm } from '../../../components/LaporForm';

export default async function LaporPage({ params }: PageProps<'/lapor/[formKey]'>) {
  const { formKey } = await params;
  return <LaporForm formKey={formKey} />;
}
