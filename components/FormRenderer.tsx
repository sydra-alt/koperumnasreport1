'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { FormProvider, useForm, type FieldValues } from 'react-hook-form';
import type { FormSchema } from '../forms/types';
import { blokBerlakuHariIni, buildZodSchema } from '../forms/validasi';
import { Angka } from './fields/Angka';
import { Centang } from './fields/Centang';
import { Lampiran } from './fields/Lampiran';
import { LampiranInput } from './fields/LampiranInput';
import { Pilih } from './fields/Pilih';
import { StatusWarna } from './fields/StatusWarna';
import { Tabel } from './fields/Tabel';
import { Teks } from './fields/Teks';
import { TeksPanjang } from './fields/TeksPanjang';
import { Uang } from './fields/Uang';
import { YaTidak } from './fields/YaTidak';

interface FormRendererProps {
  schema: FormSchema;
  nilaiAwal?: FieldValues;
  onSubmit: (data: FieldValues) => void;
  /** Dipanggil tiap nilai form berubah -- dipakai pemanggil untuk autosave ter-debounce. */
  onChange?: (data: FieldValues) => void;
  /** Laporan hari ini, kalau sudah ada -- diteruskan ke field lampiran supaya bisa unggah sungguhan. */
  reportId?: string | null;
}

export function FormRenderer({ schema, nilaiAwal, onSubmit, onChange, reportId }: FormRendererProps) {
  const methods = useForm({
    defaultValues: nilaiAwal,
    resolver: zodResolver(buildZodSchema(schema)),
  });
  const {
    handleSubmit,
    watch,
    formState: { errors },
  } = methods;

  const pesanError = Object.entries(errors)
    .filter(([key]) => key !== '_bukti')
    .map(([key, err]) => ({ key, pesan: (err?.message as string) ?? `${key} tidak valid` }));

  useEffect(() => {
    if (pesanError.length === 0) return;
    document.getElementById(`baris-${pesanError[0].key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const sub = watch((nilai) => onChangeRef.current?.(nilai as FieldValues));
    return () => sub.unsubscribe();
  }, [watch]);

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col" style={{ gap: 'var(--jarak-bagian)' }}>
        {blokBerlakuHariIni(schema).map((block) => (
          <fieldset key={block.id} className="flex flex-col border p-4" style={{ borderColor: 'var(--garis)', gap: 'var(--jarak-field)' }}>
            <legend className="px-1" style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
              {block.judul}
            </legend>
            {block.catatan && <p className="teks-penjelasan">{block.catatan}</p>}
            {block.fields.map((field) => {
              const bermasalah = Boolean(errors[field.key]);
              return (
                <label
                  key={field.key}
                  id={`baris-${field.key}`}
                  className="flex flex-col gap-1 p-2"
                  style={{ background: bermasalah ? 'rgba(166,43,43,0.12)' : 'transparent' }}
                >
                  <span style={{ fontSize: 'var(--ukuran-label)', color: 'var(--label)' }}>
                    {field.label}
                    {field.wajib && <span style={{ color: 'var(--merah)' }}> *</span>}
                  </span>

                  {field.type === 'angka' && <Angka field={field} />}
                  {field.type === 'uang' && <Uang field={field} />}
                  {field.type === 'teks' && <Teks field={field} />}
                  {field.type === 'teks_panjang' && <TeksPanjang field={field} />}
                  {field.type === 'pilih' && <Pilih field={field} />}
                  {field.type === 'ya_tidak' && <YaTidak field={field} />}
                  {field.type === 'centang' && <Centang field={field} />}
                  {field.type === 'status_warna' && <StatusWarna field={field} />}
                  {field.type === 'tabel' && <Tabel field={field} />}
                  {field.type === 'lampiran' && <Lampiran field={field} reportId={reportId} />}

                  {field.buktiWajib && (
                    <LampiranInput
                      name={`_bukti.${field.key}`}
                      label="Lampirkan bukti"
                      reportId={reportId}
                      fieldKeyAsli={field.buktiKunci ?? field.key}
                    />
                  )}

                  {field.bantuan && <span className="teks-penjelasan">{field.bantuan}</span>}

                  {bermasalah && (
                    <span className="text-sm" style={{ color: 'var(--merah)' }}>
                      {String(errors[field.key]?.message ?? '')}
                    </span>
                  )}
                </label>
              );
            })}
          </fieldset>
        ))}

        {/* Menempel di atas nav bawah pada layar sempit (§2 06-RENCANA-PRESENSI-MOBILE.md) --
            form personal_marketing 9 blok baru terlihat tombolnya kalau digulir sampai
            bawah tanpa ini; dengan sticky, selalu terlihat. Background solid wajib supaya
            konten yang lewat di baliknya tidak tembus pandang. */}
        <div className="tombol-kirim-menempel" style={{ background: 'var(--kertas)' }}>
          {pesanError.length > 0 && (
            <div className="border p-3" style={{ borderColor: 'var(--merah)', background: 'rgba(166,43,43,0.08)' }}>
              <p style={{ fontFamily: 'var(--display)', color: 'var(--merah)' }}>Periksa kembali sebelum mengirim:</p>
              <ul className="list-disc pl-5">
                {pesanError.map((e) => (
                  <li key={e.key}>{e.pesan}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            className="w-full px-4 py-3"
            style={{ background: 'var(--biru)', color: 'var(--kertas-2)', minHeight: 48 }}
          >
            Kirim
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
