'use client';

import { useController, useFormContext } from 'react-hook-form';
import type { Field } from '../../forms/types';

const OPSI = [
  { value: 'ya', label: 'Ya' },
  { value: 'tidak', label: 'Tidak' },
];

export function YaTidak({ field }: { field: Field }) {
  const { control } = useFormContext();
  const { field: rhf } = useController({ name: field.key, control });

  return (
    <div role="group" aria-label={field.label} className="flex shrink-0 gap-2">
      {OPSI.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => rhf.onChange(o.value)}
          aria-pressed={rhf.value === o.value}
          className="border px-3"
          style={{
            borderColor: rhf.value === o.value ? 'var(--biru)' : 'var(--garis)',
            background: rhf.value === o.value ? 'var(--biru)' : 'var(--permukaan)',
            color: rhf.value === o.value ? 'var(--kertas-2)' : 'var(--tinta)',
            minHeight: 44,
            minWidth: 60,
            fontWeight: rhf.value === o.value ? 600 : 400,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
