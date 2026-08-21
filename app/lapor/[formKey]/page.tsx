export default async function LaporPage({ params }: PageProps<'/lapor/[formKey]'>) {
  const { formKey } = await params;

  return (
    <main className="p-6">
      <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
        Lapor: {formKey}
      </h1>
      <p>FormRenderer untuk form ini menyusul mulai Task 12.</p>
    </main>
  );
}
