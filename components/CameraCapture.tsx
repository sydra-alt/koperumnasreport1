'use client';

import { useEffect, useRef, useState } from 'react';
import { kompresGambar } from '../lib/gambar';

type Status = 'meminta' | 'siap' | 'ditolak' | 'gagal' | 'tidak_didukung' | 'preview';

/**
 * Digeneralisasi (6 September 2026) supaya bisa dipakai ulang Laporan
 * Kebersihan, bukan cuma Absen -- dulu bentuknya tetap {nama, titikNama,
 * lat, lon} khusus absen. Sekarang pemanggil yang menyusun teksnya sendiri
 * (baris1 = besar/tebal, baris2 = kecil, opsional) -- absen menulis "nama ·
 * jam WIB" / "titik · koordinat", kebersihan menulis "outlet · jam WIB" /
 * "nama slot". Fungsi ini cuma tahu cara MENGGAMBARnya, bukan APA isinya.
 */
export interface WatermarkOpsi {
  baris1: string;
  baris2?: string;
}

interface CameraCaptureProps {
  onGunakan: (blob: Blob) => void;
  onBatal: () => void;
  /** Kalau diisi, dibubuhkan ke foto sebagai watermark (instruksi eksplisit user, 30 Agustus 2026). */
  watermark?: WatermarkOpsi;
  /**
   * WAJIB diisi eksplisit oleh pemanggil (BUKAN default diam-diam) --
   * instruksi eksplisit user, 10 September 2026, setelah Laporan
   * Kebersihan (dipakai di HP sungguhan) ternyata terkunci ke kamera
   * DEPAN: foto kebersihan memotret meja/toilet/bar, bukan wajah, dan
   * kamera depan kualitasnya lebih rendah + sudutnya sempit. Absen tetap
   * 'user' (perlu wajah utk verifikasi), Kebersihan 'environment'.
   * Komponen ini dipakai lebih dari satu fitur -- mewajibkan prop ini
   * (bukan default) supaya fitur BERIKUTNYA yang memakainya juga harus
   * sadar memilih, bukan diam-diam mewarisi default yang salah.
   */
  facingMode: 'user' | 'environment';
}

let logoWatermarkCache: HTMLImageElement | null = null;
function muatLogoWatermark(): Promise<HTMLImageElement> {
  if (logoWatermarkCache) return Promise.resolve(logoWatermarkCache);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      logoWatermarkCache = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = '/logo-koperumnas.jpg';
  });
}

/**
 * Potong teks yang lebih lebar dari `lebarMaks` (px, di font `ctx` yang
 * SUDAH di-set sebelum dipanggil) jadi "...", supaya nama titik panjang
 * (mis. "Lokasi Uji -- BUKAN kantor perusahaan, cuma untuk coba dari HP")
 * tidak meluber terpotong mentah di luar tepi foto (laporan user, 31
 * Agustus 2026: "jangan terlihat rusak").
 */
function potongTeks(ctx: CanvasRenderingContext2D, teks: string, lebarMaks: number): string {
  if (ctx.measureText(teks).width <= lebarMaks) return teks;
  let potongan = teks;
  while (potongan.length > 1 && ctx.measureText(`${potongan}…`).width > lebarMaks) {
    potongan = potongan.slice(0, -1);
  }
  return `${potongan}…`;
}

/** Bar semi-transparan di bawah foto: logo kecil + baris1 (besar/tebal) + baris2 (kecil, opsional). Gagal muat logo TIDAK boleh menggagalkan pengiriman -- teks tetap dibubuhkan. */
async function bubuhkanWatermark(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, w: WatermarkOpsi) {
  const tinggiBar = Math.round(canvas.height * 0.16);
  const y0 = canvas.height - tinggiBar;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, y0, canvas.width, tinggiBar);

  const paddingKiri = Math.round(canvas.width * 0.03);
  let xTeks = paddingKiri;

  try {
    const logo = await muatLogoWatermark();
    const tinggiLogo = Math.round(tinggiBar * 0.62);
    const lebarLogo = Math.round((logo.width / logo.height) * tinggiLogo);
    const yLogo = y0 + Math.round((tinggiBar - tinggiLogo) / 2);
    // latar putih solid di belakang logo -- kontras di atas overlay gelap
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(paddingKiri, yLogo, lebarLogo, tinggiLogo);
    ctx.drawImage(logo, paddingKiri, yLogo, lebarLogo, tinggiLogo);
    xTeks = paddingKiri + lebarLogo + Math.round(canvas.width * 0.025);
  } catch {
    // logo gagal dimuat -- lanjut tanpa logo, teks watermark tetap tampil.
  }

  const ukuranFontBesar = Math.max(14, Math.round(canvas.width * 0.042));
  const ukuranFontKecil = Math.max(11, Math.round(canvas.width * 0.032));
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';

  const lebarTeksTersedia = canvas.width - xTeks - paddingKiri;

  ctx.font = `700 ${ukuranFontBesar}px sans-serif`;
  ctx.fillText(potongTeks(ctx, w.baris1, lebarTeksTersedia), xTeks, y0 + tinggiBar * (w.baris2 ? 0.35 : 0.5));

  if (w.baris2) {
    ctx.font = `400 ${ukuranFontKecil}px sans-serif`;
    ctx.fillText(potongTeks(ctx, w.baris2, lebarTeksTersedia), xTeks, y0 + tinggiBar * 0.72);
  }
}

/**
 * Kamera sungguhan lewat `getUserMedia({facingMode})` (§3.4
 * 06-RENCANA-PRESENSI-MOBILE.md) -- BUKAN `<input type=file capture>` seperti
 * `LampiranInput.tsx` (Task 11). Beda sengaja: kedua fitur yang memakai
 * komponen ini butuh JAMINAN kamera TERTENTU (bukan galeri) -- absen kamera
 * depan untuk verifikasi wajah, Kebersihan kamera belakang untuk memotret
 * ruangan -- atribut `capture` pada input file tidak konsisten memaksa itu
 * lintas browser, `getUserMedia` + `facingMode` yang benar-benar menjaminnya.
 *
 * Konstrain `facingMode` yang dikirim SENGAJA bukan `{exact: ...}` --
 * `exact` melempar `OverconstrainedError` di perangkat yang kameranya tidak
 * mendeklarasikan facingMode sama sekali (banyak webcam desktop, termasuk
 * kamera palsu Playwright/Chromium yang dipakai skrip uji sesi ini) --
 * bisa mematahkan uji otomatis DAN perangkat sungguhan yang sebenarnya baik-
 * baik saja. Konstrain "ideal" (default, tanpa `exact`) tidak pernah gagal
 * karena ketidakcocokan -- browser diam-diam memberi kamera lain kalau yang
 * diminta tidak ada. Makanya "beri tahu kalau fallback" (instruksi eksplisit
 * user) TIDAK bisa dideteksi dari galat -- dibaca dari
 * `track.getSettings().facingMode` SETELAH stream didapat: kalau nilainya
 * diketahui (tidak semua kamera melaporkan ini) dan BEDA dari yang diminta,
 * itu tandanya browser diam-diam memberi kamera lain.
 */
export function CameraCapture({ onGunakan, onBatal, watermark, facingMode }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>('meminta');
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [facingAktif, setFacingAktif] = useState<'user' | 'environment'>(facingMode);
  const [catatanKamera, setCatatanKamera] = useState<string | null>(null);
  const [membalik, setMembalik] = useState(false);

  useEffect(() => {
    // `status` sudah berawal 'meminta' (useState di atas) -- efek ini
    // cuma jalan sekali (deps kosong), jadi tidak perlu di-set ulang di
    // sini (react-hooks/set-state-in-effect menangkap setState langsung
    // di badan efek sebagai potensi cascading render, sama pola dengan
    // yang sudah didokumentasikan di app/page.tsx Task 06).
    let batal = false;

    // BUG NYATA ditemukan 31 Agustus 2026 (laporan user langsung, "kamera
    // tidak terbuka"): `navigator.mediaDevices` bernilai undefined di
    // KONTEKS TIDAK AMAN (bukan https://, dan bukan literally "localhost")
    // -- mis. dibuka lewat IP jaringan lokal (http://192.168.x.x:3000) saat
    // dites dari HP sebelum dibagikan resmi. Memanggil
    // `.getUserMedia(...)` pada `undefined` melempar TypeError SINKRON, DI
    // LUAR promise chain -- `.catch()` di bawah TIDAK PERNAH menangkapnya,
    // jadi layar macet selamanya di "Meminta izin kamera..." tanpa pesan
    // apa pun. Dicegah dengan pengecekan eksplisit SEBELUM memanggil,
    // dengan pesan yang menjelaskan sebab paling mungkin (bukan cuma
    // "kamera gagal" generik) -- try/catch di sekeliling seluruhnya sebagai
    // jaring pengaman kedua untuk kasus lempar sinkron lain yang belum
    // ketahuan.
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        // setState dibungkus microtask -- sama pola dengan alasan yang
        // sudah didokumentasikan di app/page.tsx Task 06 (react-hooks/set-
        // state-in-effect): mencegah potensi cascading render kalau
        // dipanggil LANGSUNG di badan efek, bukan menonaktifkan aturannya.
        Promise.resolve().then(() => {
          if (!batal) setStatus('tidak_didukung');
        });
        return;
      }
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode }, audio: false })
        .then((stream) => {
          if (batal) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          // Konstrain "ideal" tidak pernah gagal karena ketidakcocokan --
          // browser diam-diam memberi kamera lain kalau yang diminta tidak
          // ada. Baca APA YANG SUNGGUH DIDAPAT dari track-nya sendiri; kalau
          // browser melaporkannya (tidak semua kamera melakukan ini) dan
          // beda dari yang diminta, beritahu di layar -- JANGAN diam-diam.
          const facingSungguhan = stream.getVideoTracks()[0]?.getSettings().facingMode;
          if (facingSungguhan && facingSungguhan !== facingMode) {
            setFacingAktif(facingSungguhan === 'environment' ? 'environment' : 'user');
            setCatatanKamera(
              facingMode === 'environment'
                ? 'Kamera belakang tidak tersedia di perangkat ini -- memakai kamera depan.'
                : 'Kamera depan tidak tersedia di perangkat ini -- memakai kamera belakang.',
            );
          }
          // BUG NYATA ditemukan 31 Agustus 2026 (laporan user langsung,
          // kotak kamera kosong TANPA galat -- BUKAN kasus http:// yang
          // sebelumnya salah diduga sebagai penyebab, user memakai https://
          // penuh). Akar masalah SEBENARNYA: `srcObject` di sini TIDAK
          // PERNAH nyangkut ke elemen -- `videoRef.current` masih `null`
          // di titik INI karena render saat ini MASIH status 'meminta'
          // (<p>Meminta izin kamera...</p>), elemen <video> belum ada di
          // DOM sama sekali. `setStatus('siap')` di bawah baru MEMASANG
          // elemen videonya untuk PERTAMA KALI, tapi tidak ada apa pun
          // sesudahnya yang menyambungkan stream ke elemen yang baru
          // dipasang itu -- kamera "berhasil" diambil (izin diberikan,
          // stream didapat) tapi tidak pernah tersambung ke layar.
          // Diperbaiki lewat efek TERPISAH di bawah yang berjalan SETELAH
          // elemen video benar-benar ter-mount (lihat efek kedua).
          setStatus('siap');
        })
        .catch((err) => {
          if (batal) return;
          setStatus(err?.name === 'NotAllowedError' ? 'ditolak' : 'gagal');
        });
    } catch {
      Promise.resolve().then(() => {
        if (!batal) setStatus('gagal');
      });
    }

    return () => {
      batal = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // `facingMode` sengaja jadi dependency (dipakai di badan efek) tapi
    // secara praktik cuma jalan sekali -- pemanggil mengirim nilai TETAP
    // per pemakaian (lihat komentar prop), tidak pernah berubah di tengah
    // satu sesi kamera terbuka.
  }, [facingMode]);

  // Efek TERPISAH, berjalan SETELAH render -- begitu `status` jadi 'siap',
  // elemen <video> SUDAH pasti ada di DOM (efek jalan setelah commit),
  // beda dari titik lama di dalam `.then()` di atas yang jalan SEBELUM
  // elemen itu pernah dipasang. Di sinilah `srcObject` SUNGGUHAN disambungkan.
  useEffect(() => {
    if (status !== 'siap' || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    // `autoplay` attribute SEHARUSNYA cukup, tapi panggilan eksplisit
    // sebagai jaring pengaman -- beberapa Chrome Android tidak selalu
    // memulai autoplay begitu srcObject dipasang lewat JS setelah mount.
    video.play().catch(() => {
      // gagal play() TIDAK fatal -- browser lain kadang menolak play()
      // terprogram tapi tetap menampilkan frame pertama lewat autoplay asli.
    });
  }, [status]);

  /**
   * Tombol "Balik Kamera" -- instruksi eksplisit user, 10 September 2026:
   * "harus mengganti stream, bukan mencerminkan gambar." Ini SUNGGUH minta
   * stream kamera fisik yang lain lewat `getUserMedia` baru, BUKAN cuma
   * membalik tampilan `<video>` lewat CSS -- foto yang diambil sesudahnya
   * benar-benar berasal dari sensor kamera yang berbeda, bukan gambar yang
   * sama dicerminkan.
   *
   * Stream LAMA baru dihentikan SETELAH stream baru berhasil didapat --
   * kalau baris ini dibalik (hentikan dulu, baru minta baru) dan permintaan
   * baru gagal, pengguna kehilangan kamera yang tadinya sudah jalan.
   */
  async function balikKamera() {
    if (!navigator.mediaDevices?.getUserMedia || membalik) return;
    const facingBaru = facingAktif === 'user' ? 'environment' : 'user';
    setMembalik(true);
    try {
      const trackLama = streamRef.current?.getVideoTracks()[0];
      const deviceIdLama = trackLama?.getSettings().deviceId;

      const streamBaru = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingBaru }, audio: false });
      const trackBaru = streamBaru.getVideoTracks()[0];
      const deviceIdBaru = trackBaru?.getSettings().deviceId;
      const facingSungguhan = trackBaru?.getSettings().facingMode;

      // Kamera fisik yang SAMA dikembalikan (device id identik, atau
      // facingMode yang dilaporkan tidak berubah) -- berarti tidak ada
      // kamera lain untuk dipindah, BUKAN kegagalan diam-diam.
      const tidakAdaKameraLain = (deviceIdLama && deviceIdBaru && deviceIdLama === deviceIdBaru) || facingSungguhan === facingAktif;

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = streamBaru;
      if (videoRef.current) {
        videoRef.current.srcObject = streamBaru;
        videoRef.current.play().catch(() => {});
      }
      setFacingAktif(facingSungguhan === 'environment' ? 'environment' : facingSungguhan === 'user' ? 'user' : facingBaru);
      setCatatanKamera(tidakAdaKameraLain ? 'Tidak ditemukan kamera lain di perangkat ini.' : null);
    } catch {
      setCatatanKamera(`Kamera ${facingBaru === 'environment' ? 'belakang' : 'depan'} tidak bisa dibuka -- tetap memakai kamera semula.`);
    } finally {
      setMembalik(false);
    }
  }

  async function ambil() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    if (watermark) await bubuhkanWatermark(ctx, canvas, watermark);
    canvas.toBlob(
      async (blobMentah) => {
        if (!blobMentah) return;
        const blob = await kompresGambar(blobMentah, 800, 0.8);
        setFotoBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus('preview');
      },
      'image/jpeg',
      0.92,
    );
  }

  function ambilUlang() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFotoBlob(null);
    setStatus('siap');
  }

  const gayaTombol = { borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 48 } as const;

  if (status === 'meminta') {
    return (
      <div className="flex flex-col gap-2">
        <p>Meminta izin kamera…</p>
      </div>
    );
  }

  if (status === 'ditolak') {
    return (
      <div className="flex flex-col gap-2">
        <p style={{ color: 'var(--merah)' }}>
          Butuh izin kamera untuk foto absen. Buka Pengaturan → Situs → izinkan Kamera, lalu coba lagi.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setStatus('meminta')} className="border px-4" style={gayaTombol}>
            Coba Lagi
          </button>
          <button type="button" onClick={onBatal} className="border px-4" style={{ borderColor: 'var(--garis)', color: 'var(--tinta)', minHeight: 48 }}>
            Batal
          </button>
        </div>
      </div>
    );
  }

  if (status === 'gagal') {
    return (
      <div className="flex flex-col gap-2">
        <p style={{ color: 'var(--merah)' }}>Kamera tidak bisa dibuka di perangkat ini. Coba lagi, atau pakai HP lain.</p>
        <button type="button" onClick={() => setStatus('meminta')} className="border px-4" style={gayaTombol}>
          Coba Lagi
        </button>
      </div>
    );
  }

  if (status === 'tidak_didukung') {
    return (
      <div className="flex flex-col gap-2">
        <p style={{ color: 'var(--merah)' }}>
          Kamera tidak bisa diakses dari alamat ini. Pastikan alamat website diawali <b>https://</b> (bukan http://), lalu coba lagi. Kalau
          masih gagal, hubungi Admin.
        </p>
      </div>
    );
  }

  if (status === 'preview' && previewUrl) {
    return (
      <div className="flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal dari blob kamera, bukan aset Next */}
        <img src={previewUrl} alt="Pratinjau foto absen" className="w-full border" style={{ borderColor: 'var(--garis)' }} />
        <div className="flex gap-2">
          <button type="button" onClick={ambilUlang} className="border px-4" style={{ borderColor: 'var(--garis)', color: 'var(--tinta)', minHeight: 48 }}>
            Ambil Ulang
          </button>
          <button
            type="button"
            onClick={() => fotoBlob && onGunakan(fotoBlob)}
            className="flex-1 border px-4"
            style={{ borderColor: 'var(--hijau)', background: 'var(--hijau)', color: 'var(--kertas-2)', minHeight: 48 }}
          >
            Gunakan Foto Ini
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        {/* Cermin CSS HANYA untuk kamera depan (selfie, wajar dicerminkan
            supaya terasa seperti cermin) -- kamera belakang TIDAK PERNAH
            dicerminkan, memotret ruangan yang dicerminkan akan membingungkan
            (teks di foto jadi terbalik, dst). */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full border"
          style={{ borderColor: 'var(--garis)', transform: facingAktif === 'user' ? 'scaleX(-1)' : undefined }}
        />
        <button
          type="button"
          onClick={() => void balikKamera()}
          disabled={membalik}
          aria-label="Balik kamera"
          title="Balik kamera"
          className="absolute flex items-center justify-center"
          style={{ top: 8, right: 8, minHeight: 44, minWidth: 44, borderRadius: 999, background: 'rgba(0,0,0,0.55)', color: '#fff' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 2.1l4 4-4 4" />
            <path d="M3 12.2v-2a4 4 0 0 1 4-4h14" />
            <path d="M7 21.9l-4-4 4-4" />
            <path d="M21 11.8v2a4 4 0 0 1-4 4H3" />
          </svg>
        </button>
      </div>
      {catatanKamera && (
        <p className="text-sm" style={{ color: 'var(--kuning)' }}>{catatanKamera}</p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onBatal} className="border px-4" style={{ borderColor: 'var(--garis)', color: 'var(--tinta)', minHeight: 48 }}>
          Batal
        </button>
        <button type="button" onClick={ambil} className="flex-1 border px-4" style={{ borderColor: 'var(--biru)', background: 'var(--biru)', color: 'var(--kertas-2)', minHeight: 48 }}>
          Ambil Foto
        </button>
      </div>
    </div>
  );
}
