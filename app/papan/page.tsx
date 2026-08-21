import { Terlindungi } from '../../components/Terlindungi';

export default function PapanPage() {
  return (
    <Terlindungi peran={['ceo', 'pusat']}>
      <main className="p-6">
        <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
          Papan Kontrol
        </h1>
        <p>Menyusul di Task 18.</p>
      </main>
    </Terlindungi>
  );
}
