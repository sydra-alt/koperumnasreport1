'use client';

import { useId, useState, type ReactNode } from 'react';

/**
 * Istilah + tombol "?" yang membuka penjelasan satu baris tepat di bawahnya
 * (5 Oktober 2026). Bekerja dengan KETUK di HP, bukan tooltip hover. Area
 * ketuk 44px, tampilan lingkaran kecil.
 */
export function Istilah({ nama, teks, children }: { nama: string; teks: string; children: ReactNode }) {
  const [buka, setBuka] = useState(false);
  const id = useId();
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center">
        <span>{children}</span>
        <button
          type="button"
          aria-expanded={buka}
          aria-controls={id}
          aria-label={`Apa artinya ${nama}?`}
          onClick={(e) => {
            e.preventDefault();
            setBuka((b) => !b);
          }}
          className="inline-flex shrink-0 items-center justify-center"
          style={{ width: 44, height: 44, margin: '-10px 0', background: 'transparent', color: 'var(--label)' }}
        >
          <span
            aria-hidden
            className="inline-flex items-center justify-center"
            style={{ width: 18, height: 18, borderRadius: 999, border: '1px solid currentColor', fontSize: 11, fontWeight: 600, lineHeight: 1 }}
          >
            ?
          </span>
        </button>
      </span>
      {buka && (
        <span id={id} role="note" className="text-xs" style={{ color: 'var(--label)', fontWeight: 400, fontFamily: 'var(--font)', lineHeight: 1.4, maxWidth: '60ch' }}>
          {teks}
        </span>
      )}
    </span>
  );
}
