import { Terlindungi } from '../../components/Terlindungi';

export default function AdminPage() {
  return (
    <Terlindungi peran="ceo">
      <main className="p-6">
        <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
          Admin
        </h1>
        <p>Menyusul di Task 23.</p>
      </main>
    </Terlindungi>
  );
}
