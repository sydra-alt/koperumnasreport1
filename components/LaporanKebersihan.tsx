'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth/AuthProvider';
import { usePolicy } from '../lib/api/policy';
import {
  SLOT_KEBERSIHAN,
  useOutletKebersihanSaya,
  usePastikanLaporanKebersihan,
  useReportKebersihanHariIni,
  useFotoKebersihanHariIni,
  useKirimFotoKebersihan,
  useSelesaikanLaporanKebersihan,
  useJadwalKebersihanHariIni,
  hitungBatasKebersihan,
  apakahTerlambatKebersihan,
  type SlotKebersihan,
} from '../lib/api/kebersihan';
import { jamWIB, tanggalIndonesiaWIB, tanggalWIB } from '../lib/tanggal';
import { CameraCapture } from './CameraCapture';
import { KerangkaDaftarKartu } from './Kerangka';
import {
  simpanKebersihanPending,
  muatSemuaKebersihanPending,
  hapusKebersihanPending,
  blobKeBase64,
  base64KeBlob,
} from '../lib/kebersihanDraftLokal';

/**
 * Laporan Kebersihan (CEO, 6-7 September 2026, pengganti laporan satpam) --
 * 5 foto wajib per outlet per hari (bar/toilet/meja/kursi/area bebas).
 * BUKAN lewat FormRenderer (lihat forms/f18-kebersihan.ts) -- alurnya
 * sengaja meniru app/absen/page.tsx: CameraCapture langsung (TANPA pemilih
 * galeri), draft lokal per slot kalau kirim gagal, waktu dicatat server.
 *
 * SATU laporan per OUTLET per hari, dipakai BERSAMA siapa pun yang punya
 * penugasan_absen di outlet itu (migrasi 0053) -- BUKAN satu per orang.
 * `report_insert`/`report_update`/`att_insert` generik (author-locked, dipakai
 * 14 form lain) TIDAK dilonggarkan -- laporan dibuat/diisi/diselesaikan lewat
 * tiga RPC khusus (`kebersihan_pastikan_laporan`, `kebersihan_catat_foto`,
 * `kebersihan_selesaikan_laporan`), lihat lib/api/kebersihan.ts.
 */
export function LaporanKebersihan() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const { data: outletSaya, isLoading: outletLoading } = useOutletKebersihanSaya(userId);
  const { data: policy } = usePolicy();

  const [outletId, setOutletId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [slotAktif, setSlotAktif] = useState<SlotKebersihan | null>(null);
  const [mengirimSlot, setMengirimSlot] = useState<SlotKebersihan | null>(null);
  const [pesanErrorSlot, setPesanErrorSlot] = useState<Record<string, string>>({});
  const [draftPending, setDraftPending] = useState<Record<string, boolean>>({});

  // Kalau cuma ditugaskan SATU outlet (kasus lazim), pilih otomatis --
  // setState dibungkus microtask, pola sama app/page.tsx Task 06
  // (react-hooks/set-state-in-effect). Kalau lebih dari satu (rotasi
  // Toni/Fikri/Fadil di dua outlet Indokopi), UI MEMAKSA memilih di bawah --
  // TIDAK ditebak dari lokasi GPS (instruksi eksplisit CEO).
  useEffect(() => {
    if (outletId || !outletSaya) return;
    if (outletSaya.length === 1) {
      Promise.resolve().then(() => setOutletId(outletSaya[0].id));
    }
  }, [outletSaya, outletId]);

  const outlet = outletSaya?.find((o) => o.id === outletId) ?? null;

  const { data: reportHariIni, isLoading: reportLoading } = useReportKebersihanHariIni(outletId);
  const { data: jadwalHariIni } = useJadwalKebersihanHariIni(outletId);
  const pastikanLaporan = usePastikanLaporanKebersihan();
  const selesaikanLaporan = useSelesaikanLaporanKebersihan();
  const idLaporan = reportHariIni?.id ?? reportId;
  const { data: fotoTersimpan, refetch: muatUlangFoto } = useFotoKebersihanHariIni(idLaporan ?? null);
  const kirimFoto = useKirimFotoKebersihan();

  // Pastikan baris `report` BERSAMA untuk outlet ini sudah ada SEBELUM foto
  // pertama bisa diambil -- lewat RPC (bukan report_insert generik), supaya
  // rekan yang lebih dulu membuka halaman ini TIDAK membuat baris kedua utk
  // outlet+hari yang sama.
  useEffect(() => {
    if (!outletId || idLaporan || reportLoading || pastikanLaporan.isPending) return;
    Promise.resolve().then(() => {
      pastikanLaporan.mutate(outletId, { onSuccess: (id) => setReportId(id) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pastikanLaporan sengaja tidak jadi dependency, cukup dipicu sekali per outletId
  }, [outletId, idLaporan, reportLoading]);

  // Muat draft lokal (foto tersimpan tapi belum berhasil terkirim) begitu
  // outlet diketahui -- draft tanggal LAIN sudah dibuang otomatis di dalam
  // `muatSemuaKebersihanPending` sendiri.
  useEffect(() => {
    if (!userId || !outletId) return;
    const semua = muatSemuaKebersihanPending(userId, outletId, tanggalWIB());
    Promise.resolve().then(() => {
      setDraftPending(Object.fromEntries(semua.map((d) => [d.slot, true])));
    });
  }, [userId, outletId]);

  const jumlahTerisi = fotoTersimpan?.length ?? 0;
  const semuaSelesai = jumlahTerisi === SLOT_KEBERSIHAN.length;

  // Begitu 5/5 terisi (oleh siapa pun) dan laporan belum berstatus terkirim,
  // tandai selesai lewat RPC -- status (terkirim/terlambat) dihitung SERVER
  // dari outlet.jam_buka + kebersihan_toleransi_menit.
  useEffect(() => {
    if (!semuaSelesai || !idLaporan) return;
    if (reportHariIni?.status === 'terkirim' || reportHariIni?.status === 'terlambat') return;
    if (selesaikanLaporan.isPending) return;
    Promise.resolve().then(() => {
      selesaikanLaporan.mutate(idLaporan);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semuaSelesai, idLaporan, reportHariIni?.status]);

  const kelasHalaman = 'mx-auto flex w-full max-w-[1120px] flex-col gap-4 px-4 py-5 md:gap-5 md:px-8 md:py-8';
  const judul = (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => router.back()}
        className="tombol-lingkar shrink-0"
        aria-label="Kembali"
        title="Kembali"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
      </button>
      <div>
        <span className="text-xs font-bold tracking-wider uppercase" style={{ color: 'var(--label)' }}>Kamera & Outlet</span>
        <h1 className="sapaan">Laporan Kebersihan</h1>
      </div>
    </div>
  );

  if (outletLoading) {
    return (
      <main className={kelasHalaman}>
        {judul}
        <KerangkaDaftarKartu jumlah={2} />
      </main>
    );
  }

  if (!outletSaya || outletSaya.length === 0) {
    return (
      <main className={kelasHalaman}>
        {judul}
        <div className="neumo-kartu p-6">
          <p className="judul-seksi">Tidak ada penugasan</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--label)' }}>Anda belum ditugaskan mengisi Laporan Kebersihan untuk outlet mana pun.</p>
        </div>
      </main>
    );
  }

  if (!outletId) {
    return (
      <main className={kelasHalaman}>
        {judul}
        <div className="neumo-kartu overflow-hidden md:max-w-[720px]">
          <div className="border-b p-5" style={{ borderColor: 'rgba(166, 180, 200, 0.16)' }}>
            <p className="judul-seksi">Pilih outlet untuk laporan hari ini:</p>
          </div>
          {outletSaya.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOutletId(o.id)}
              className="flex w-full items-center justify-between gap-3 border-b p-4 text-left transition-colors hover:bg-black/5"
              style={{ minHeight: 56, borderColor: 'rgba(166, 180, 200, 0.12)' }}
            >
              <span style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--biru)' }}>{o.nama}</span>
              <span aria-hidden="true" style={{ color: 'var(--label)', fontSize: 18 }}>›</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  const toleransiMenit = typeof policy?.kebersihan_toleransi_menit === 'number' ? policy.kebersihan_toleransi_menit : 30;
  const batas24Jam = typeof policy?.kebersihan_batas_24jam === 'string' ? policy.kebersihan_batas_24jam : null;
  const batas = jadwalHariIni ? hitungBatasKebersihan(jadwalHariIni, toleransiMenit, batas24Jam) : null;
  const terlambatKalauSekarang = apakahTerlambatKebersihan(batas);

  function mulaiAmbil(slot: SlotKebersihan) {
    setSlotAktif(slot);
  }

  async function setelahFoto(slot: SlotKebersihan, blob: Blob) {
    if (!idLaporan || !outletId) return;
    setSlotAktif(null);
    setMengirimSlot(slot);
    setPesanErrorSlot((p) => ({ ...p, [slot]: '' }));
    try {
      await kirimFoto.mutateAsync({ reportId: idLaporan, slot, blob });
      hapusKebersihanPending(outletId, slot);
      setDraftPending((p) => {
        const salinan = { ...p };
        delete salinan[slot];
        return salinan;
      });
      await muatUlangFoto();
    } catch (err) {
      const fotoBase64 = await blobKeBase64(blob);
      simpanKebersihanPending({
        userId: userId as string,
        outletId,
        tanggal: tanggalWIB(),
        slot,
        fotoBase64,
        fotoMime: 'image/jpeg',
      });
      setDraftPending((p) => ({ ...p, [slot]: true }));
      setPesanErrorSlot((p) => ({ ...p, [slot]: err instanceof Error ? err.message : 'Gagal mengirim.' }));
    } finally {
      setMengirimSlot(null);
    }
  }

  async function cobaKirimUlang(slot: SlotKebersihan) {
    if (!idLaporan || !userId || !outletId) return;
    const semua = muatSemuaKebersihanPending(userId, outletId, tanggalWIB());
    const draft = semua.find((d) => d.slot === slot);
    if (!draft) return;
    setMengirimSlot(slot);
    try {
      const blob = base64KeBlob(draft.fotoBase64);
      await kirimFoto.mutateAsync({ reportId: idLaporan, slot, blob });
      hapusKebersihanPending(outletId, slot);
      setDraftPending((p) => {
        const salinan = { ...p };
        delete salinan[slot];
        return salinan;
      });
      setPesanErrorSlot((p) => ({ ...p, [slot]: '' }));
      await muatUlangFoto();
    } catch (err) {
      setPesanErrorSlot((p) => ({ ...p, [slot]: err instanceof Error ? err.message : 'Gagal mengirim.' }));
    } finally {
      setMengirimSlot(null);
    }
  }

  if (slotAktif) {
    const label = SLOT_KEBERSIHAN.find((s) => s.key === slotAktif)?.label ?? slotAktif;
    return (
      <main className={kelasHalaman}>
        {judul}
        <div className="flex flex-col gap-3 md:max-w-[720px]">
          <p className="judul-seksi">Foto: {label}</p>
          <CameraCapture
            onGunakan={(blob) => void setelahFoto(slotAktif, blob)}
            onBatal={() => setSlotAktif(null)}
            facingMode="environment"
            watermark={{ baris1: `${outlet?.nama ?? ''} · ${jamWIB()} WIB`, baris2: label }}
          />
        </div>
      </main>
    );
  }

  const slotMuat = reportLoading || !idLaporan;
  const jumlahPending = SLOT_KEBERSIHAN.filter((s) => draftPending[s.key] && !fotoTersimpan?.some((f) => f.slot === s.key)).length;

  return (
    <main className={kelasHalaman}>
      {judul}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,720px)_320px] lg:items-start lg:gap-x-8">
        {/* Ringkasan Laporan & Progres (Neumorphic Card) */}
        <aside className="neumo-kartu flex flex-col gap-4 p-5 lg:sticky lg:top-4 lg:col-start-2 lg:row-start-1" aria-label="Ringkasan laporan">
          <div className="flex flex-col gap-1 border-b pb-3" style={{ borderColor: 'rgba(166, 180, 200, 0.16)' }}>
            <p className="judul-seksi" style={{ color: 'var(--biru)' }}>{outlet?.nama}</p>
            <p className="text-xs" style={{ color: 'var(--label)' }} suppressHydrationWarning>{tanggalIndonesiaWIB()}</p>
            {batas ? (
              <p className="mt-1 text-xs font-medium" style={{ color: terlambatKalauSekarang && !semuaSelesai ? 'var(--merah)' : 'var(--label)' }}>
                {jadwalHariIni?.buka24Jam ? `Buka 24 jam hari ini · Batas kirim ${batas} WIB` : `Batas kirim ${batas} WIB`}
              </p>
            ) : (
              <p className="mt-1 text-xs" style={{ color: 'var(--kosong)' }}>Batas kirim belum diatur -- hubungi Admin.</p>
            )}
          </div>
          {!slotMuat && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--label)' }}>Status Kelengkapan</span>
                <span className="font-bold" style={{ fontFamily: 'var(--mono)', color: semuaSelesai ? 'var(--hijau)' : 'var(--biru)' }}>
                  {jumlahTerisi}/{SLOT_KEBERSIHAN.length} Foto
                </span>
              </div>
              <div className="neumo-inset-sm p-1" style={{ borderRadius: 'var(--radius-pil)' }}>
                <div className="progres-bar" style={{ height: 10, background: 'transparent' }}>
                  <div
                    className="progres-bar-isi"
                    style={{
                      width: `${Math.round((jumlahTerisi / SLOT_KEBERSIHAN.length) * 100)}%`,
                      borderRadius: 'var(--radius-pil)',
                      background: semuaSelesai ? 'linear-gradient(90deg, #1E8A4C, #27AE60)' : 'linear-gradient(90deg, #1E4DB7, #3B6FE8)',
                    }}
                  />
                </div>
              </div>
              {semuaSelesai && (
                <p className="status-teks text-xs font-semibold" style={{ color: 'var(--hijau)' }}>
                  {reportHariIni?.status === 'terlambat' ? '✓ Laporan hari ini lengkap (terlambat)' : '✓ Laporan hari ini lengkap'}
                </p>
              )}
              {!semuaSelesai && jumlahPending > 0 && (
                <p className="status-teks text-xs font-semibold" style={{ color: 'var(--kuning)' }}>
                  ⚠ {jumlahPending} foto belum terkirim
                </p>
              )}
            </div>
          )}
        </aside>

        <div className="lg:col-start-1 lg:row-start-1">
          {slotMuat ? (
            <KerangkaDaftarKartu jumlah={5} />
          ) : (
            <section className="neumo-kartu overflow-hidden">
              <div className="flex items-baseline justify-between gap-3 border-b p-5" style={{ borderColor: 'rgba(166, 180, 200, 0.16)' }}>
                <h2 className="judul-seksi" style={{ fontSize: 16 }}>Daftar Area Foto Wajib</h2>
                <span className="text-xs font-semibold" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>{jumlahTerisi} dari {SLOT_KEBERSIHAN.length} selesai</span>
              </div>
              {SLOT_KEBERSIHAN.map((slot, i) => {
                const foto = fotoTersimpan?.find((f) => f.slot === slot.key);
                const diambilOrangLain = Boolean(foto) && foto?.uploadedByNama && foto.uploadedByNama !== profile?.nama;
                const pending = draftPending[slot.key];
                const sedangKirim = mengirimSlot === slot.key;
                return (
                  <div
                    key={slot.key}
                    className="flex flex-wrap items-center justify-between gap-3 border-b p-4 transition-colors"
                    style={{
                      minHeight: 70,
                      borderColor: 'rgba(166, 180, 200, 0.12)',
                      background: foto ? 'rgba(30, 138, 76, 0.02)' : pending ? 'rgba(217, 131, 36, 0.02)' : 'transparent',
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          background: foto ? 'rgba(30, 138, 76, 0.12)' : 'var(--permukaan)',
                          color: foto ? 'var(--hijau)' : 'var(--label)',
                          boxShadow: foto ? 'none' : 'var(--bayangan-neumo-sm)',
                        }}
                      >
                        {foto ? '✓' : String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <p style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 15, lineHeight: 1.3, color: 'var(--tinta)' }}>{slot.label}</p>
                        <p className="mt-0.5 text-xs font-medium" style={{ color: foto ? 'var(--hijau)' : pending ? 'var(--kuning)' : 'var(--label)' }}>
                          {foto
                            ? diambilOrangLain
                              ? `Sudah dikirim ${foto.uploadedByNama} (${jamWIB(new Date(foto.createdAt))})`
                              : `Sudah diambil (${jamWIB(new Date(foto.createdAt))})`
                            : pending
                              ? 'Tersimpan lokal, belum terkirim'
                              : 'Wajib diambil'}
                        </p>
                        {pesanErrorSlot[slot.key] && (
                          <p className="mt-1 text-xs" style={{ color: 'var(--merah)' }}>{pesanErrorSlot[slot.key]}</p>
                        )}
                      </div>
                    </div>
                    {foto ? null : pending ? (
                      <button
                        type="button"
                        disabled={sedangKirim}
                        onClick={() => void cobaKirimUlang(slot.key)}
                        className="tombol-sekunder"
                        style={{ flexShrink: 0, minWidth: 112, minHeight: 40, fontSize: 13 }}
                      >
                        {sedangKirim ? 'Mengirim…' : 'Coba Lagi'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={sedangKirim}
                        onClick={() => mulaiAmbil(slot.key)}
                        className="tombol-utama inline-flex items-center gap-1.5"
                        style={{ flexShrink: 0, minWidth: 116, fontSize: 13, padding: '8px 16px', minHeight: 40 }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                        <span>{sedangKirim ? 'Mengirim…' : 'Ambil Foto'}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
