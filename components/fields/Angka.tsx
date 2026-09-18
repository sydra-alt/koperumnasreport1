'use client';

import { useFormContext } from 'react-hook-form';
import type { Field } from '../../forms/types';

export function Angka({ field }: { field: Field }) {
  const { register } = useFormContext();
  const min = field.min ?? 0;
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={field.max}
      className="border px-2 py-2"
      style={{ borderColor: 'var(--garis)', fontFamily: 'var(--mono)', minHeight: 44 }}
      {...register(field.key, {
        // `setValueAs`, BUKAN `valueAsNumber` -- `valueAsNumber` mengubah input
        // KOSONG jadi NaN (DOM `input.valueAsNumber` utk number input kosong),
        // bukan undefined. NaN bertipe 'number' jadi lolos typeof-check tapi
        // gagal di z.number(), membuat field OPSIONAL yang dikosongkan ikut
        // ditolak (ditemukan lewat uji HP sungguhan 18 September 2026) --
        // lihat forms/validasi.ts (bersihkanNaN) untuk jaring pengaman kedua.
        setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
        min: { value: min, message: `${field.label} tidak boleh kurang dari ${min}` },
      })}
    />
  );
}
