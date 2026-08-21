'use client';

import { useMemo, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { useAuth } from '../lib/auth/AuthProvider';
import { usePolicy } from '../lib/api/policy';
import { useProgresBulananSaya } from '../lib/api/marketing';
import { sinkronClosing, sinkronPteDaily } from '../lib/api/pte';
import { useKirimReport, useReportHariIni, useSimpanDraft } from '../lib/api/report';
import { debounce } from '../lib/debounce';
import { formRegistry } from '../forms';
import { FormRenderer } from './FormRenderer';

export function LaporForm({ formKey }: { formKey: string }) {
  const schema = formRegistry[formKey];
  const { session } = useAuth();
  const { data: reportHariIni, isLoading: memuatReport } = useReportHariIni(formKey);
  const { data: policy } = usePolicy();
  const { data: progres } = useProgresBulananSaya();
  const simpanDraft = useSimpanDraft(formKey);
  const kirimReport = useKirimReport(formKey);

  // reportId diturunkan dari query (`reportHariIni`) begitu ada; `reportIdBaru`
  // cuma dipakai untuk jeda singkat setelah baris pertama dibuat, sebelum
  // cache query sempat diperbarui -- lebih bersih daripada menyalin state lewat
  // useEffect (lihat perbaikan react-hooks/set-state-in-effect di KopHalaman).
  const [reportIdBaru, setReportIdBaru] = useState<string | null>(null);
  const reportId = reportHariIni?.id ?? reportIdBaru;
  const [statusSimpan, setStatusSimpan] = useState<'idle' | 'menyimpan' | 'tersimpan' | 'gagal'>('idle');
  const [pesanKirim, setPesanKirim] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);

  const simpanTerdebounce = useMemo(
    () =>
      debounce((data: FieldValues) => {
        setStatusSimpan('menyimpan');
        simpanDraft.mutate(
          { reportId, isi: data },
          {
            onSuccess: (id) => {
              setReportIdBaru(id);
              setStatusSimpan('tersimpan');
            },
            onError: () => setStatusSimpan('gagal'),
          },
        );
      }, 5000),
    [reportId, simpanDraft],
  );

  if (!schema) {
    return (
      <main className="p-6">
        <p>
          Form <code>{formKey}</code> belum terdaftar.
        </p>
      </main>
    );
  }

  if (memuatReport) {
    return (
      <main className="p-6">
        <p>Memuat…</p>
      </main>
    );
  }

  async function tanganiKirim(data: FieldValues) {
    if (!policy || !session) {
      setPesanKirim('Sesi atau kebijakan belum siap, coba lagi.');
      return;
    }
    setMengirim(true);
    setPesanKirim(null);
    try {
      let idAkhir = reportId;
      if (idAkhir) {
        await simpanDraft.mutateAsync({ reportId: idAkhir, isi: data });
      } else {
        idAkhir = await simpanDraft.mutateAsync({ reportId: null, isi: data });
        setReportIdBaru(idAkhir);
      }

      const status = await kirimReport.mutateAsync({
        reportId: idAkhir,
        isi: data,
        warna: 'hijau',
        policy,
      });

      if (formKey === 'personal_marketing') {
        await sinkronPteDaily(idAkhir, session.user.id, data);
        await sinkronClosing(session.user.id, idAkhir, data.daftar_closing as { nama_konsumen?: string; status?: string }[] | undefined);
      }

      setPesanKirim(status === 'terlambat' ? 'Terkirim, tapi tercatat TERLAMBAT.' : 'Terkirim tepat waktu.');
    } catch (err) {
      setPesanKirim(err instanceof Error ? err.message : 'Gagal mengirim laporan.');
    } finally {
      setMengirim(false);
    }
  }

  const invitTarget = policy ? Number(policy.invite_target) : null;
  const closingTarget = policy ? Number(policy.closing_target) : null;

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
        {schema.nama}
      </h1>

      {formKey === 'personal_marketing' && progres && invitTarget !== null && closingTarget !== null && (
        <div className="flex gap-4 border p-3" style={{ borderColor: 'var(--garis)', fontFamily: 'var(--mono)' }}>
          <span>
            Undangan bulan ini: {progres.undangan} / {invitTarget}
          </span>
          <span>
            Closing bulan ini: {progres.closing} / {closingTarget}
          </span>
        </div>
      )}

      <p className="text-sm" style={{ color: 'var(--kosong)' }}>
        {statusSimpan === 'menyimpan' && 'Menyimpan draft…'}
        {statusSimpan === 'tersimpan' && 'Draft tersimpan.'}
        {statusSimpan === 'gagal' && 'Gagal menyimpan draft.'}
      </p>

      <FormRenderer
        schema={schema}
        nilaiAwal={reportHariIni?.data}
        reportId={reportId}
        onChange={simpanTerdebounce}
        onSubmit={tanganiKirim}
      />

      {mengirim && <p>Mengirim…</p>}
      {pesanKirim && <p style={{ color: 'var(--biru)' }}>{pesanKirim}</p>}
    </main>
  );
}
