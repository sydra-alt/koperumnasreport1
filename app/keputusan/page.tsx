'use client';

import { useMemo, useState } from 'react';
import { Terlindungi } from '../../components/Terlindungi';
import { AntreanKartu } from '../../components/AntreanKartu';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useAntreanKeputusan, useMemutuskan, useRiwayatKeputusan, type KeputusanRow } from '../../lib/api/decision';

type Urutan = 'urgensi' | 'deadline' | 'nominal';

function urutkan(baris: KeputusanRow[], urutan: Urutan): KeputusanRow[] {
  const disalin = [...baris];
  if (urutan === 'nominal') return disalin.sort((a, b) => b.nominal - a.nominal);
  if (urutan === 'deadline') {
    return disalin.sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return a.deadline.localeCompare(b.deadline);
    });
  }
  return disalin; // 'urgensi' -- sudah urut dari query (decision_antrean_idx)
}

function KeputusanIsi() {
  const { roles } = useAuth();
  const bolehMemutuskan = roles.includes('ceo');
  const [tab, setTab] = useState<'menunggu' | 'riwayat'>('menunggu');
  const [urutan, setUrutan] = useState<Urutan>('urgensi');

  const { data: antrean, isLoading: memuatAntrean } = useAntreanKeputusan();
  const { data: riwayat, isLoading: memuatRiwayat } = useRiwayatKeputusan();
  const memutuskan = useMemutuskan();
  const [sedangDiproses, setSedangDiproses] = useState<string | null>(null);

  const antreanTerurut = useMemo(() => urutkan(antrean ?? [], urutan), [antrean, urutan]);

  async function tanganiPutuskan(id: string, status: 'disetujui' | 'dicicil' | 'ditunda' | 'ditolak', catatan: string | null) {
    setSedangDiproses(id);
    try {
      await memutuskan.mutateAsync({ id, status, catatan });
    } finally {
      setSedangDiproses(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('menunggu')}
          className={tab === 'menunggu' ? 'tombol-utama' : 'tombol-sekunder'}
          style={{ fontSize: 14, padding: '8px 16px', minHeight: 44 }}
        >
          Menunggu
        </button>
        <button
          type="button"
          onClick={() => setTab('riwayat')}
          className={tab === 'riwayat' ? 'tombol-utama' : 'tombol-sekunder'}
          style={{ fontSize: 14, padding: '8px 16px', minHeight: 44 }}
        >
          Riwayat
        </button>
      </div>

      {tab === 'menunggu' && (
        <>
          {!bolehMemutuskan && (
            <div className="flex items-center gap-2 text-sm">
              <span style={{ color: 'var(--label)' }}>Urutkan:</span>
              {(['urgensi', 'deadline', 'nominal'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrutan(u)}
                  className={urutan === u ? 'tombol-utama' : 'tombol-sekunder'}
                  style={{ fontSize: 13, padding: '6px 12px', minHeight: 44 }}
                >
                  {u}
                </button>
              ))}
            </div>
          )}
          {memuatAntrean && <p>Memuat…</p>}
          {!memuatAntrean && antreanTerurut.length === 0 && <p style={{ color: 'var(--kosong)' }}>Tidak ada yang menunggu keputusan.</p>}
          <div className="flex flex-col gap-3">
            {antreanTerurut.map((b) => (
              <AntreanKartu
                key={b.id}
                baris={b}
                bolehMemutuskan={bolehMemutuskan}
                memutuskan={sedangDiproses === b.id}
                onPutuskan={(status, catatan) => void tanganiPutuskan(b.id, status, catatan)}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'riwayat' && (
        <>
          {memuatRiwayat && <p>Memuat…</p>}
          {!memuatRiwayat && (riwayat ?? []).length === 0 && <p style={{ color: 'var(--kosong)' }}>Belum ada riwayat keputusan.</p>}
          <div className="flex flex-col gap-3">
            {(riwayat ?? []).map((b) => (
              <AntreanKartu key={b.id} baris={b} bolehMemutuskan={false} memutuskan={false} onPutuskan={() => {}} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function KeputusanPage() {
  return (
    <Terlindungi peran={['ceo', 'pusat']}>
      <main className="flex flex-col gap-4 p-6">
        <h1 style={{ fontSize: 'var(--ukuran-angka-besar)', lineHeight: 1.2 }}>
          Antrean Keputusan
        </h1>
        <KeputusanIsi />
      </main>
    </Terlindungi>
  );
}
