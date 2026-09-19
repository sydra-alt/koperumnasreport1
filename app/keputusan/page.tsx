'use client';

import { useMemo, useState } from 'react';
import { Terlindungi } from '../../components/Terlindungi';
import { AntreanKartu, LABEL_STATUS, LABEL_URGENSI } from '../../components/AntreanKartu';
import { KerangkaDaftarKartu } from '../../components/Kerangka';
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

const TINGKAT_URGENSI = [1, 2, 3] as const;
const HASIL_RIWAYAT = ['disetujui', 'dicicil', 'ditunda', 'ditolak'] as const;

/** Panel kosong sederhana (menggantikan teks polos). */
function PanelKosong({ judul, isi }: { judul: string; isi: string }) {
  return (
    <div className="panel">
      <div className="panel-baris">
        <p className="judul-seksi">{judul}</p>
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>{isi}</p>
      </div>
    </div>
  );
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

  // Semua angka ringkasan dihitung dari data yang SUDAH dimuat (tanpa query baru).
  const jumlahPerUrgensi = (n: number) => (antrean ?? []).filter((b) => b.urgensi === n).length;
  const jumlahUrgent = jumlahPerUrgensi(1);
  const jumlahPerHasil = (h: string) => (riwayat ?? []).filter((b) => b.status === h).length;

  const kelompok = TINGKAT_URGENSI.map((n) => ({ n, baris: antreanTerurut.filter((b) => b.urgensi === n) })).filter((k) => k.baris.length > 0);
  const lainnya = antreanTerurut.filter((b) => !(TINGKAT_URGENSI as readonly number[]).includes(b.urgensi));

  const tabKelas = (aktif: boolean) => ({
    minHeight: 44,
    borderRadius: 10,
    background: aktif ? 'var(--biru)' : 'transparent',
    color: aktif ? 'var(--kertas-2)' : 'var(--tinta)',
    fontWeight: aktif ? 600 : 500,
    fontSize: 14,
  });

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="sapaan">Antrean Keputusan</h1>
        {antrean && (
          <p className="text-sm" style={{ color: 'var(--label)' }}>
            {antrean.length} menunggu · {jumlahUrgent} urgent
          </p>
        )}
      </header>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,720px)_300px] lg:items-start lg:gap-x-8">
        {/* Tab (segmented control) */}
        <div
          role="tablist"
          aria-label="Daftar keputusan"
          className="grid grid-cols-2 gap-1 p-1 lg:col-start-1 lg:row-start-1"
          style={{ background: 'var(--permukaan)', border: '1px solid var(--garis)', borderRadius: 14 }}
        >
          <button type="button" role="tab" aria-selected={tab === 'menunggu'} onClick={() => setTab('menunggu')} style={tabKelas(tab === 'menunggu')}>
            Menunggu{antrean ? ` ${antrean.length}` : ''}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'riwayat'} onClick={() => setTab('riwayat')} style={tabKelas(tab === 'riwayat')}>
            Riwayat{riwayat ? ` ${riwayat.length}` : ''}
          </button>
        </div>

        {/* Ringkasan (HP: di bawah tab; desktop: kolom samping sticky). Murni hitungan dari data yang sudah ada. */}
        <aside className="panel lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="Ringkasan">
          <div className="panel-baris hidden lg:block">
            <p className="judul-seksi">{tab === 'menunggu' ? 'Ringkasan urgensi' : 'Ringkasan hasil'}</p>
          </div>
          <div className={`grid lg:grid-cols-1 ${tab === 'menunggu' ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {(tab === 'menunggu'
              ? TINGKAT_URGENSI.map((n) => ({ kunci: `u${n}`, teks: LABEL_URGENSI[n].teks, warna: LABEL_URGENSI[n].warna, jumlah: jumlahPerUrgensi(n) }))
              : HASIL_RIWAYAT.map((h) => ({ kunci: h, teks: LABEL_STATUS[h].teks, warna: LABEL_STATUS[h].warna, jumlah: jumlahPerHasil(h) }))
            ).map((s, i) => (
              <div
                key={s.kunci}
                className={`flex flex-col gap-0.5 px-3 py-3 lg:flex-row lg:items-baseline lg:justify-between lg:px-4 ${
                  i > 0 ? 'border-l lg:border-l-0 lg:border-t' : ''
                } lg:border-t`}
                style={{ borderColor: 'var(--garis)' }}
              >
                <span className="angka-kecil order-1 lg:order-2" style={{ color: s.warna, fontFamily: 'var(--mono)' }}>
                  {tab === 'menunggu' ? (memuatAntrean ? '–' : s.jumlah) : memuatRiwayat ? '–' : s.jumlah}
                </span>
                <span className="order-2 text-sm lg:order-1" style={{ color: 'var(--label)', fontSize: 13 }}>
                  {s.teks}
                </span>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-2">
          {tab === 'menunggu' && (
            <>
              {!bolehMemutuskan && (
                <div className="panel">
                  <div className="panel-baris flex flex-wrap items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--label)' }}>Urutkan</span>
                    {(['urgensi', 'deadline', 'nominal'] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUrutan(u)}
                        className={urutan === u ? 'tombol-utama' : 'tombol-sekunder'}
                        style={{ fontSize: 13, padding: '6px 14px', minHeight: 44 }}
                      >
                        {u.charAt(0).toUpperCase() + u.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {memuatAntrean && <KerangkaDaftarKartu />}
              {!memuatAntrean && antreanTerurut.length === 0 && <PanelKosong judul="Tidak ada keputusan" isi="Tidak ada yang menunggu keputusan." />}

              {/* Urutan 'urgensi' (bawaan query): dikelompokkan per tingkat. Urutan lain (khusus pusat): satu daftar
                  datar supaya urutan pilihan tidak dipecah oleh kelompok. Urutan data TIDAK diubah. */}
              {urutan === 'urgensi' ? (
                <>
                  {kelompok.map(({ n, baris }) => (
                    <section key={n} className="panel">
                      <div className="panel-baris flex items-baseline justify-between gap-3">
                        <h2 className="judul-seksi" style={{ color: LABEL_URGENSI[n].warna }}>{LABEL_URGENSI[n].teks}</h2>
                        <span className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>{baris.length}</span>
                      </div>
                      {baris.map((b) => (
                        <AntreanKartu
                          key={b.id}
                          baris={b}
                          bolehMemutuskan={bolehMemutuskan}
                          memutuskan={sedangDiproses === b.id}
                          onPutuskan={(status, catatan) => void tanganiPutuskan(b.id, status, catatan)}
                        />
                      ))}
                    </section>
                  ))}
                  {lainnya.length > 0 && (
                    <section className="panel">
                      {lainnya.map((b) => (
                        <AntreanKartu
                          key={b.id}
                          baris={b}
                          bolehMemutuskan={bolehMemutuskan}
                          memutuskan={sedangDiproses === b.id}
                          onPutuskan={(status, catatan) => void tanganiPutuskan(b.id, status, catatan)}
                        />
                      ))}
                    </section>
                  )}
                </>
              ) : (
                antreanTerurut.length > 0 && (
                  <section className="panel">
                    <div className="panel-baris flex items-baseline justify-between gap-3">
                      <h2 className="judul-seksi">Urut menurut {urutan}</h2>
                      <span className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>{antreanTerurut.length}</span>
                    </div>
                    {antreanTerurut.map((b) => (
                      <AntreanKartu
                        key={b.id}
                        baris={b}
                        bolehMemutuskan={bolehMemutuskan}
                        memutuskan={sedangDiproses === b.id}
                        onPutuskan={(status, catatan) => void tanganiPutuskan(b.id, status, catatan)}
                      />
                    ))}
                  </section>
                )
              )}
            </>
          )}

          {tab === 'riwayat' && (
            <>
              {memuatRiwayat && <KerangkaDaftarKartu />}
              {!memuatRiwayat && (riwayat ?? []).length === 0 && <PanelKosong judul="Tidak ada keputusan" isi="Belum ada riwayat keputusan." />}
              {(riwayat ?? []).length > 0 && (
                <section className="panel">
                  <div className="panel-baris flex items-baseline justify-between gap-3">
                    <h2 className="judul-seksi">Riwayat keputusan</h2>
                    <span className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>{(riwayat ?? []).length}</span>
                  </div>
                  {(riwayat ?? []).map((b) => (
                    <AntreanKartu key={b.id} baris={b} bolehMemutuskan={false} memutuskan={false} onPutuskan={() => {}} />
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KeputusanPage() {
  return (
    <Terlindungi peran={['ceo', 'pusat']}>
      <main className="mx-auto w-full max-w-[1120px] px-4 py-5 md:px-8 md:py-8">
        <KeputusanIsi />
      </main>
    </Terlindungi>
  );
}
