'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { usePolicy } from '../../lib/api/policy';
import { useTitikAbsenSaya, useAbsenHariIni, useKirimAbsen, useSetujuiPrivasiPresensi } from '../../lib/api/absensi';
import { urutkanTitikTerdekat, hitungTerlambatMenit, statusDariJarak, type TitikDenganJarak } from '../../lib/absen';
import { jamWIB, tanggalWIB } from '../../lib/tanggal';
import { CameraCapture } from '../../components/CameraCapture';
import {
  simpanAbsenPending,
  muatAbsenPending,
  hapusAbsenPending,
  blobKeBase64,
  base64KeBlob,
  type AbsenPending,
} from '../../lib/absenDraftLokal';

type Layar =
  | 'memuat'
  | 'ringkasan'
  | 'belum_terkirim'
  | 'mencari_lokasi'
  | 'gps_ditolak'
  | 'gps_gagal'
  | 'gps_lemah'
  | 'tidak_ada_titik'
  | 'konfirmasi_titik'
  | 'pilih_titik'
  | 'luar_radius_tolak'
  | 'luar_radius_tanda'
  | 'kamera'
  | 'mengirim'
  | 'berhasil';



export default function AbsenPage() {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const { data: policy } = usePolicy();
  const { data: titikSaya, isLoading: titikLoading } = useTitikAbsenSaya(userId);
  const { data: absenHariIni, isLoading: absenLoading, refetch: muatUlangAbsenHariIni } = useAbsenHariIni(userId);
  const kirimAbsen = useKirimAbsen(userId);
  const setujuiPrivasi = useSetujuiPrivasiPresensi();
  const [privasiDisetujuiLokal, setPrivasiDisetujuiLokal] = useState(false);
  const sudahSetujuiPrivasi = Boolean(profile?.persetujuan_privasi_absen_at) || privasiDisetujuiLokal;

  const [layar, setLayar] = useState<Layar>('memuat');
  const [tipeAktif, setTipeAktif] = useState<'masuk' | 'pulang' | null>(null);
  const [posisi, setPosisi] = useState<{ lat: number; lon: number; akurasi: number } | null>(null);
  const [akurasiTerakhir, setAkurasiTerakhir] = useState<number | null>(null);
  const [titikTerurut, setTitikTerurut] = useState<TitikDenganJarak[]>([]);
  const [titikDipilih, setTitikDipilih] = useState<TitikDenganJarak | null>(null);
  const [pesanError, setPesanError] = useState<string | null>(null);
  const [draftPending, setDraftPending] = useState<AbsenPending | null>(null);
  const [hasilBerhasil, setHasilBerhasil] = useState<{ label: string; keteranganLuarRadius: boolean } | null>(null);

  // Draft belum terkirim (localStorage) dicek SEKALI saat userId siap --
  // kalau ada, langsung tampilkan layar retry, lewati semua langkah lain.
  // setState dibungkus microtask (bukan langsung di badan efek) supaya
  // lolos react-hooks/set-state-in-effect -- pola sama dengan alasan yang
  // sudah didokumentasikan di app/page.tsx (Task 06): mencegah potensi
  // cascading render, bukan menonaktifkan aturannya.
  useEffect(() => {
    if (!userId) return;
    Promise.resolve().then(() => {
      const draft = muatAbsenPending(userId);
      if (draft && draft.tanggal === tanggalWIB()) {
        setDraftPending(draft);
        setLayar('belum_terkirim');
      } else {
        if (draft) hapusAbsenPending(); // draft basi (hari lain) -- buang diam-diam, bukan disodorkan
        setLayar('ringkasan');
      }
    });
  }, [userId]);

  if (!session || titikLoading || absenLoading || !policy || layar === 'memuat') {
    return <main className="p-6">Memuat…</main>;
  }

  if (!sudahSetujuiPrivasi) {
    return (
      <PersetujuanPrivasi
        sedangMenyimpan={setujuiPrivasi.isPending}
        error={setujuiPrivasi.isError ? (setujuiPrivasi.error as Error).message : null}
        onSetuju={async () => {
          await setujuiPrivasi.mutateAsync();
          setPrivasiDisetujuiLokal(true);
        }}
      />
    );
  }

  const jamMasukDefault = String(policy.jam_masuk ?? '08:00');
  const toleransiMenit = Number(policy.toleransi_terlambat_menit ?? 15);
  const akurasiMaks = Number(policy.absen_akurasi_maksimal_meter ?? 100);
  const kebijakanLuarRadius = String(policy.absen_di_luar_radius ?? 'izinkan_dengan_tanda');

  const sudahMasuk = (absenHariIni ?? []).find((a) => a.tipe === 'masuk');
  const sudahPulang = (absenHariIni ?? []).find((a) => a.tipe === 'pulang');

  function mulaiAbsen(tipe: 'masuk' | 'pulang') {
    setPesanError(null);
    setTipeAktif(tipe);
    if (!titikSaya || titikSaya.length === 0) {
      setLayar('tidak_ada_titik');
      return;
    }
    setLayar('mencari_lokasi');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setAkurasiTerakhir(accuracy);
        if (accuracy > akurasiMaks) {
          setLayar('gps_lemah');
          return;
        }
        setPosisi({ lat: latitude, lon: longitude, akurasi: accuracy });
        const terurut = urutkanTitikTerdekat(titikSaya, latitude, longitude);
        setTitikTerurut(terurut);
        setTitikDipilih(terurut[0]);
        setLayar('konfirmasi_titik');
      },
      (err) => {
        setLayar(err.code === err.PERMISSION_DENIED ? 'gps_ditolak' : 'gps_gagal');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  function lanjutkanSetelahKonfirmasi() {
    if (!titikDipilih) return;
    const status = statusDariJarak(titikDipilih.jarakMeter, titikDipilih.radiusMeter);
    if (status === 'valid') {
      setLayar('kamera');
    } else if (kebijakanLuarRadius === 'tolak') {
      setLayar('luar_radius_tolak');
    } else {
      setLayar('luar_radius_tanda');
    }
  }

  async function setelahFoto(blob: Blob) {
    if (!titikDipilih || !posisi || !tipeAktif || !userId) return;
    setLayar('mengirim');

    const status = statusDariJarak(titikDipilih.jarakMeter, titikDipilih.radiusMeter);
    const terlambatMenit =
      tipeAktif === 'masuk' ? hitungTerlambatMenit(titikDipilih.jamMasuk ?? jamMasukDefault, jamWIB(), toleransiMenit) : null;

    try {
      await kirimAbsen.mutateAsync({
        tipe: tipeAktif,
        lokasiAbsenId: titikDipilih.id,
        lat: posisi.lat,
        lon: posisi.lon,
        akurasi: posisi.akurasi,
        jarak: titikDipilih.jarakMeter,
        status,
        terlambatMenit,
        fotoBlob: blob,
      });
      hapusAbsenPending();
      setHasilBerhasil({
        label: `${jamWIB()} · ${titikDipilih.nama}${terlambatMenit ? ` · terlambat ${terlambatMenit} menit` : tipeAktif === 'masuk' ? ' · tepat waktu' : ''}`,
        keteranganLuarRadius: status === 'di_luar_radius',
      });
      setLayar('berhasil');
      muatUlangAbsenHariIni();
    } catch (err) {
      // "Jangan blokir kalau sudah terlanjur di kamera" -- simpan, jangan buang.
      const fotoBase64 = await blobKeBase64(blob);
      const draft: AbsenPending = {
        userId,
        tanggal: tanggalWIB(),
        tipe: tipeAktif,
        lokasiAbsenId: titikDipilih.id,
        lokasiNama: titikDipilih.nama,
        lat: posisi.lat,
        lon: posisi.lon,
        akurasi: posisi.akurasi,
        jarak: titikDipilih.jarakMeter,
        status,
        terlambatMenit,
        fotoBase64,
        fotoMime: 'image/jpeg',
      };
      simpanAbsenPending(draft);
      setDraftPending(draft);
      setPesanError(err instanceof Error ? err.message : 'Gagal mengirim.');
      setLayar('belum_terkirim');
    }
  }

  async function cobaKirimUlang() {
    if (!draftPending || !userId) return;
    setLayar('mengirim');
    try {
      const blob = base64KeBlob(draftPending.fotoBase64);
      await kirimAbsen.mutateAsync({
        tipe: draftPending.tipe,
        lokasiAbsenId: draftPending.lokasiAbsenId,
        lat: draftPending.lat,
        lon: draftPending.lon,
        akurasi: draftPending.akurasi,
        jarak: draftPending.jarak,
        status: draftPending.status,
        terlambatMenit: draftPending.terlambatMenit,
        fotoBlob: blob,
      });
      hapusAbsenPending();
      setDraftPending(null);
      setHasilBerhasil({
        label: `${draftPending.lokasiNama}${draftPending.terlambatMenit ? ` · terlambat ${draftPending.terlambatMenit} menit` : ''}`,
        keteranganLuarRadius: draftPending.status === 'di_luar_radius',
      });
      setLayar('berhasil');
      muatUlangAbsenHariIni();
    } catch (err) {
      setPesanError(err instanceof Error ? err.message : 'Gagal mengirim. Coba lagi.');
      setLayar('belum_terkirim');
    }
  }

  function batalDraft() {
    hapusAbsenPending();
    setDraftPending(null);
    setPesanError(null);
    setLayar('ringkasan');
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-angka-besar)', lineHeight: 1.2, color: 'var(--biru)' }}>
        Absen
      </h1>
      {profile?.divisi && (
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          {profile.divisi}
        </p>
      )}

      {layar === 'ringkasan' && (
        <div className="flex flex-col gap-3">
          <BarisAbsen label="Masuk" data={sudahMasuk} onTekan={() => mulaiAbsen('masuk')} />
          <BarisAbsen label="Pulang" data={sudahPulang} onTekan={() => mulaiAbsen('pulang')} />
        </div>
      )}

      {layar === 'tidak_ada_titik' && (
        <div className="kartu-status rail-merah">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--merah)' }}>Tidak ada titik absen</p>
          <p className="text-sm" style={{ color: 'var(--label)' }}>Kamu belum punya titik absen yang ditugaskan. Hubungi Admin.</p>
        </div>
      )}

      {layar === 'mencari_lokasi' && <p>Mencari lokasimu…</p>}

      {layar === 'gps_ditolak' && (
        <div className="kartu-status rail-merah flex flex-col gap-2">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--merah)' }}>Izin lokasi ditolak</p>
          <p className="text-sm">Butuh izin lokasi untuk absen. Buka Pengaturan → Situs → izinkan Lokasi, lalu coba lagi.</p>
          <button type="button" onClick={() => tipeAktif && mulaiAbsen(tipeAktif)} className="tombol-utama" style={{ alignSelf: 'flex-start' }}>
            Coba Lagi
          </button>
        </div>
      )}

      {layar === 'gps_gagal' && (
        <div className="kartu-status rail-merah flex flex-col gap-2">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--merah)' }}>GPS tidak tersedia</p>
          <p className="text-sm">Periksa GPS HP kamu aktif, lalu coba lagi.</p>
          <button type="button" onClick={() => tipeAktif && mulaiAbsen(tipeAktif)} className="tombol-utama" style={{ alignSelf: 'flex-start' }}>
            Coba Lagi
          </button>
        </div>
      )}

      {layar === 'gps_lemah' && (
        <div className="kartu-status rail-kuning flex flex-col gap-2">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--kuning)' }}>Sinyal GPS lemah</p>
          <p className="text-sm">Akurasi ±{Math.round(akurasiTerakhir ?? 0)} meter. Coba keluar ruangan atau dekat jendela, lalu ulangi.</p>
          <button type="button" onClick={() => tipeAktif && mulaiAbsen(tipeAktif)} className="tombol-utama" style={{ alignSelf: 'flex-start' }}>
            Coba Lagi
          </button>
        </div>
      )}

      {layar === 'konfirmasi_titik' && titikDipilih && (
        <div className="flex flex-col gap-3">
          <div className="kartu-status rail-biru">
            <p className="judul-bagian">{titikDipilih.nama}</p>
            <p className="text-sm mt-1" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>{Math.round(titikDipilih.jarakMeter)} meter dari lokasi Anda</p>
          </div>
          <div className="flex gap-2">
            {titikTerurut.length > 1 && (
              <button type="button" onClick={() => setLayar('pilih_titik')} className="tombol-sekunder">
                Ganti
              </button>
            )}
            <button type="button" onClick={lanjutkanSetelahKonfirmasi} className="tombol-utama flex-1">
              Lanjutkan
            </button>
          </div>
        </div>
      )}

      {layar === 'pilih_titik' && (
        <div className="flex flex-col gap-2">
          {titikTerurut.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTitikDipilih(t);
                setLayar('konfirmasi_titik');
              }}
              className="kartu-status rail-netral flex items-center justify-between text-left"
            >
              <span style={{ fontFamily: 'var(--display)', fontWeight: 500 }}>{t.nama}</span>
              <span className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>{Math.round(t.jarakMeter)} m</span>
            </button>
          ))}
        </div>
      )}

      {layar === 'luar_radius_tolak' && titikDipilih && (
        <div className="kartu-status rail-merah flex flex-col gap-3">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--merah)' }}>Di luar jangkauan</p>
          <p className="text-sm">
            Kamu {Math.round(titikDipilih.jarakMeter)} meter dari {titikDipilih.nama} (radius {titikDipilih.radiusMeter} meter). Absen cuma
            bisa dilakukan di lokasi penugasan. Kalau kamu yakin ini keliru, hubungi HRD.
          </p>
          <button type="button" onClick={() => setLayar('konfirmasi_titik')} className="tombol-sekunder" style={{ alignSelf: 'flex-start' }}>
            Coba Lagi
          </button>
        </div>
      )}

      {layar === 'luar_radius_tanda' && titikDipilih && (
        <div className="kartu-status rail-kuning flex flex-col gap-3">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--kuning)' }}>Di luar jangkauan</p>
          <p className="text-sm">
            Kamu {Math.round(titikDipilih.jarakMeter)} meter dari {titikDipilih.nama}. Absen tetap bisa dilakukan, tapi
            akan ditandai untuk diperiksa HRD.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setLayar('konfirmasi_titik')} className="tombol-sekunder">
              Batal
            </button>
            <button type="button" onClick={() => setLayar('kamera')} className="tombol-utama flex-1">
              Lanjutkan Absen
            </button>
          </div>
        </div>
      )}

      {layar === 'kamera' && (
        <CameraCapture
          onGunakan={setelahFoto}
          onBatal={() => setLayar('konfirmasi_titik')}
          watermark={
            titikDipilih && posisi
              ? { nama: profile?.nama ?? '', titikNama: titikDipilih.nama, lat: posisi.lat, lon: posisi.lon }
              : undefined
          }
        />
      )}

      {layar === 'mengirim' && <p>Mengirim…</p>}

      {layar === 'belum_terkirim' && draftPending && (
        <div className="kartu-status rail-kuning flex flex-col gap-3">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--kuning)' }}>Belum terkirim</p>
          {pesanError && (
            <p className="text-sm" style={{ color: 'var(--merah)' }}>
              {pesanError}
            </p>
          )}
          <p className="text-sm" style={{ color: 'var(--label)' }}>
            {draftPending.tipe === 'masuk' ? 'Absen masuk' : 'Absen pulang'} · {draftPending.lokasiNama} · {Math.round(draftPending.jarak)} meter
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={batalDraft} className="tombol-sekunder">
              Batal, mulai ulang
            </button>
            <button type="button" onClick={cobaKirimUlang} className="tombol-utama flex-1">
              Coba Kirim Lagi
            </button>
          </div>
        </div>
      )}

      {layar === 'berhasil' && hasilBerhasil && (
        <div className={`kartu-status ${hasilBerhasil.keteranganLuarRadius ? 'rail-kuning' : 'rail-hijau'} flex flex-col gap-3`}>
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: hasilBerhasil.keteranganLuarRadius ? 'var(--kuning)' : 'var(--hijau)' }}>
            Absen {tipeAktif} berhasil
          </p>
          <p className="text-sm" style={{ color: 'var(--label)' }}>
            {hasilBerhasil.label}
            {hasilBerhasil.keteranganLuarRadius ? ' — di luar radius, akan diperiksa HRD.' : ''}
          </p>
          <button type="button" onClick={() => setLayar('ringkasan')} className="tombol-sekunder" style={{ alignSelf: 'flex-start' }}>
            Kembali
          </button>
        </div>
      )}
    </main>
  );
}

function BarisAbsen({
  label,
  data,
  onTekan,
}: {
  label: string;
  data: { waktu: string; status: string; jarakMeter: number | null } | undefined;
  onTekan: () => void;
}) {
  if (data) {
    const jam = new Date(data.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const luarRadius = data.status === 'di_luar_radius';
    return (
      <div className={`kartu-status ${luarRadius ? 'rail-kuning' : 'rail-hijau'}`}>
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>Absen {label.toLowerCase()}</p>
        <p className="text-sm">
          <span style={{ fontFamily: 'var(--mono)' }}>{jam}</span>
          {' · '}
          <span className="status-teks" style={{ color: luarRadius ? 'var(--kuning)' : 'var(--hijau)' }}>
            {luarRadius ? 'Di luar radius' : 'Dalam radius'}
          </span>
        </p>
      </div>
    );
  }
  return (
    <button type="button" onClick={onTekan} className="tombol-utama w-full text-left">
      Absen {label}
    </button>
  );
}

/**
 * Muncul sekali per akun, sebelum halaman Absen terbuka pertama kali
 * (instruksi eksplisit user, 30 Agustus 2026 -- UU PDP: orang harus tahu
 * data apa yang direkam SEBELUM perekamannya mulai). Tombol "Saya mengerti
 * dan setuju" memanggil RPC `setujui_privasi_presensi()` -- waktunya
 * dihitung SERVER (`now()`), bukan dipercaya dari klien, supaya catatan
 * persetujuan ini kuat sebagai bukti. Tersimpan sekali seumur akun (RPC
 * idempoten lewat `where ... is null`).
 */
function PersetujuanPrivasi({
  onSetuju,
  sedangMenyimpan,
  error,
}: {
  onSetuju: () => Promise<void>;
  sedangMenyimpan: boolean;
  error: string | null;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
        Sebelum Anda Absen
      </h1>
      <div className="flex flex-col gap-3 border p-4 text-sm" style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)' }}>
        <p>
          <b style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>Apa yang direkam:</b> titik lokasi Anda, foto wajah, dan jam --
          <b> hanya SAAT Anda menekan tombol absen</b>, bukan pelacakan sepanjang hari. Di luar momen itu, lokasi Anda tidak direkam sama sekali.
        </p>
        <p>
          <b style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>Untuk apa:</b> rekap kehadiran (hadir, terlambat, lokasi dalam/luar radius penugasan Anda).
        </p>
        <p>
          <b style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>Berapa lama disimpan:</b> foto disimpan 90 hari lalu dihapus. Catatan kehadiran (waktu, lokasi, status) tetap disimpan.
        </p>
        <p>
          <b style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>Siapa yang bisa melihat:</b> HRD dan CEO.
        </p>
      </div>
      {error && (
        <p className="text-sm" style={{ color: 'var(--merah)' }}>
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={sedangMenyimpan}
        onClick={() => void onSetuju()}
        className="tombol-utama"
        style={{ borderRadius: 'var(--radius-pil)' }}
      >
        {sedangMenyimpan ? 'Menyimpan…' : 'Saya mengerti dan setuju'}
      </button>
    </main>
  );
}
