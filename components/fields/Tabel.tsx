'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import type { Field } from '../../forms/types';

export function Tabel({ field }: { field: Field }) {
  const { control, register } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: field.key });
  const kolom = field.kolom ?? [];

  return (
    <div className="flex flex-col gap-2">
      {fields.map((baris, i) => (
        <div key={baris.id} className="flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--garis)' }}>
          {kolom.map((k) => (
            <label key={k.key} className="flex flex-col gap-1 text-sm">
              {k.label}
              {k.type === 'pilih' && k.pilihan ? (
                <select
                  className="border px-2 py-2"
                  style={{ borderColor: 'var(--garis)', minHeight: 44 }}
                  {...register(`${field.key}.${i}.${k.key}`)}
                >
                  <option value="">— Pilih —</option>
                  {k.pilihan.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="border px-2 py-2"
                  style={{ borderColor: 'var(--garis)', minHeight: 44 }}
                  {...register(`${field.key}.${i}.${k.key}`)}
                />
              )}
            </label>
          ))}
          <button
            type="button"
            onClick={() => remove(i)}
            className="self-start border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 44 }}
          >
            Hapus baris
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({})}
        className="self-start border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--garis)', minHeight: 44 }}
      >
        + Tambah baris
      </button>
    </div>
  );
}
