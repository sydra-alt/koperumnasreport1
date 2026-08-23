'use client';

import { useMemo, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { useAuth } from '../lib/auth/AuthProvider';
import { usePolicy } from '../lib/api/policy';
import { statusClosing, statusUndangan, useProgresBulananSaya } from '../lib/api/marketing';
import { hitungKelayakanBonus, hitungPotongan, ringkasanPteHariIni, sinkronClosing, sinkronPteDaily } from '../lib/api/pte';
import { useDaftarLokasi } from '../lib/api/lokasi';
import { buatKeputusanDariLaporan } from '../lib/api/decision';
import { useKirimReport, useReportHariIni, useSimpanDraft, type ScopeOpsi } from '../lib/api/report';
import {
  useRekapPicLokasi,
  type InfrastrukturPerLokasiRow,
  type MaterialPerLokasiRow,
  type PembangunanPerLokasiRow,
} from '../lib/api/pembangunan';
import { tanggalIndonesiaWIB } from '../lib/tanggal';
import { debounce } from '../lib/debounce';
import { formRegistry } from '../forms';
import { FormRenderer } from './FormRenderer';

const IKON: Record<'hijau' | 'kuning' | 'merah', string> = { hijau: '🟢', kuning: '🟡', merah: '🔴' };
const LABEL_SHIFT: Record<string, string> = { pagi: 'Pagi', siang: 'Siang', malam: 'Malam' };

interface KombinasiScope {
  lokasiId: string | null;
  shift: string | null;
}

export function LaporForm({ formKey }: { formKey: string }) {
  const schema = formRegistry[formKey];
  const { session, profile, assignments } = useAuth();
  const { data: daftarLokasi } = useDaftarLokasi();

  // Scope 'lokasi' (pic_lokasi, security, dst.): kalau user di-assign lebih dari
  // satu kombinasi (lokasi, shift), dia harus pilih dulu -- laporan hari ini per
  // kombinasi berbeda adalah baris report terpisah (report_uniq meng-coalesce
  // lokasi_id/shift, lihat 0001_init.sql). Kalau cuma satu kombinasi, otomatis,
  // tidak perlu pemilih. `shift` bernilai null utk form yang tidak ber-shift
  // (mis. pic_lokasi) -- dedup lewat kunci gabungan otomatis mengecil jadi
  // pemilih-lokasi-saja untuk kasus itu, tidak ada cabang kode terpisah.
  const kombinasiDitugaskan = useMemo(() => {
    if (schema?.scope !== 'lokasi') return [];
    const peta = new Map<string, KombinasiScope>();
    for (const a of assignments) {
      if (a.form_key !== formKey) continue;
      const kunci = `${a.lokasi_id ?? ''}|${a.shift ?? ''}`;
      if (!peta.has(kunci)) peta.set(kunci, { lokasiId: a.lokasi_id, shift: a.shift });
    }
    return Array.from(peta.values());
  }, [assignments, formKey, schema?.scope]);
  const [kombinasiTerpilih, setKombinasiTerpilih] = useState<KombinasiScope | null>(null);
  const kombinasiAktif = kombinasiTerpilih ?? (kombinasiDitugaskan.length === 1 ? kombinasiDitugaskan[0] : null);
  const perluPilihKombinasi = schema?.scope === 'lokasi' && kombinasiDitugaskan.length > 1 && !kombinasiTerpilih;
  const namaLokasi = (id: string) => daftarLokasi?.find((l) => l.id === id)?.nama ?? id;
  const labelKombinasi = (k: KombinasiScope) =>
    k.lokasiId ? `${namaLokasi(k.lokasiId)}${k.shift ? ` · ${LABEL_SHIFT[k.shift] ?? k.shift}` : ''}` : '—';

  const opsi: ScopeOpsi | undefined =
    schema?.scope === 'lokasi'
      ? { lokasiId: kombinasiAktif?.lokasiId ?? undefined, shift: kombinasiAktif?.shift ?? undefined, aktif: Boolean(kombinasiAktif) }
      : undefined;

  const { data: reportHariIni, isLoading: memuatReport } = useReportHariIni(formKey, opsi);
  const { data: policy } = usePolicy();
  const { data: progres } = useProgresBulananSaya();
  const { data: rekapPicLokasi } = useRekapPicLokasi(formKey === 'pembangunan');
  // Blok "Laporan Personal Marketing" (rekap PTE/undangan/closing milik pengirim
  // sendiri) muncul di HAMPIR SEMUA form divisi -- lihat forms/blok-bersama.ts.
  // Query ini cuma perlu jalan utk form SELAIN personal_marketing itu sendiri.
  const perluRollupMarketing = formKey !== 'personal_marketing';
  const { data: laporanMarketingHariIni } = useReportHariIni('personal_marketing', { aktif: perluRollupMarketing });
  const simpanDraft = useSimpanDraft(formKey, opsi);
  const kirimReport = useKirimReport(formKey, opsi);

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

  if (schema.scope === 'lokasi' && kombinasiDitugaskan.length === 0) {
    return (
      <main className="p-6">
        <p>Anda tidak punya penugasan untuk laporan ini.</p>
      </main>
    );
  }

  if (perluPilihKombinasi) {
    return (
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
          {schema.nama}
        </h1>
        <p>Anda punya lebih dari satu penugasan. Pilih untuk laporan hari ini:</p>
        <div className="flex flex-col gap-2">
          {kombinasiDitugaskan.map((k, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setKombinasiTerpilih(k)}
              className="border px-4 py-3 text-left"
              style={{ borderColor: 'var(--garis)', minHeight: 44 }}
            >
              {labelKombinasi(k)}
            </button>
          ))}
        </div>
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

      // Generik utk SEMUA form yang memakai blokKeputusanCeo() (forms/blok-bersama.ts)
      // -- kunci field disengaja sama persis di semua form itu, jadi cukup satu
      // pemeriksaan di sini, bukan per-formKey.
      if (isiKirim.keputusan_ceo === true) {
        const judul = typeof isiKirim.keputusan_ceo_judul === 'string' ? isiKirim.keputusan_ceo_judul.trim() : '';
        if (judul.length > 0) {
          const masalah = typeof isiKirim.masalah_utama === 'string' && isiKirim.masalah_utama.trim() ? isiKirim.masalah_utama : null;
          await buatKeputusanDariLaporan(idAkhir, judul, masalah);
        }
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

      {formKey !== 'personal_marketing' && profile && (
        <div className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }} suppressHydrationWarning>
          <p style={{ fontFamily: 'var(--display)' }}>Identitas</p>
          <p>
            {tanggalIndonesiaWIB()}
            {kombinasiAktif ? ` · ${labelKombinasi(kombinasiAktif)}` : ''} · PIC: {profile.nama}
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

      {perluRollupMarketing && progres && invitTarget !== null && closingTarget !== null && (
        <div className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
          <p style={{ fontFamily: 'var(--display)' }}>Laporan Personal Marketing</p>
          <p>
            Laporan personal sudah dikirim: {laporanMarketingHariIni?.status && laporanMarketingHariIni.status !== 'draft' ? '✅' : '❌'} · Undangan
            bulan ini: {progres.undangan} / {invitTarget} · Closing bulan ini: {progres.closing} / {closingTarget}
          </p>
        </div>
      )}

      {formKey === 'pembangunan' && rekapPicLokasi && (
        <>
          <RekapUnitOtomatis data={rekapPicLokasi.unit} />
          <RekapMaterialOtomatis data={rekapPicLokasi.material} />
          <RekapInfrastrukturOtomatis data={rekapPicLokasi.infrastruktur} />
        </>
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

/** Tabel read-only rekap unit pembangunan per lokasi, datanya dari PIC Lokasi. */
function RekapUnitOtomatis({ data }: { data: PembangunanPerLokasiRow[] }) {
  const total = data.reduce(
    (acc, r) => ({
      target: (acc.target ?? 0) + (r.target ?? 0),
      sedang_dibangun: (acc.sedang_dibangun ?? 0) + (r.sedang_dibangun ?? 0),
      finishing: (acc.finishing ?? 0) + (r.finishing ?? 0),
      selesai_hari_ini: (acc.selesai_hari_ini ?? 0) + (r.selesai_hari_ini ?? 0),
      belum_mulai: (acc.belum_mulai ?? 0) + (r.belum_mulai ?? 0),
    }),
    { target: 0, sedang_dibangun: 0, finishing: 0, selesai_hari_ini: 0, belum_mulai: 0 },
  );

  const kolom = ['Lokasi', 'Target', 'Dibangun', 'Finishing', 'Selesai hari ini', 'Belum mulai'];

  const sel = (n: number | null) => (n ?? 0).toString();

  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p className="text-lg" style={{ fontFamily: 'var(--display)' }}>
        1 · Rekap Unit Seluruh Lokasi (dari PIC Lokasi)
      </p>
      <p className="mb-3 text-sm" style={{ color: 'var(--biru-3)' }}>
        Angka di bawah berasal dari Laporan PIC Lokasi hari ini. Hanya baca — tidak bisa diedit di sini.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Belum ada PIC Lokasi yang mengirim laporan hari ini.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {kolom.map((k) => (
                  <th key={k} className="border px-2 py-1 text-left" style={{ borderColor: 'var(--garis)', background: 'var(--kertas-2)' }}>
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.lokasi}>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>{r.lokasi}</td>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>{sel(r.target)}</td>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>{sel(r.sedang_dibangun)}</td>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>{sel(r.finishing)}</td>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>{sel(r.selesai_hari_ini)}</td>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>{sel(r.belum_mulai)}</td>
                </tr>
              ))}
              <tr style={{ fontFamily: 'var(--display)' }}>
                <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>Total</td>
                <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>{sel(total.target)}</td>
                <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>{sel(total.sedang_dibangun)}</td>
                <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>{sel(total.finishing)}</td>
                <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>{sel(total.selesai_hari_ini)}</td>
                <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>{sel(total.belum_mulai)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Tabel read-only rekap material per lokasi, datanya dari PIC Lokasi -- §3.5b, D3. */
function RekapMaterialOtomatis({ data }: { data: MaterialPerLokasiRow[] }) {
  const yaTidak = (v: boolean | null) => (v === null ? '—' : v ? '✅' : '❌');

  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p className="text-lg" style={{ fontFamily: 'var(--display)' }}>
        3 · Material per Lokasi (dari PIC Lokasi)
      </p>
      <p className="mb-3 text-sm" style={{ color: 'var(--biru-3)' }}>
        Status material per lokasi berasal dari Laporan PIC Lokasi hari ini. Hanya baca.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Belum ada PIC Lokasi yang mengirim laporan hari ini.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((r) => (
            <div key={r.lokasi} className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
              <p style={{ fontFamily: 'var(--display)' }}>{r.lokasi}</p>
              <p>
                Material cukup: {yaTidak(r.material_cukup)} · Kiriman precast/perikas diterima: {r.kiriman_precast_jumlah ?? 0} pcs
              </p>
              {r.kiriman_kekurangan && <p>Kekurangan kiriman: {r.kiriman_kekurangan}</p>}
              {r.material_kurang.length > 0 && (
                <ul className="list-disc pl-5">
                  {r.material_kurang.map((m, i) => (
                    <li key={i}>
                      {m.material ?? '—'} -- kebutuhan {m.kebutuhan ?? '—'}, untuk unit {m.untuk_unit ?? '—'}, dibutuhkan {m.dibutuhkan_tanggal ?? '—'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tabel read-only kondisi infrastruktur per lokasi, datanya dari PIC Lokasi -- §3.5b, D4. */
function RekapInfrastrukturOtomatis({ data }: { data: InfrastrukturPerLokasiRow[] }) {
  const yaTidak = (v: boolean | string | null) => (v === null ? '—' : v === true || v === 'ya' ? '✅' : '❌');

  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p className="text-lg" style={{ fontFamily: 'var(--display)' }}>
        5 · Kondisi Infrastruktur per Lokasi (dari PIC Lokasi)
      </p>
      <p className="mb-3 text-sm" style={{ color: 'var(--biru-3)' }}>
        Kondisi infrastruktur (jalan, listrik, air, drainase) berasal dari Laporan PIC Lokasi hari ini. Hanya baca -- rencana &amp; biaya
        perbaikan diisi di blok 6.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Belum ada PIC Lokasi yang mengirim laporan hari ini.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((r) => (
            <div key={r.lokasi} className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
              <p style={{ fontFamily: 'var(--display)' }}>{r.lokasi}</p>
              <p>
                Jalan: {r.jalan_status ?? '—'} · Listrik: {r.listrik_status ?? '—'} · Air: {r.air_status ?? '—'}
              </p>
              <p>
                Drainase: {yaTidak(r.drainase_baik)} · Penerangan: {yaTidak(r.penerangan_baik)} · Gerbang: {yaTidak(r.gerbang_baik)}
              </p>
              {r.infrastruktur_kebutuhan && <p>Kebutuhan: {r.infrastruktur_kebutuhan}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
