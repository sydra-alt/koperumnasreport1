'use client';

import { Terlindungi } from '../../components/Terlindungi';
import { jamWIB } from '../../lib/tanggal';
import { LABEL_STATUS, type BarisKesiapan, type StatusButir } from '../../lib/kesiapanOutlet';
import { useKesiapanOutlet } from '../../lib/api/kesiapanOutlet';

/**
 * Kesiapan Outlet (8 Oktober 2026) -- baca saja untuk CEO/Admin. Satu kartu per outlet F&B, langsung
 * dari database (POS + laporan). Butir sama dengan daftar kesiapan Kemayoran
 * (docs/KONTROL-DAN-LABA-RUGI-DESIGN-2026-10.md §9): OK / Kurang / Risiko + siapa bertindak.
 */
const WARNA: Record<StatusButir, string> = { ok: 'var(--hijau)', kurang: 'var(--merah)', risiko: 'var(--kuning)' };
const label = { fontSize: 13, color: 'var(--label)', lineHeight: 1.3 } as const;

function Lencana({ status, n }: { status: StatusButir; n?: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold" style={{ border: `1px solid ${WARNA[status]}`, color: WARNA[status], borderRadius: 999 }}>
      {n !== undefined ? `${n} ` : ''}{LABEL_STATUS[status]}
    </span>
  );
}

function KartuOutlet({ b }: { b: BarisKesiapan }) {
  const rail = b.hitung.kurang > 0 ? 'rail-merah' : b.hitung.risiko > 0 ? 'rail-kuning' : 'rail-hijau';
  return (
    <section className={`kartu-status ${rail} flex flex-col gap-3`} aria-label={b.nama}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700 }}>{b.nama}</h2>
        <div className="flex flex-wrap gap-1">
          <Lencana status="ok" n={b.hitung.ok} />
          <Lencana status="kurang" n={b.hitung.kurang} />
          <Lencana status="risiko" n={b.hitung.risiko} />
        </div>
      </div>
      <ul className="flex flex-col divide-y text-sm" style={{ borderColor: 'var(--garis)' }}>
        {b.butir.map((x) => (
          <li key={x.kunci} className="flex flex-col gap-1 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{x.butir}</span>
              <Lencana status={x.status} />
            </div>
            <span>{x.keadaan}</span>
            {x.siapa ? <span style={label}>Siapa bertindak: {x.siapa}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Isi() {
  const { data, isLoading, isError, error } = useKesiapanOutlet();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl" style={{ fontFamily: 'var(--display)', fontWeight: 700 }}>Kesiapan Outlet</h1>
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          Apa yang masih kurang sebelum outlet memakai POS penuh, langsung dari data hari ini. Baca saja; perbaikannya dilakukan di menu yang disebut pada tiap butir.
        </p>
      </header>
      {isLoading ? <p className="text-sm">Memuat data POS dan laporan...</p> : null}
      {isError ? <p className="kartu-status rail-merah text-sm">{(error as Error).message}</p> : null}
      {data ? (
        <>
          <p style={label}>Diambil {jamWIB(new Date(data.dibuatPada))} WIB</p>
          {data.baris.length === 0 ? <p className="kartu-status rail-kuning text-sm">POS tidak mengembalikan outlet F&B aktif.</p> : null}
          {data.baris.map((b) => <KartuOutlet key={b.posOutletId} b={b} />)}
        </>
      ) : null}
    </main>
  );
}

export default function KesiapanOutletPage() {
  return (
    <Terlindungi peran={['ceo', 'admin']}>
      <Isi />
    </Terlindungi>
  );
}
