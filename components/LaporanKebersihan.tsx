'use client';

import { useEffect, useState } from 'react';
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
  hitungBatasKebersihan,
  apakahTerlambatKebersihan,
  type SlotKebersihan,
} from '../lib/api/kebersihan';
import { jamWIB, tanggalWIB } from '../lib/tanggal';
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

  const judul = <h1 style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-angka-besar)', lineHeight: 1.2 }}>Laporan Kebersihan</h1>;

  if (outletLoading) {
    return (
      <main className="flex flex-col gap-6 p-6">
        {judul}
        <KerangkaDaftarKartu jumlah={2} />
      </main>
    );
  }

  if (!outletSaya || outletSaya.length === 0) {
    return (
      <main className="flex flex-col gap-6 p-6">
        {judul}
        <div className="kartu-status rail-netral">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>Tidak ada penugasan</p>
          <p className="text-sm" style={{ color: 'var(--label)' }}>Anda belum ditugaskan mengisi Laporan Kebersihan untuk outlet mana pun.</p>
        </div>
      </main>
    );
  }

  if (!outletId) {
    return (
      <main className="flex flex-col gap-6 p-6">
        {judul}
        <div className="flex flex-col gap-2">
          <p>Pilih outlet untuk laporan hari ini:</p>
          {outletSaya.map((o) => (
            <button key={o.id} type="button" onClick={() => setOutletId(o.id)} className="kartu-status rail-netral text-left">
              {o.nama}
            </button>
          ))}
        </div>
      </main>
    );
  }

  const toleransiMenit = typeof policy?.kebersihan_toleransi_menit === 'number' ? policy.kebersihan_toleransi_menit : 30;
  const batas = outlet ? hitungBatasKebersihan(outlet.jamBuka, toleransiMenit) : null;
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
      <main className="flex flex-col gap-6 p-6">
        {judul}
        <div className="flex flex-col gap-3">
          <p className="judul-bagian">Foto: {label}</p>
          <CameraCapture
            onGunakan={(blob) => void setelahFoto(slotAktif, blob)}
            onBatal={() => setSlotAktif(null)}
            watermark={{ baris1: `${outlet?.nama ?? ''} · ${jamWIB()} WIB`, baris2: label }}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6 p-6">
      {judul}
      <div>
        <p className="judul-bagian">{outlet?.nama}</p>
        {batas ? (
          <p className="text-sm" style={{ color: terlambatKalauSekarang && !semuaSelesai ? 'var(--merah)' : 'var(--label)' }}>
            Batas kirim {batas} WIB
          </p>
        ) : (
          <p className="text-sm" style={{ color: 'var(--kosong)' }}>Batas kirim belum diatur -- hubungi Admin untuk mengisi jam buka outlet.</p>
        )}
      </div>

      {reportLoading || !idLaporan ? (
        <KerangkaDaftarKartu jumlah={5} />
      ) : (
        <div className="flex flex-col gap-3">
          {SLOT_KEBERSIHAN.map((slot) => {
            const foto = fotoTersimpan?.find((f) => f.slot === slot.key);
            const diambilOrangLain = Boolean(foto) && foto?.uploadedByNama && foto.uploadedByNama !== profile?.nama;
            const pending = draftPending[slot.key];
            const sedangKirim = mengirimSlot === slot.key;
            const rail = foto ? 'rail-hijau' : pending ? 'rail-kuning' : 'rail-netral';
            return (
              <div key={slot.key} className={`kartu-status ${rail} flex items-center justify-between gap-3`}>
                <div>
                  <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{slot.label}</p>
                  <p className="status-teks" style={{ color: foto ? 'var(--hijau)' : pending ? 'var(--kuning)' : 'var(--kosong)' }}>
                    {foto
                      ? diambilOrangLain
                        ? `Sudah dikirim ${foto.uploadedByNama}, ${jamWIB(new Date(foto.createdAt))}`
                        : 'Sudah diambil'
                      : pending
                        ? 'Belum terkirim'
                        : 'Belum diambil'}
                  </p>
                  {pesanErrorSlot[slot.key] && (
                    <p className="text-sm" style={{ color: 'var(--merah)' }}>{pesanErrorSlot[slot.key]}</p>
                  )}
                </div>
                {foto ? null : pending ? (
                  <button
                    type="button"
                    disabled={sedangKirim}
                    onClick={() => void cobaKirimUlang(slot.key)}
                    className="tombol-sekunder"
                    style={{ flexShrink: 0 }}
                  >
                    {sedangKirim ? 'Mengirim…' : 'Coba Lagi'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={sedangKirim}
                    onClick={() => mulaiAmbil(slot.key)}
                    className="tombol-utama"
                    style={{ flexShrink: 0, fontSize: 14, padding: '8px 16px', minHeight: 44 }}
                  >
                    {sedangKirim ? 'Mengirim…' : 'Ambil Foto'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {semuaSelesai && (
        <div className="kartu-status rail-hijau">
          <p className="status-teks" style={{ color: 'var(--hijau)' }}>
            {reportHariIni?.status === 'terlambat' ? 'Laporan hari ini lengkap (terlambat)' : 'Laporan hari ini lengkap'}
          </p>
        </div>
      )}
    </main>
  );
}
