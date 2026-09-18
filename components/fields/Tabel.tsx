'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import type { Field } from '../../forms/types';
import { LampiranInput } from './LampiranInput';

/**
 * `kunci` -- id stabil PER BARIS, dibuat sekali saat baris ditambah dan ikut
 * tersimpan sebagai data biasa (BUKAN id internal react-hook-form, yang
 * dibuat ULANG setiap form dibuka kembali -- lihat forms/types.ts komentar
 * `buktiPerBaris`). Bukti baris memakai kunci ini supaya tetap terhubung ke
 * baris yang benar walau laporan dibuka-tutup berkali-kali sebelum dikirim.
 * Cuma dibuat kalau field ini memang butuh bukti per baris -- baris tabel
 * biasa (tanpa buktiPerBaris) tidak perlu kunci ini sama sekali.
 */
export function Tabel({ field, reportId }: { field: Field; reportId?: string | null }) {
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
              {k.wajib && <span style={{ color: 'var(--merah)' }}> *</span>}
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

          {field.buktiPerBaris && (
            <LampiranInput
              name={`_bukti.${field.key}.${(baris as { kunci?: string }).kunci ?? baris.id}`}
              label="Lampirkan bukti"
              reportId={reportId}
              fieldKeyAsli={`${field.buktiKunci ?? field.key}_${(baris as { kunci?: string }).kunci ?? baris.id}`}
            />
          )}

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
        onClick={() => append(field.buktiPerBaris ? { kunci: crypto.randomUUID() } : {})}
        className="self-start border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--garis)', minHeight: 44 }}
      >
        + Tambah baris
      </button>
    </div>
  );
}
