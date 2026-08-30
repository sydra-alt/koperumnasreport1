'use client';

import { useMemo, useState } from 'react';
import type { FieldValues } from 'react-hook-form';
import { useAuth } from '../lib/auth/AuthProvider';
import { usePolicy } from '../lib/api/policy';
import { statusClosing, statusUndangan, useProgresBulananSaya } from '../lib/api/marketing';
import { hitungKelayakanBonus, hitungPotongan, ringkasanPteHariIni, sinkronClosing, sinkronPteDaily } from '../lib/api/pte';
import { useDaftarLokasi } from '../lib/api/lokasi';
import { useDaftarOutlet } from '../lib/api/outlet';
import { useDaftarShift } from '../lib/api/shift';
import { buatKeputusanDariLaporan } from '../lib/api/decision';
import { apakahTerlambat, batasJamKirim, useKirimReport, useReportHariIni, useSimpanDraft, type ScopeOpsi } from '../lib/api/report';
import { labelSisaWaktu } from '../lib/tugasHariIni';
import { useRekapPembangunanPerLokasi, type PembangunanPerLokasiRow } from '../lib/api/pembangunan';
import { usePicLokasiBelumUpload, type LokasiBelumUpload } from '../lib/api/it';
import { ringkasanKebutuhanBesok } from '../lib/api/manager-resto';
import { useManagerRestoUntukKontrolFnb, type ManagerRestoUntukKontrolFnbRow } from '../lib/api/kontrol-fnb';
import {
  hitungCashflowHariIni,
  useKebutuhanPembangunanAccounting,
  useOmzetRestoHariIni,
  type KebutuhanPembangunanAccounting,
  type OmzetRestoRow,
} from '../lib/api/accounting';
import { jamWIB, tanggalIndonesiaWIB, tanggalWIB } from '../lib/tanggal';
import { useCutiUntukTanggal, type CutiUntukTanggal } from '../lib/api/cuti';
import { angkaDariTeks, tanggalDariTeks } from '../lib/teksAngka';
import { urgensiTerburukDariKirim, warnaDipilihDari, warnaOtomatis, warnaTerburuk } from '../lib/warna';
import { debounce } from '../lib/debounce';
import { formRegistry } from '../forms';
import { FormRenderer, type LaporanTerkirim } from './FormRenderer';

const IKON: Record<'hijau' | 'kuning' | 'merah', string> = { hijau: '🟢', kuning: '🟡', merah: '🔴' };

interface KombinasiScope {
  lokasiId: string | null;
  outletId: string | null;
  shiftId: string | null;
}

export function LaporForm({ formKey }: { formKey: string }) {
  const schema = formRegistry[formKey];
  const { session, profile, assignments } = useAuth();
  const { data: daftarLokasi } = useDaftarLokasi();
  const { data: daftarOutlet } = useDaftarOutlet();
  const { data: daftarShift } = useDaftarShift();

  // Scope 'lokasi' (pic_lokasi, security, dst.) atau 'outlet' (manager_resto):
  // kalau user di-assign lebih dari satu kombinasi (lokasi/outlet, shift), dia
  // harus pilih dulu -- laporan hari ini per kombinasi berbeda adalah baris
  // report terpisah (report_uniq meng-coalesce lokasi_id/outlet_id/shift_id,
  // lihat 0001_init.sql + 0033_tabel_shift.sql). Kalau cuma satu kombinasi,
  // otomatis, tidak perlu pemilih. `shiftId` bernilai null utk form tanpa
  // shift (mis. pic_lokasi, manager_resto) -- dedup lewat kunci gabungan
  // otomatis mengecil jadi pemilih-lokasi/outlet-saja untuk kasus itu, tidak
  // ada cabang kode terpisah.
  const berScope = schema?.scope === 'lokasi' || schema?.scope === 'outlet';
  const kombinasiDitugaskan = useMemo(() => {
    if (!berScope) return [];
    const peta = new Map<string, KombinasiScope>();
    for (const a of assignments) {
      if (a.form_key !== formKey) continue;
      const kunci = `${a.lokasi_id ?? ''}|${a.outlet_id ?? ''}|${a.shift_id ?? ''}`;
      if (!peta.has(kunci)) peta.set(kunci, { lokasiId: a.lokasi_id, outletId: a.outlet_id, shiftId: a.shift_id });
    }
    return Array.from(peta.values());
  }, [assignments, formKey, berScope]);
  const [kombinasiTerpilih, setKombinasiTerpilih] = useState<KombinasiScope | null>(null);
  const kombinasiAktif = kombinasiTerpilih ?? (kombinasiDitugaskan.length === 1 ? kombinasiDitugaskan[0] : null);
  const perluPilihKombinasi = berScope && kombinasiDitugaskan.length > 1 && !kombinasiTerpilih;
  const namaLokasi = (id: string) => daftarLokasi?.find((l) => l.id === id)?.nama ?? id;
  const namaOutlet = (id: string) => daftarOutlet?.find((o) => o.id === id)?.nama ?? id;
  const namaShift = (id: string) => daftarShift?.find((s) => s.id === id)?.nama ?? id;
  const batasLaporShift = (id: string) => daftarShift?.find((s) => s.id === id)?.batasLapor ?? null;
  const labelKombinasi = (k: KombinasiScope) => {
    const namaScope = k.lokasiId ? namaLokasi(k.lokasiId) : k.outletId ? namaOutlet(k.outletId) : '—';
    return `${namaScope}${k.shiftId ? ` · ${namaShift(k.shiftId)}` : ''}`;
  };

  const opsi: ScopeOpsi | undefined = berScope
    ? {
        lokasiId: kombinasiAktif?.lokasiId ?? undefined,
        outletId: kombinasiAktif?.outletId ?? undefined,
        shiftId: kombinasiAktif?.shiftId ?? undefined,
        shiftBatasLapor: kombinasiAktif?.shiftId ? batasLaporShift(kombinasiAktif.shiftId) : null,
        aktif: Boolean(kombinasiAktif),
      }
    : undefined;

  const { data: reportHariIni, isLoading: memuatReport } = useReportHariIni(formKey, opsi);
  const { data: policy } = usePolicy();
  const { data: progres } = useProgresBulananSaya();
  const { data: rekapPembangunan } = useRekapPembangunanPerLokasi(formKey === 'pembangunan');
  const { data: belumUpload } = usePicLokasiBelumUpload(formKey === 'it');
  const { data: stokManagerUntukKontrolFnb } = useManagerRestoUntukKontrolFnb(formKey === 'kontrol_fnb');
  const { data: kebutuhanPembangunanAccounting } = useKebutuhanPembangunanAccounting(formKey === 'accounting');
  const { data: omzetResto } = useOmzetRestoHariIni(formKey === 'accounting');
  const { data: cutiHariIni } = useCutiUntukTanggal(tanggalWIB(), formKey === 'hrd');
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

  if (berScope && kombinasiDitugaskan.length === 0) {
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
      let isiKirim: FieldValues =
        formKey === 'personal_marketing'
          ? { ...data, pernyataan_at: new Date().toISOString(), pernyataan_nama: profile?.nama ?? null }
          : data;

      // Blok 6 "Cashflow Hari Ini" -- dihitung dari blok 2/4 di form yang sama
      // (§3.5b, bukan diketik ulang), lalu DISUNTIKKAN ke data tersimpan supaya
      // v_keuangan_rekap (Task 20) punya total_masuk/total_keluar untuk dibaca --
      // lihat komentar hitungCashflowHariIni (lib/api/accounting.ts).
      if (formKey === 'accounting') {
        const { totalMasuk, totalKeluar, net } = hitungCashflowHariIni(isiKirim);
        isiKirim = { ...isiKirim, total_masuk: totalMasuk, total_keluar: totalKeluar, net_cashflow: net };
      }

      let idAkhir = reportId;
      if (idAkhir) {
        await simpanDraft.mutateAsync({ reportId: idAkhir, isi: isiKirim });
      } else {
        idAkhir = await simpanDraft.mutateAsync({ reportId: null, isi: isiKirim });
        setReportIdBaru(idAkhir);
      }

      // 03-CALC-SPEC.md §5: warna_akhir = yang paling buruk antara warna yang
      // dipilih pengisi sendiri (field type:'status_warna', kalau ada di
      // schema) dan warna_otomatis (decision urgensi 1 -> merah; terlambat
      // atau decision urgensi 2/3 -> kuning) -- lihat lib/warna.ts untuk apa
      // yang SUDAH dan BELUM ditangani di sini.
      const terlambatKirim = apakahTerlambat(policy, formKey, kombinasiAktif?.shiftId ? batasLaporShift(kombinasiAktif.shiftId) : null);
      const urgensi = urgensiTerburukDariKirim(schema, isiKirim);
      const warnaAkhir = warnaTerburuk(warnaDipilihDari(schema, isiKirim), warnaOtomatis(urgensi, terlambatKirim));

      await kirimReport.mutateAsync({
        reportId: idAkhir,
        isi: isiKirim,
        warna: warnaAkhir,
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

      // Generik utk field type:'tabel' ber-`sumberKeputusan: true` (forms/types.ts)
      // -- tiap BARIS jadi satu baris `decision` terpisah, urgensi = urutan baris
      // (maksimal 3, dibatasi constraint decision.urgensi). Dipakai accounting §16
      // "Prioritas Pembayaran", tapi mekanismenya generik utk form apa pun.
      for (const block of schema.blocks) {
        for (const field of block.fields) {
          if (field.type !== 'tabel' || !field.sumberKeputusan) continue;
          const baris = (isiKirim[field.key] as Record<string, unknown>[] | undefined) ?? [];
          for (let i = 0; i < baris.length; i++) {
            const r = baris[i];
            const judulBaris = typeof r.judul === 'string' ? r.judul.trim() : '';
            if (!judulBaris) continue;
            await buatKeputusanDariLaporan(idAkhir, judulBaris, null, {
              nominal: angkaDariTeks(r.nominal),
              deadline: tanggalDariTeks(r.deadline),
              dampak: typeof r.dampak === 'string' && r.dampak.trim() ? r.dampak : null,
              urgensi: Math.min(i + 1, 3),
            });
          }
        }
      }

      // Pesan sukses TIDAK LAGI ditulis ke sini -- layar konfirmasi
      // FormRenderer (laporanTerkirim, dihitung dari reportHariIni yang baru
      // saja invalidated) yang menampilkannya sekarang, termasuk status
      // TERLAMBAT (instruksi eksplisit user, 30 Agustus 2026: "seperti
      // Google Form", bukan tulisan kecil di bawah tombol). `pesanKirim`
      // sekarang HANYA dipakai untuk galat pengiriman (catch di bawah).
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
  const kebutuhanBesokResto = formKey === 'manager_resto' ? ringkasanKebutuhanBesok(nilaiUntukPratinjau) : null;
  const cashflowAccounting = formKey === 'accounting' ? hitungCashflowHariIni(nilaiUntukPratinjau) : null;

  // Ringkasan per bagian untuk FormRenderer (§5 DESIGN.md, koreksi 30 Agustus
  // 2026) -- HANYA bagian "Target Closing Pribadi" dulu (satu bagian yang
  // diminta ditunjukkan sebelum lanjut ke bagian lain). Progres+konsekuensi
  // di sini MENGGANTIKAN paragraf potongan Rp300.000 yang dulu berdiri
  // sendiri di bawah -- sekarang tersimpan DI DALAM kartu bagiannya, bukan
  // terpisah/mengambang.
  const closingSelesai = closingTarget !== null && progres ? progres.closing >= closingTarget : false;
  const statusClosingBlok: 'aman' | 'perlu_dikawal' | undefined = !infoPotongan || !infoPotongan.berlaku ? undefined : closingSelesai ? 'aman' : 'perlu_dikawal';
  const ringkasanBlokPersonalMarketing =
    formKey === 'personal_marketing' && progres && closingTarget !== null
      ? {
          closing: {
            progres: `${progres.closing} dari ${closingTarget} konsumen`,
            konsekuensi:
              !infoPotongan || !infoPotongan.berlaku
                ? 'Ketentuan belum berlaku.'
                : closingSelesai
                  ? 'Target closing terpenuhi: Rp300.000 tidak dipotong.'
                  : `Target closing belum terpenuhi: mengikuti ketentuan potongan Rp${infoPotongan.potongan?.toLocaleString('id-ID')} (proyeksi).`,
            status: statusClosingBlok,
          },
        }
      : undefined;

  // Layar konfirmasi kirim (instruksi eksplisit user, 30 Agustus 2026:
  // "seperti Google Form", "terapkan ke SEMUA form lewat FormRenderer") --
  // dibangun di sini (LaporForm.tsx TAHU form_key/policy/deadline), diteruskan
  // ke FormRenderer sebagai data murni -- FormRenderer sendiri tetap generik.
  const pesanTerlambatKirim =
    reportHariIni?.status === 'terlambat' && reportHariIni.submitted_at && policy
      ? (() => {
          const batas = batasJamKirim(policy, formKey, kombinasiAktif?.shiftId ? batasLaporShift(kombinasiAktif.shiftId) : null);
          const jamKirim = jamWIB(new Date(reportHariIni.submitted_at));
          return `Terkirim, tercatat ${labelSisaWaktu(batas, jamKirim).label} dari batas ${batas.replace(':', '.')}.`;
        })()
      : null;

  // Generik: baris ringkasan singkat diambil dari `ringkasanBlok` (progres
  // yang SUDAH terisi) yang mana pun sedang dipakai form ini -- HANYA
  // personal_marketing.closing hari ini (satu bagian, instruksi eksplisit),
  // form lain otomatis tidak dapat ringkasan (bukan dikosongkan sengaja per
  // form_key, cuma belum ada `ringkasanBlok` yang dikirim untuknya).
  const ringkasanKonfirmasi = ringkasanBlokPersonalMarketing
    ? Object.entries(ringkasanBlokPersonalMarketing)
        .filter(([, r]) => r.progres)
        .map(([id, r]) => `${schema.blocks.find((b) => b.id === id)?.judul ?? id}: ${r.progres}`)
    : undefined;

  const laporanTerkirim: LaporanTerkirim | null =
    reportHariIni && reportHariIni.status !== 'draft' && reportHariIni.submitted_at
      ? {
          status: reportHariIni.status,
          submittedAt: reportHariIni.submitted_at,
          pesanTerlambat: pesanTerlambatKirim,
          ringkasan: ringkasanKonfirmasi,
        }
      : null;

  return (
    <main className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
        {schema.nama}
      </h1>

      {formKey === 'personal_marketing' && profile && (
        <div className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
          <p style={{ fontFamily: 'var(--display)', fontWeight: 500, color: 'var(--biru)' }}>Identitas</p>
          <p>
            {profile.nama} · {profile.divisi ?? '—'} · {profile.jabatan ?? '—'}
          </p>
        </div>
      )}

      {formKey !== 'personal_marketing' && profile && (
        <div className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }} suppressHydrationWarning>
          <p style={{ fontFamily: 'var(--display)', fontWeight: 500, color: 'var(--biru)' }}>Identitas</p>
          <p>
            {tanggalIndonesiaWIB()}
            {kombinasiAktif ? ` · ${labelKombinasi(kombinasiAktif)}` : ''} · PIC: {profile.nama}
          </p>
        </div>
      )}

      {/* Progres closing SEKARANG di dalam kartu bagian "Target Closing Pribadi"
          sendiri (ringkasanBlokPersonalMarketing di atas, diteruskan ke
          FormRenderer) -- tidak diulang di sini lagi. Undangan belum
          disentuh batch ini (satu bagian dulu, instruksi eksplisit user). */}
      {formKey === 'personal_marketing' && progres && invitTarget !== null && (
        <div className="flex flex-wrap gap-4 border p-3" style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)', fontFamily: 'var(--mono)' }}>
          <span>
            Undangan bulan ini: {progres.undangan} / {invitTarget}
          </span>
        </div>
      )}

      {formKey === 'personal_marketing' && progres && invitTarget !== null && closingTarget !== null && (
        <div className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
          <p style={{ fontFamily: 'var(--display)', fontWeight: 500, color: 'var(--biru)' }}>Status Personal Marketing</p>
          <p>
            {IKON[statusClosing(progres.closing, closingTarget)]} Closing · {IKON[statusUndangan(progres.undangan, invitTarget)]}{' '}
            Undangan {invitTarget} orang · {ringkasanPte ? (ringkasanPte.lengkap ? '🟢 PTE lengkap' : '🔴 PTE tidak lengkap') : '— PTE'}
          </p>
        </div>
      )}

      {formKey === 'personal_marketing' && ringkasanPte && (
        <div className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
          <p style={{ fontFamily: 'var(--display)', fontWeight: 500, color: 'var(--biru)' }}>Status PTE Rp500.000 (pratinjau hari ini)</p>
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

      {perluRollupMarketing && progres && invitTarget !== null && closingTarget !== null && (
        <div className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
          <p style={{ fontFamily: 'var(--display)', fontWeight: 500, color: 'var(--biru)' }}>Laporan Personal Marketing</p>
          <p>
            Laporan personal sudah dikirim: {laporanMarketingHariIni?.status && laporanMarketingHariIni.status !== 'draft' ? '✅' : '❌'} · Undangan
            bulan ini: {progres.undangan} / {invitTarget} · Closing bulan ini: {progres.closing} / {closingTarget}
          </p>
        </div>
      )}

      {formKey === 'pembangunan' && rekapPembangunan && <RekapPembangunanOtomatis data={rekapPembangunan} />}

      {formKey === 'it' && belumUpload && <BelumUploadOtomatis data={belumUpload} />}

      {formKey === 'manager_resto' && kebutuhanBesokResto && <KebutuhanBesokRestoOtomatis data={kebutuhanBesokResto} />}

      {formKey === 'kontrol_fnb' && stokManagerUntukKontrolFnb && <StokManagerUntukKontrolFnbOtomatis data={stokManagerUntukKontrolFnb} />}

      {formKey === 'accounting' && kebutuhanPembangunanAccounting && (
        <KebutuhanPembangunanAccountingOtomatis data={kebutuhanPembangunanAccounting} />
      )}

      {formKey === 'accounting' && omzetResto && <OmzetRestoOtomatis data={omzetResto} />}

      {formKey === 'accounting' && cashflowAccounting && <CashflowOtomatis data={cashflowAccounting} />}

      {formKey === 'hrd' && cutiHariIni && <AbsensiCutiOtomatis data={cutiHariIni} />}

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
        ringkasanBlok={ringkasanBlokPersonalMarketing}
        laporanTerkirim={laporanTerkirim}
      />

      {mengirim && <p>Mengirim…</p>}
      {/* pesanKirim sekarang HANYA galat -- sukses ditangani layar konfirmasi FormRenderer (laporanTerkirim). */}
      {pesanKirim && <p style={{ color: 'var(--merah)' }}>{pesanKirim}</p>}
    </main>
  );
}

/**
 * Rekap baca-saja per lokasi untuk blok 1/3/5 form Pembangunan -- SATU query
 * ke `v_pembangunan_per_lokasi` (view agregat security-definer, lihat
 * lib/api/pembangunan.ts), bukan ke `report` langsung. `material_kurang`
 * (nama material, kebutuhan, untuk unit, tanggal) DITAMPILKAN lengkap --
 * tabel terstruktur yang memang dibutuhkan (§3.4b syarat #1, diperbaiki
 * user 23 Agustus 2026). `kiriman_kekurangan`/`infrastruktur_kebutuhan`
 * (teks bebas) TETAP tidak ditampilkan -- view-nya memang tidak pernah
 * mengirim itu.
 */
function RekapPembangunanOtomatis({ data }: { data: PembangunanPerLokasiRow[] }) {
  return (
    <>
      <RekapUnitOtomatis data={data} />
      <RekapMaterialOtomatis data={data} />
      <RekapInfrastrukturOtomatis data={data} />
    </>
  );
}

/** 1 · Rekap unit pembangunan per lokasi. */
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
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        Rekap Unit Seluruh Lokasi (dari PIC Lokasi)
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
              <tr style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>
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

/**
 * 3 · Rekap material per lokasi -- termasuk daftar material yang kurang
 * (nama, kebutuhan, untuk unit, tanggal dibutuhkan): tabel terstruktur yang
 * memang dibutuhkan supaya bisa dipesan (§3.4b syarat #1, diperbaiki user).
 * Catatan bebas PIC (`kiriman_kekurangan`) TETAP tidak ditampilkan -- view-nya
 * memang tidak pernah mengirim itu.
 */
function RekapMaterialOtomatis({ data }: { data: PembangunanPerLokasiRow[] }) {
  const yaTidak = (v: boolean | null) => (v === null ? '—' : v ? '✅' : '❌');

  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        Material per Lokasi (dari PIC Lokasi)
      </p>
      <p className="mb-3 text-sm" style={{ color: 'var(--biru-3)' }}>
        Rekap material per lokasi, hari ini. Hanya baca.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Belum ada PIC Lokasi yang mengirim laporan hari ini.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((r) => (
            <div key={r.lokasi} className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
              <p style={{ fontFamily: 'var(--display)', fontWeight: 500 }}>{r.lokasi}</p>
              <p>
                Material cukup: {yaTidak(r.material_cukup)} · Kiriman precast/perikas diterima: {r.kiriman_precast_jumlah ?? 0} pcs
              </p>
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

/** 5 · Rekap kondisi infrastruktur per lokasi -- status saja, bukan observasi bebas (§3.4b). */
function RekapInfrastrukturOtomatis({ data }: { data: PembangunanPerLokasiRow[] }) {
  const yaTidak = (v: boolean | null) => (v === null ? '—' : v ? '✅' : '❌');

  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        Kondisi Infrastruktur per Lokasi (dari PIC Lokasi)
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
              <p style={{ fontFamily: 'var(--display)', fontWeight: 500 }}>{r.lokasi}</p>
              <p>
                Jalan: {r.jalan_status ?? '—'} · Listrik: {r.listrik_status ?? '—'} · Air: {r.air_status ?? '—'}
              </p>
              <p>
                Drainase: {yaTidak(r.drainase_baik)} · Penerangan: {yaTidak(r.penerangan_baik)} · Gerbang: {yaTidak(r.gerbang_baik)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 7 · Daftar PIC lokasi yang BELUM mengirim foto/video pembangunan hari ini
 * -- dihitung dari tabel `attachment` (D2), bukan diketik PIC IT.
 * `usePicLokasiBelumUpload()` (lib/api/it.ts) sendiri sudah memisahkan
 * sumbernya: lokasi dari view security-definer (tanpa nama), nama PIC dari
 * query biasa ke assignment+profile (broadly readable) -- lihat komentar
 * di sana.
 */
function BelumUploadOtomatis({ data }: { data: LokasiBelumUpload[] }) {
  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        PIC Lokasi yang Belum Mengirim Foto/Video Pembangunan
      </p>
      <p className="mb-3 text-sm" style={{ color: 'var(--biru-3)' }}>
        Dihitung otomatis dari lampiran laporan PIC Lokasi hari ini. Hanya baca.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Semua lokasi sudah mengirim foto/video hari ini.
        </p>
      ) : (
        <ul className="list-disc pl-5 text-sm">
          {data.map((l) => (
            <li key={l.lokasiId}>
              {l.lokasi} -- PIC: {l.picNama.join(', ') || '—'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * 12 · Kebutuhan untuk Besok (manager_resto) -- rollup DALAM SATU FORM dari
 * blok 4 (stok habis) + blok 5 (kebutuhan besok) yang sedang diisi Manager
 * sendiri (§3.5b berlaku juga di dalam satu form, keputusan D3.5b/2).
 */
function KebutuhanBesokRestoOtomatis({ data }: { data: ReturnType<typeof ringkasanKebutuhanBesok> }) {
  const adaKebutuhan = data.stokHabis.length > 0 || data.stokAkanHabis.length > 0 || data.esBatu || data.air || data.gas;
  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        Kebutuhan untuk Besok
      </p>
      <p className="mb-3 text-sm" style={{ color: 'var(--biru-3)' }}>
        Ringkasan otomatis dari &quot;Stok Habis / Kebutuhan Kiriman Pusat&quot; dan &quot;Utilitas&quot; di atas. Hanya baca.
      </p>
      {!adaKebutuhan ? (
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Belum ada kebutuhan tercatat di atas.
        </p>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          {data.stokHabis.map((b, i) => (
            <p key={`habis-${i}`}>
              Sudah habis: {b.barang ?? '—'} -- {b.jumlah ?? '—'} {b.satuan ?? ''}
            </p>
          ))}
          {data.stokAkanHabis.map((b, i) => (
            <p key={`akan-habis-${i}`}>
              Akan habis: {b.barang ?? '—'} -- {b.jumlah ?? '—'} {b.satuan ?? ''}, dibutuhkan {b.kebutuhan_tanggal ?? '—'}
            </p>
          ))}
          {data.esBatu !== null && <p>Es batu -- kebutuhan besok: {data.esBatu}</p>}
          {data.air !== null && <p>Air -- kebutuhan besok: {data.air}</p>}
          {data.gas !== null && <p>Gas -- kebutuhan besok: {data.gas}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * 8/9 (kontrol_fnb, dulu "ita" sebelum dipecah 30 Agustus 2026 -- lihat
 * forms/f16-kontrol-fnb.ts) -- angka Manager Resto per outlet, dari view
 * security-definer `v_manager_resto_untuk_kontrol_fnb` (§3.4b, migrasi
 * 0036, diganti nama dari `v_manager_resto_untuk_ita`). Dipakai utk dua hal
 * sekaligus: pembanding di blok "Kontrol Stok Restoran" (silang-cek,
 * keputusan 3) dan rollup baca-saja di blok "Kebutuhan Stok/RAB" (keputusan
 * D-lanjutan).
 */
function StokManagerUntukKontrolFnbOtomatis({ data }: { data: ManagerRestoUntukKontrolFnbRow[] }) {
  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        Angka Manager Resto (pembanding &amp; kebutuhan stok)
      </p>
      <p className="mb-3 text-sm" style={{ color: 'var(--biru-3)' }}>
        Dari laporan Manager Resto hari ini, per outlet. Hanya baca -- dipakai sebagai pembanding di &quot;Kontrol Stok Restoran&quot; dan sumber daftar di &quot;Kebutuhan Stok / RAB&quot;.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Belum ada laporan Manager Resto hari ini.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((o) => (
            <div key={o.outlet} className="border p-3 text-sm" style={{ borderColor: 'var(--garis)' }}>
              <p style={{ fontFamily: 'var(--display)', fontWeight: 500 }}>{o.outlet}</p>
              <p>
                Ada selisih stok (versi Manager): {o.ada_selisih_stok === null ? '—' : o.ada_selisih_stok ? '✅' : '❌'} -- jumlah item
                selisih: {o.jumlah_item_selisih ?? 0}
              </p>
              {o.stok_habis.length > 0 && (
                <ul className="list-disc pl-5">
                  {o.stok_habis.map((b, i) => (
                    <li key={i}>
                      Habis: {b.barang ?? '—'} -- {b.jumlah ?? '—'} {b.satuan ?? ''}
                    </li>
                  ))}
                </ul>
              )}
              {o.stok_akan_habis.length > 0 && (
                <ul className="list-disc pl-5">
                  {o.stok_akan_habis.map((b, i) => (
                    <li key={i}>
                      Akan habis: {b.barang ?? '—'} -- {b.jumlah ?? '—'} {b.satuan ?? ''}, dibutuhkan {b.kebutuhan_tanggal ?? '—'}
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

/**
 * 8 · Kebutuhan Pembangunan + bagian otomatis Blok 10 (accounting) -- dari
 * view security-definer `v_kebutuhan_pembangunan_accounting` (§3.4b,
 * keputusan 4: precast/DTI, material, infrastruktur/jalan adalah pengajuan
 * divisi lain, bukan diketik Accounting).
 */
function KebutuhanPembangunanAccountingOtomatis({ data }: { data: KebutuhanPembangunanAccounting }) {
  const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;
  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        Kebutuhan Pembangunan
      </p>
      <p className="mb-3 text-sm" style={{ color: 'var(--biru-3)' }}>
        Pengajuan Kepala Pembangunan &amp; DTI hari ini. Hanya baca -- dipakai juga sebagai angka otomatis di &quot;Kontraktor / Supplier / DTI&quot;
        (Precast/DTI, Material, Infrastruktur/jalan).
      </p>
      <div className="flex flex-col gap-2 text-sm">
        <p>Precast/DTI: {rupiah(data.precastDti)}</p>
        <p style={{ fontFamily: 'var(--display)', fontWeight: 500, color: 'var(--biru)' }}>Material borongan (total {rupiah(data.totalMaterial)})</p>
        {data.materialBorongan.length === 0 ? (
          <p style={{ color: 'var(--kosong)' }}>Tidak ada pengajuan material hari ini.</p>
        ) : (
          <ul className="list-disc pl-5">
            {data.materialBorongan.map((m, i) => (
              <li key={i}>
                {m.material ?? '—'} -- {m.kebutuhan ?? '—'}, {m.estimasi_biaya ?? '—'}, dibutuhkan {m.dibutuhkan_tanggal ?? '—'}
              </li>
            ))}
          </ul>
        )}
        <p style={{ fontFamily: 'var(--display)', fontWeight: 500, color: 'var(--biru)' }}>Rencana infrastruktur (total {rupiah(data.totalInfrastruktur)})</p>
        {data.infrastrukturRencana.length === 0 ? (
          <p style={{ color: 'var(--kosong)' }}>Tidak ada rencana infrastruktur hari ini.</p>
        ) : (
          <ul className="list-disc pl-5">
            {data.infrastrukturRencana.map((r, i) => (
              <li key={i}>
                {r.lokasi ?? '—'} -- {r.pekerjaan ?? '—'} ({r.kontraktor ?? '—'}), anggaran {r.anggaran ?? '—'}, target{' '}
                {r.target_selesai ?? '—'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * 13 · Rekonsiliasi Resto (accounting) -- omzet versi Manager & versi Kontrol
 * F&B ditampilkan berdampingan, selisih dihitung sistem (keputusan D, "tiga
 * pengukuran satu layar"). Query biasa (lib/api/accounting.ts) -- accounting
 * sudah punya can_see_report() ke manager_resto/kontrol_fnb (dulu "ita"
 * sebelum dipecah 30 Agustus 2026, migrasi 0036/0037), tidak perlu security
 * definer.
 */
function OmzetRestoOtomatis({ data }: { data: OmzetRestoRow[] }) {
  const rupiah = (n: number | null) => (n === null ? '—' : `Rp${n.toLocaleString('id-ID')}`);
  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        Omzet Resto -- Tiga Pengukuran
      </p>
      <p className="mb-3 text-sm" style={{ color: 'var(--biru-3)' }}>
        Omzet versi Manager Resto dan versi Kontrol F&amp;B, hari ini. Hanya baca -- lengkapi angka sisi bank di &quot;Rekonsiliasi Resto&quot;, selisih dihitung otomatis.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Belum ada laporan Manager Resto hari ini.
        </p>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          {data.map((o) => {
            const selisih = o.omzetManager !== null && o.omzetKontrolFnb !== null ? o.omzetManager - o.omzetKontrolFnb : null;
            return (
              <p key={o.outlet}>
                <b style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{o.outlet}</b> -- versi Manager: {rupiah(o.omzetManager)} · versi Kontrol F&amp;B:{' '}
                {rupiah(o.omzetKontrolFnb)} · selisih: {selisih === null ? '—' : rupiah(selisih)}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 6 · Cashflow Hari Ini (accounting) -- uang masuk/keluar/net dihitung dari
 * Blok 2/4 di form yang sama (§3.5b), pratinjau hidup lewat
 * `hitungCashflowHariIni` (lib/api/accounting.ts) -- angka yang SAMA
 * disuntikkan ke `report.data` saat kirim, dibaca `v_keuangan_rekap`
 * (Task 20).
 */
function CashflowOtomatis({ data }: { data: ReturnType<typeof hitungCashflowHariIni> }) {
  const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;
  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        Cashflow Hari Ini (dihitung otomatis)
      </p>
      <p className="mb-3 text-sm" style={{ color: 'var(--biru-3)' }}>
        Dihitung otomatis dari &quot;Uang Masuk Hari Ini&quot; dan &quot;Uang Keluar Hari Ini&quot; di atas. Hanya baca.
      </p>
      <p style={{ fontFamily: 'var(--mono)' }}>(+) Uang masuk: {rupiah(data.totalMasuk)}</p>
      <p style={{ fontFamily: 'var(--mono)' }}>(-) Uang keluar: {rupiah(data.totalKeluar)}</p>
      <p style={{ fontFamily: 'var(--mono)' }}>NET CASHFLOW: {rupiah(data.net)}</p>
    </div>
  );
}

const LABEL_CUTI_JENIS: Record<CutiUntukTanggal['jenis'], string> = { cuti: 'Cuti', sakit: 'Sakit', izin: 'Izin' };

/**
 * Blok 1 "Absensi Hari Ini" (hrd) -- sakit/izin/cuti dihitung dari tabel
 * `cuti` (halaman /cuti, disetujui HRD/CEO), BUKAN diketik ulang HRD
 * (§3.5b, "satu angka, satu pengisi" -- instruksi eksplisit user 30 Agustus
 * 2026). Kalau ada pengajuan yang belum disetujui hari ini, HRD diarahkan
 * ke /cuti/tinjau dulu supaya angkanya benar sebelum kirim.
 */
function AbsensiCutiOtomatis({ data }: { data: CutiUntukTanggal[] }) {
  return (
    <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        Sakit / Izin / Cuti Hari Ini (dari halaman Cuti)
      </p>
      <p className="mb-3 text-sm" style={{ color: 'var(--biru-3)' }}>
        Dihitung otomatis dari pengajuan cuti yang SUDAH DISETUJUI. Hanya baca -- kalau ada pengajuan yang belum diputuskan, selesaikan dulu di{' '}
        <a href="/cuti/tinjau" style={{ color: 'var(--biru)' }}>
          Tinjau Cuti
        </a>{' '}
        supaya angkanya benar.
      </p>
      {data.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Tidak ada sakit/izin/cuti yang disetujui untuk hari ini.
        </p>
      ) : (
        <ul className="list-disc pl-5 text-sm">
          {data.map((c, i) => (
            <li key={i}>
              {c.nama} -- {LABEL_CUTI_JENIS[c.jenis]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
