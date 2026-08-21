import { Terlindungi } from '../../components/Terlindungi';

export default function TerpusatPage() {
  return (
    <Terlindungi peran="pusat">
      <main className="p-6">
        <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
          Laporan Terpusat
        </h1>
        <p>Menyusul di Task 21.</p>
      </main>
    </Terlindungi>
  );
}
