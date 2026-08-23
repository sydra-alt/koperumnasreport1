'use client';

import { useMemo, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { useAuth } from '../lib/auth/AuthProvider';
import { usePolicy } from '../lib/api/policy';
import { statusClosing, statusUndangan, useProgresBulananSaya } from '../lib/api/marketing';
import { hitungKelayakanBonus, hitungPotongan, ringkasanPteHariIni, sinkronClosing, sinkronPteDaily } from '../lib/api/pte';
import { useKirimReport, useReportHariIni, useSimpanDraft } from '../lib/api/report';
import { debounce } from '../lib/debounce';
import { formRegistry } from '../forms';
import { FormRenderer } from './FormRenderer';

const IKON: Record<'hijau' | 'kuning' | 'merah', string> = { hijau: '🟢', kuning: '🟡', merah: '🔴' };

export function LaporForm({ formKey }: { formKey: string }) {
  const schema = formRegistry[formKey];
  const { session, profile } = useAuth();
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

  // Sama polanya: bukan menyalin reportHariIni.data ke state (akan basi begitu
  // query refresh), cuma menyimpan PERUBAHAN sejak form dibuka, lalu digabung
  // dengan data tersimpan untuk pratinjau Blok 5/8 yang hidup.
  const [perubahanTerkini, setPerubahanTerkini] = useState<FieldValues>({});
  const nilaiUntukPratinjau: FieldValues = { ...reportHariIni?.data, ...perubahanTerkini };

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

  function tanganiPerubahan(data: FieldValues) {
    setPerubahanTerkini(data);
    simpanTerdebounce(data);
  }

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
      const isiKirim: FieldValues =
        formKey === 'personal_marketing'
          ? { ...data, pernyataan_at: new Date().toISOString(), pernyataan_nama: profile?.nama ?? null }
          : data;

      let idAkhir = reportId;
      if (idAkhir) {
        await simpanDraft.mutateAsync({ reportId: idAkhir, isi: isiKirim });
      } else {
        idAkhir = await simpanDraft.mutateAsync({ reportId: null, isi: isiKirim });
        setReportIdBaru(idAkhir);
      }

      const status = await kirimReport.mutateAsync({
        reportId: idAkhir,
        isi: isiKirim,
        warna: 'hijau',
        policy,
      });

      if (formKey === 'personal_marketing') {
        await sinkronPteDaily(idAkhir, session.user.id, isiKirim);
        await sinkronClosing(
          session.user.id,
          idAkhir,
          isiKirim.closing_list as { nama_konsumen?: string; lokasi?: string; status?: string }[] | undefined,
        );
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

  const ringkasanPte = formKey === 'personal_marketing' && policy ? ringkasanPteHariIni(nilaiUntukPratinjau, policy) : null;
  const infoBonus =
    formKey === 'personal_marketing' && policy && progres
      ? hitungKelayakanBonus(policy, progres.pte_berlaku, progres.hari_bolong, progres.hari_lengkap, progres.hari_wajib)
      : null;
  const infoPotongan =
    formKey === 'personal_marketing' && policy && progres ? hitungPotongan(policy, progres.pte_berlaku, progres.closing) : null;

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
        {schema.nama}
      </h1>

      {formKey === 'personal_marketing' && profile && (
        <div className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
          <p style={{ fontFamily: 'var(--display)' }}>Blok 1 · Identitas</p>
          <p>
            {profile.nama} · {profile.divisi ?? '—'} · {profile.jabatan ?? '—'}
          </p>
        </div>
      )}

      {formKey === 'personal_marketing' && progres && invitTarget !== null && closingTarget !== null && (
        <div className="flex flex-wrap gap-4 border p-3" style={{ borderColor: 'var(--garis)', fontFamily: 'var(--mono)' }}>
          <span>
            Undangan bulan ini: {progres.undangan} / {invitTarget}
          </span>
          <span>
            Closing bulan ini: {progres.closing} / {closingTarget}
          </span>
        </div>
      )}

      {formKey === 'personal_marketing' && progres && invitTarget !== null && closingTarget !== null && (
        <div className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
          <p style={{ fontFamily: 'var(--display)' }}>Blok 8 · Status Personal Marketing</p>
          <p>
            {IKON[statusClosing(progres.closing, closingTarget)]} Closing · {IKON[statusUndangan(progres.undangan, invitTarget)]}{' '}
            Undangan {invitTarget} orang · {ringkasanPte ? (ringkasanPte.lengkap ? '🟢 PTE lengkap' : '🔴 PTE tidak lengkap') : '— PTE'}
          </p>
        </div>
      )}

      {formKey === 'personal_marketing' && ringkasanPte && (
        <div className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
          <p style={{ fontFamily: 'var(--display)' }}>Blok 5 · Status PTE Rp500.000 (pratinjau hari ini)</p>
          <p>
            {ringkasanPte.live ? '✅' : '❌'} Live · {ringkasanPte.undang ? '✅' : '❌'} Undang ·{' '}
            {ringkasanPte.kesaksian ? '✅' : '❌'} Kesaksian · {ringkasanPte.review ? '✅' : '❌'} Review ·{' '}
            {ringkasanPte.konten ? '✅' : '❌'} Konten · {ringkasanPte.mentahan ? '✅' : '❌'} Mentahan
          </p>
          <p>{ringkasanPte.lengkap ? 'LENGKAP' : 'TIDAK LENGKAP'}</p>
          <p>
            {!infoBonus || !infoBonus.berlaku
              ? 'Belum berlaku'
              : infoBonus.layak
                ? `Layak bonus Rp${infoBonus.nominal?.toLocaleString('id-ID')}`
                : 'Bonus hangus bulan ini'}
          </p>
        </div>
      )}

      {formKey === 'personal_marketing' && (
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          {!infoPotongan || !infoPotongan.berlaku
            ? 'Ketentuan belum berlaku.'
            : closingTarget !== null && progres && progres.closing >= closingTarget
              ? 'Target closing terpenuhi: Rp300.000 tidak dipotong.'
              : `Target closing belum terpenuhi: mengikuti ketentuan potongan Rp${infoPotongan.potongan?.toLocaleString('id-ID')} (proyeksi).`}
        </p>
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
        onChange={tanganiPerubahan}
        onSubmit={tanganiKirim}
      />

      {mengirim && <p>Mengirim…</p>}
      {pesanKirim && <p style={{ color: 'var(--biru)' }}>{pesanKirim}</p>}
    </main>
  );
}
