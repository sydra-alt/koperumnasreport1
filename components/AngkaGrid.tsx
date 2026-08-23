'use client';

export interface AngkaButir {
  label: string;
  nilai: string;
  warna?: string;
}

/** Grid angka generik -- dipakai Dashboard CEO (Task 20) dan mana pun butuh menampilkan beberapa angka berlabel. */
export function AngkaGrid({ butir }: { butir: AngkaButir[] }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
      {butir.map((b) => (
        <div key={b.label} className="border p-3" style={{ borderColor: 'var(--garis)' }}>
          <p className="text-sm" style={{ color: 'var(--biru-3)' }}>
            {b.label}
          </p>
          <p className="text-lg" style={{ fontFamily: 'var(--mono)', color: b.warna ?? 'var(--tinta)' }}>
            {b.nilai}
          </p>
        </div>
      ))}
    </div>
  );
}
