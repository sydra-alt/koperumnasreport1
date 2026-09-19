'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { usePolicy } from '../../lib/api/policy';
import { useTitikAbsenSaya, useAbsenHariIni, useKirimAbsen, useSetujuiPrivasiPresensi } from '../../lib/api/absensi';
import { urutkanTitikTerdekat, statusDariJarak, type TitikDenganJarak } from '../../lib/absen';
import { jamWIB, tanggalIndonesiaWIB, tanggalWIB } from '../../lib/tanggal';
import { pesanKesalahanDb } from '../../lib/pesanErrorDb';
import { CameraCapture } from '../../components/CameraCapture';
import { KerangkaAbsen } from '../../components/Kerangka';
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



/** Akhiran label hasil absen dari nilai SERVER: >0 terlambat, 0 tepat waktu, null (pulang / hari non-kerja / cuti) tidak ada keterangan. */
function labelTerlambat(tipe: 'masuk' | 'pulang', terlambatMenit: number | null): string {
  if (tipe !== 'masuk' || terlambatMenit === null) return '';
  return terlambatMenit > 0 ? ` · terlambat ${terlambatMenit} menit` : ' · tepat waktu';
}

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
    return <main className={KELAS_HALAMAN}><KerangkaAbsen /></main>;
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

    try {
      // Keterlambatan dihitung SERVER (trigger, migrasi 0059) -- yang
      // ditampilkan di bawah adalah nilai yang dikembalikan server.
      const { terlambatMenit, status: statusServer } = await kirimAbsen.mutateAsync({
        tipe: tipeAktif,
        lokasiAbsenId: titikDipilih.id,
        lat: posisi.lat,
        lon: posisi.lon,
        akurasi: posisi.akurasi,
        jarak: titikDipilih.jarakMeter,
        status,
        fotoBlob: blob,
      });
      hapusAbsenPending();
      setHasilBerhasil({
        label: `${jamWIB()} · ${titikDipilih.nama}${labelTerlambat(tipeAktif, terlambatMenit)}`,
        keteranganLuarRadius: statusServer === 'di_luar_radius',
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
        fotoBase64,
        fotoMime: 'image/jpeg',
      };
      simpanAbsenPending(draft);
      setDraftPending(draft);
      setPesanError(pesanGalatAbsen(err));
      setLayar('belum_terkirim');
    }
  }

  async function cobaKirimUlang() {
    if (!draftPending || !userId) return;
    setLayar('mengirim');
    try {
      const blob = base64KeBlob(draftPending.fotoBase64);
      const { terlambatMenit, status: statusServer } = await kirimAbsen.mutateAsync({
        tipe: draftPending.tipe,
        lokasiAbsenId: draftPending.lokasiAbsenId,
        lat: draftPending.lat,
        lon: draftPending.lon,
        akurasi: draftPending.akurasi,
        jarak: draftPending.jarak,
        status: draftPending.status,
        fotoBlob: blob,
      });
      hapusAbsenPending();
      setDraftPending(null);
      setHasilBerhasil({
        label: `${draftPending.lokasiNama}${labelTerlambat(draftPending.tipe, terlambatMenit)}`,
        keteranganLuarRadius: statusServer === 'di_luar_radius',
      });
      setLayar('berhasil');
      muatUlangAbsenHariIni();
    } catch (err) {
      setPesanError(pesanGalatAbsen(err));
      setLayar('belum_terkirim');
    }
  }

  function batalDraft() {
    hapusAbsenPending();
    setDraftPending(null);
    setPesanError(null);
    setLayar('ringkasan');
  }

  const label = tipeAktif === 'masuk' ? 'Absen masuk' : tipeAktif === 'pulang' ? 'Absen pulang' : null;
  const luarRadiusDipilih = titikDipilih ? statusDariJarak(titikDipilih.jarakMeter, titikDipilih.radiusMeter) !== 'valid' : false;

  return (
    <main className={KELAS_HALAMAN}>
      <h1 className="sapaan">Absen</h1>

      {layar === 'ringkasan' && (
        <section className="panel">
          <div className="panel-baris">
            <p className="judul-seksi" suppressHydrationWarning>{tanggalIndonesiaWIB()}</p>
            {(profile?.nama || profile?.divisi) && (
              <p className="text-sm" style={{ color: 'var(--label)' }}>
                {[profile?.nama, profile?.divisi].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="panel-baris flex flex-col gap-2">
            <p style={{ fontSize: 12, color: 'var(--label)' }}>Titik absen</p>
            {titikSaya && titikSaya.length > 0 ? (
              titikSaya.map((t) => (
                <div key={t.id}>
                  <p style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 15, lineHeight: 1.3 }}>{t.nama}</p>
                  {(t.jamMasuk || t.jamPulang) && (
                    <p className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>
                      {[t.jamMasuk ? `Masuk ${String(t.jamMasuk).slice(0, 5)}` : null, t.jamPulang ? `Pulang ${String(t.jamPulang).slice(0, 5)}` : null].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm" style={{ color: 'var(--kosong)' }}>Belum ada titik absen yang ditugaskan.</p>
            )}
          </div>
          <BarisAbsen label="Masuk" data={sudahMasuk} onTekan={() => mulaiAbsen('masuk')} utama />
          <BarisAbsen label="Pulang" data={sudahPulang} onTekan={() => mulaiAbsen('pulang')} utama={Boolean(sudahMasuk)} />
        </section>
      )}

      {layar === 'tidak_ada_titik' && (
        <PanelPesan status="merah" konteks={label} judul="Tidak ada titik absen">
          <p className="text-sm" style={{ color: 'var(--label)' }}>Kamu belum punya titik absen yang ditugaskan. Hubungi Admin.</p>
        </PanelPesan>
      )}

      {layar === 'mencari_lokasi' && <PanelTunggu konteks={label} judul="Mencari lokasimu…" keterangan="Biarkan halaman ini tetap terbuka." />}

      {layar === 'gps_ditolak' && (
        <PanelPesan status="merah" konteks={label} judul="Izin lokasi ditolak">
          <p className="text-sm">Butuh izin lokasi untuk absen. Buka Pengaturan → Situs → izinkan Lokasi, lalu coba lagi.</p>
          <button type="button" onClick={() => tipeAktif && mulaiAbsen(tipeAktif)} className="tombol-utama w-full">
            Coba Lagi
          </button>
        </PanelPesan>
      )}

      {layar === 'gps_gagal' && (
        <PanelPesan status="merah" konteks={label} judul="GPS tidak tersedia">
          <p className="text-sm">Periksa GPS HP kamu aktif, lalu coba lagi.</p>
          <button type="button" onClick={() => tipeAktif && mulaiAbsen(tipeAktif)} className="tombol-utama w-full">
            Coba Lagi
          </button>
        </PanelPesan>
      )}

      {layar === 'gps_lemah' && (
        <PanelPesan status="kuning" konteks={label} judul="Sinyal GPS lemah">
          <p className="text-sm">Akurasi ±{Math.round(akurasiTerakhir ?? 0)} meter. Coba keluar ruangan atau dekat jendela, lalu ulangi.</p>
          <button type="button" onClick={() => tipeAktif && mulaiAbsen(tipeAktif)} className="tombol-utama w-full">
            Coba Lagi
          </button>
        </PanelPesan>
      )}

      {layar === 'konfirmasi_titik' && titikDipilih && (
        <section className="panel">
          <div className="panel-baris status-biru">
            {label && <p style={{ fontSize: 12, color: 'var(--label)' }}>{label} · titik terdekat</p>}
            <p className="judul-seksi">{titikDipilih.nama}</p>
            <p className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>{Math.round(titikDipilih.jarakMeter)} meter dari lokasi Anda</p>
          </div>
          <div className="panel-baris flex items-baseline justify-between gap-3">
            <span className="text-sm" style={{ color: 'var(--label)' }}>Radius titik {titikDipilih.radiusMeter} meter</span>
            <span className="status-teks" style={{ color: luarRadiusDipilih ? 'var(--kuning)' : 'var(--hijau)' }}>
              {luarRadiusDipilih ? 'Di luar radius' : 'Dalam radius'}
            </span>
          </div>
          {posisi && (
            <div className="panel-baris">
              <span className="text-sm" style={{ color: 'var(--label)' }}>Akurasi GPS ±{Math.round(posisi.akurasi)} meter</span>
            </div>
          )}
          <div className="panel-baris flex gap-2">
            {titikTerurut.length > 1 && (
              <button type="button" onClick={() => setLayar('pilih_titik')} className="tombol-sekunder" style={{ minWidth: 88 }}>
                Ganti
              </button>
            )}
            <button type="button" onClick={lanjutkanSetelahKonfirmasi} className="tombol-utama flex-1">
              Lanjutkan
            </button>
          </div>
        </section>
      )}

      {layar === 'pilih_titik' && (
        <section className="panel">
          <div className="panel-baris">
            <p className="judul-seksi">Pilih titik absen</p>
          </div>
          {titikTerurut.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTitikDipilih(t);
                setLayar('konfirmasi_titik');
              }}
              className="panel-baris flex w-full items-center justify-between gap-3 text-left"
              style={{ minHeight: 56, borderRadius: 0 }}
            >
              <span style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{t.nama}</span>
              <span className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>{Math.round(t.jarakMeter)} m</span>
            </button>
          ))}
          <div className="panel-baris">
            <button type="button" onClick={() => setLayar('konfirmasi_titik')} className="tombol-sekunder w-full">
              Kembali
            </button>
          </div>
        </section>
      )}

      {layar === 'luar_radius_tolak' && titikDipilih && (
        <PanelPesan status="merah" konteks={label} judul="Di luar jangkauan">
          <p className="text-sm">
            Kamu {Math.round(titikDipilih.jarakMeter)} meter dari {titikDipilih.nama} (radius {titikDipilih.radiusMeter} meter). Absen cuma
            bisa dilakukan di lokasi penugasan. Kalau kamu yakin ini keliru, hubungi HRD.
          </p>
          <button type="button" onClick={() => setLayar('konfirmasi_titik')} className="tombol-sekunder w-full">
            Coba Lagi
          </button>
        </PanelPesan>
      )}

      {layar === 'luar_radius_tanda' && titikDipilih && (
        <PanelPesan status="kuning" konteks={label} judul="Di luar jangkauan">
          <p className="text-sm">
            Kamu {Math.round(titikDipilih.jarakMeter)} meter dari {titikDipilih.nama}. Absen tetap bisa dilakukan, tapi
            akan ditandai untuk diperiksa HRD.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setLayar('konfirmasi_titik')} className="tombol-sekunder" style={{ minWidth: 88 }}>
              Batal
            </button>
            <button type="button" onClick={() => setLayar('kamera')} className="tombol-utama flex-1">
              Lanjutkan Absen
            </button>
          </div>
        </PanelPesan>
      )}

      {layar === 'kamera' && (
        <CameraCapture
          onGunakan={setelahFoto}
          onBatal={() => setLayar('konfirmasi_titik')}
          facingMode="user"
          watermark={
            titikDipilih && posisi
              ? {
                  baris1: `${profile?.nama ?? ''} · ${jamWIB()} WIB`,
                  baris2: `${titikDipilih.nama} · ${posisi.lat.toFixed(6)}, ${posisi.lon.toFixed(6)}`,
                }
              : undefined
          }
        />
      )}

      {layar === 'mengirim' && <PanelTunggu konteks={label} judul="Mengirim…" keterangan="Jangan tutup halaman sampai selesai." />}

      {layar === 'belum_terkirim' && draftPending && (
        <PanelPesan status="kuning" konteks={null} judul="Belum terkirim">
          {pesanError && (
            <p className="text-sm" style={{ color: 'var(--merah)' }}>
              {pesanError}
            </p>
          )}
          <p className="text-sm" style={{ color: 'var(--label)' }}>
            {draftPending.tipe === 'masuk' ? 'Absen masuk' : 'Absen pulang'} · {draftPending.lokasiNama} · {Math.round(draftPending.jarak)} meter
          </p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={cobaKirimUlang} className="tombol-utama w-full">
              Coba Kirim Lagi
            </button>
            <button type="button" onClick={batalDraft} className="tombol-sekunder w-full">
              Batal, mulai ulang
            </button>
          </div>
        </PanelPesan>
      )}

      {layar === 'berhasil' && hasilBerhasil && (
        <PanelPesan status={hasilBerhasil.keteranganLuarRadius ? 'kuning' : 'hijau'} konteks={null} judul={`Absen ${tipeAktif} berhasil`}>
          <p className="text-sm" style={{ color: 'var(--label)' }}>
            {hasilBerhasil.label}
            {hasilBerhasil.keteranganLuarRadius ? ' — di luar radius, akan diperiksa HRD.' : ''}
          </p>
          <button type="button" onClick={() => setLayar('ringkasan')} className="tombol-sekunder w-full">
            Kembali
          </button>
        </PanelPesan>
      )}
    </main>
  );
}

/**
 * Teks galat yang ditampilkan di layar "Belum terkirim" -- memakai pemetaan yang SUDAH ada
 * (lib/pesanErrorDb.ts). `new TypeError()` (pesan kosong) dipakai untuk kegagalan jaringan
 * ("Failed to fetch") supaya cabang TypeError di pemetaan itu terpakai -- kalau pesan aslinya
 * diteruskan, pemetaan menganggapnya sudah manusiawi dan menampilkannya mentah.
 * HANYA teks yang berubah; penanganan galat (draft lokal, retry) tidak disentuh.
 */
function pesanGalatAbsen(err: unknown): string {
  return pesanKesalahanDb(err instanceof TypeError ? new TypeError() : err, 'mengirim absen');
}

/** Kelas halaman satu-tugas: kolom ~448px di tengah, gutter px-4 (sama dengan halaman yang sudah di-redesign). */
const KELAS_HALAMAN = 'mx-auto flex w-full max-w-md flex-col gap-3 px-4 py-5 md:gap-4 md:py-8';

const WARNA_STATUS_PESAN = { merah: 'var(--merah)', kuning: 'var(--kuning)', hijau: 'var(--hijau)' } as const;

/** Panel pesan/status: satu `.panel` datar, rail inset berwarna, judul berwarna status, isi + tombol di dalamnya (bukan kartu bersarang). */
function PanelPesan({
  status,
  konteks,
  judul,
  children,
}: {
  status: 'merah' | 'kuning' | 'hijau';
  konteks: string | null;
  judul: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className={`panel-baris status-${status} flex flex-col gap-2`} style={{ padding: 16 }}>
        {konteks && <p style={{ fontSize: 12, color: 'var(--label)' }}>{konteks}</p>}
        <p style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16, color: WARNA_STATUS_PESAN[status] }}>{judul}</p>
        {children}
      </div>
    </section>
  );
}

/** Panel tunggu (mencari lokasi / mengirim): judul + bilah kerangka beranimasi (pola kerangka yang sudah ada, tanpa pemutar/spinner) + keterangan. */
function PanelTunggu({ konteks, judul, keterangan }: { konteks: string | null; judul: string; keterangan: string }) {
  return (
    <section className="panel" role="status" aria-live="polite">
      <div className="panel-baris status-biru flex flex-col gap-3" style={{ padding: 16 }}>
        {konteks && <p style={{ fontSize: 12, color: 'var(--label)' }}>{konteks}</p>}
        <p className="judul-seksi">{judul}</p>
        <div className="progres-bar" aria-hidden="true">
          <div
            style={{
              height: '100%',
              width: '100%',
              borderRadius: 999,
              background: 'linear-gradient(90deg, var(--garis) 25%, var(--biru) 37%, var(--garis) 63%)',
              backgroundSize: '400% 100%',
              animation: 'kerangka-geser 1.4s ease infinite',
            }}
          />
        </div>
        <p className="text-sm" style={{ color: 'var(--label)' }}>{keterangan}</p>
      </div>
    </section>
  );
}

function BarisAbsen({
  label,
  data,
  onTekan,
  utama,
}: {
  label: string;
  data: { waktu: string; status: string; jarakMeter: number | null; terlambatMenit?: number | null } | undefined;
  onTekan: () => void;
  utama: boolean;
}) {
  const tipe = label.toLowerCase() as 'masuk' | 'pulang';
  if (data) {
    const jam = new Date(data.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const luarRadius = data.status === 'di_luar_radius';
    return (
      <div className={`panel-baris ${luarRadius ? 'status-kuning' : 'status-hijau'}`} style={{ minHeight: 64 }}>
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>Absen {tipe}</p>
        <p className="text-sm">
          <span style={{ fontFamily: 'var(--mono)' }}>{jam}</span>
          {' · '}
          <span className="status-teks" style={{ color: luarRadius ? 'var(--kuning)' : 'var(--hijau)' }}>
            {luarRadius ? 'Di luar radius' : 'Dalam radius'}
          </span>
          <span style={{ color: 'var(--label)' }}>{labelTerlambat(tipe, data.terlambatMenit ?? null)}</span>
        </p>
      </div>
    );
  }
  return (
    <div className="panel-baris flex items-center justify-between gap-3" style={{ minHeight: 64 }}>
      <div>
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>Absen {tipe}</p>
        <p className="status-teks" style={{ color: 'var(--kosong)' }}>Belum absen</p>
      </div>
      <button
        type="button"
        onClick={onTekan}
        className={utama ? 'tombol-utama' : 'tombol-sekunder'}
        style={{ flexShrink: 0, minWidth: 132, minHeight: 44, padding: '8px 16px' }}
      >
        Absen {label}
      </button>
    </div>
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
 *
 * Tampilan: satu `.panel`, empat baris label + isi (isi kalimat tidak diubah).
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
  const baris: { judul: string; isi: React.ReactNode }[] = [
    {
      judul: 'Apa yang direkam',
      isi: (
        <>
          titik lokasi Anda, foto wajah, dan jam -- <b>hanya SAAT Anda menekan tombol absen</b>, bukan pelacakan sepanjang hari. Di luar momen itu, lokasi
          Anda tidak direkam sama sekali.
        </>
      ),
    },
    { judul: 'Untuk apa', isi: 'rekap kehadiran (hadir, terlambat, lokasi dalam/luar radius penugasan Anda).' },
    { judul: 'Berapa lama disimpan', isi: 'foto disimpan 90 hari lalu dihapus. Catatan kehadiran (waktu, lokasi, status) tetap disimpan.' },
    { judul: 'Siapa yang bisa melihat', isi: 'HRD dan CEO.' },
  ];
  return (
    <main className={KELAS_HALAMAN}>
      <h1 className="sapaan">Sebelum Anda Absen</h1>
      <section className="panel">
        {baris.map((b) => (
          <div key={b.judul} className="panel-baris flex flex-col gap-1">
            <p style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, color: 'var(--biru)' }}>{b.judul}</p>
            <p className="text-sm" style={{ lineHeight: 1.5 }}>{b.isi}</p>
          </div>
        ))}
      </section>
      {error && (
        <p className="text-sm" style={{ color: 'var(--merah)' }}>
          {error}
        </p>
      )}
      <button type="button" disabled={sedangMenyimpan} onClick={() => void onSetuju()} className="tombol-utama w-full">
        {sedangMenyimpan ? 'Menyimpan…' : 'Saya mengerti dan setuju'}
      </button>
    </main>
  );
}
