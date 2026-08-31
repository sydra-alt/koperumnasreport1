'use client';

export interface AngkaButir {
  label: string;
  nilai: string;
  warna?: string;
}

/** Grid angka generik -- dipakai Dashboard CEO (Task 20) dan mana pun butuh menampilkan beberapa angka berlabel.
 *  Redesign: angka lebih besar (DESIGN.md §3: 28–32px untuk angka utama, 20px untuk sekunder),
 *  kartu dengan border lembut dan sedikit padding -- bukan kartu penuh warna. */
export function AngkaGrid({ butir }: { butir: AngkaButir[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
      {butir.map((b) => (
        <div
          key={b.label}
          className="kartu-status rail-netral flex flex-col gap-1"
          style={{ padding: '12px 14px' }}
        >
          <p className="text-sm" style={{ color: 'var(--label)', lineHeight: 1.3 }}>
            {b.label}
          </p>
          <p className="angka-kecil" style={{ fontFamily: 'var(--mono)', color: b.warna ?? 'var(--tinta)' }}>
            {b.nilai}
          </p>
        </div>
      ))}
    </div>
  );
}
