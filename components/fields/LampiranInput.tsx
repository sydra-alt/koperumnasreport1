'use client';

import { useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { useUnggahLampiran } from '../../lib/api/attachment';
import { usePolicy } from '../../lib/api/policy';

interface LampiranTerunggah {
  id: string;
  nama: string;
  path: string;
}

interface LampiranInputProps {
  name: string;
  label?: string;
  reportId?: string | null;
  /** field_key asli yang disimpan di tabel attachment (name bisa berupa "_bukti.<key>"). */
  fieldKeyAsli?: string;
}

export function LampiranInput({ name, label = 'Lampirkan bukti', reportId, fieldKeyAsli }: LampiranInputProps) {
  const { control } = useFormContext();
  const { field: rhf } = useController({ name, control, defaultValue: [] });
  const items: LampiranTerunggah[] = rhf.value ?? [];
  const { data: policy } = usePolicy();
  const unggah = useUnggahLampiran(reportId ?? '');
  const [progres, setProgres] = useState<Record<string, number>>({});
  const [pesanError, setPesanError] = useState<string | null>(null);

  const siapUnggah = Boolean(reportId) && Boolean(policy);

  async function tambah(e: React.ChangeEvent<HTMLInputElement>) {
    setPesanError(null);
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!reportId) {
      setPesanError('Simpan draft dulu sebelum melampirkan bukti.');
      return;
    }
    if (!policy) {
      setPesanError('Aturan lampiran belum termuat, coba lagi sesaat lagi.');
      return;
    }

    const gambarMaksPx = Number(policy.gambar_max_px);
    const lampiranMaksMb = Number(policy.lampiran_max_mb);

    for (const file of files) {
      try {
        const hasil = await unggah.mutateAsync({
          fieldKey: fieldKeyAsli ?? name,
          file,
          gambarMaksPx,
          lampiranMaksMb,
          onProgress: (p) => setProgres((s) => ({ ...s, [file.name]: p })),
        });
        rhf.onChange([...items, { id: hasil.id, nama: file.name, path: hasil.path }]);
      } catch (err) {
        setPesanError(err instanceof Error ? err.message : 'Gagal mengunggah bukti.');
      }
    }
  }

  function hapus(i: number) {
    rhf.onChange(items.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        className="inline-flex w-fit items-center border px-4"
        style={{
          borderColor: siapUnggah ? 'var(--biru)' : 'var(--kosong)',
          color: siapUnggah ? 'var(--biru)' : 'var(--kosong)',
          minHeight: 44,
          cursor: siapUnggah ? 'pointer' : 'not-allowed',
        }}
      >
        {label}
        <input
          type="file"
          accept="image/*,video/*"
          capture="environment"
          multiple
          hidden
          disabled={!siapUnggah}
          name={rhf.name}
          ref={rhf.ref}
          onChange={tambah}
          onBlur={rhf.onBlur}
        />
      </label>

      {!reportId && (
        <span className="text-sm" style={{ color: 'var(--kosong)' }}>
          Simpan draft dulu sebelum melampirkan bukti.
        </span>
      )}

      {pesanError && (
        <span className="text-sm" style={{ color: 'var(--merah)' }}>
          {pesanError}
        </span>
      )}

      {Object.entries(progres)
        .filter(([, p]) => p < 100)
        .map(([nama, p]) => (
          <div key={nama} className="text-sm">
            Mengunggah {nama}… {p}%
            <div className="h-2 w-full" style={{ background: 'var(--garis)' }}>
              <div className="h-2" style={{ width: `${p}%`, background: 'var(--biru)' }} />
            </div>
          </div>
        ))}

      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((it, i) => (
            <li key={it.id} className="flex items-center justify-between gap-2 text-sm" style={{ minHeight: 44 }}>
              <span>{it.nama}</span>
              <button type="button" onClick={() => hapus(i)} style={{ color: 'var(--merah)' }}>
                Hapus
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
