'use client';

import { useEffect, useRef, useState } from 'react';
import { kompresGambar } from '../lib/gambar';
import { jamWIB } from '../lib/tanggal';

type Status = 'meminta' | 'siap' | 'ditolak' | 'gagal' | 'tidak_didukung' | 'preview';

export interface WatermarkAbsen {
  nama: string;
  titikNama: string;
  lat: number;
  lon: number;
}

interface CameraCaptureProps {
  onGunakan: (blob: Blob) => void;
  onBatal: () => void;
  /** Kalau diisi, dibubuhkan ke foto sebagai watermark (instruksi eksplisit user, 30 Agustus 2026) -- nama, jam WIB SAAT DIAMBIL, koordinat, nama titik. */
  watermark?: WatermarkAbsen;
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

/** Bar semi-transparan di bawah foto: logo kecil + nama/jam/titik/koordinat. Gagal muat logo TIDAK boleh menggagalkan absen -- teks tetap dibubuhkan. */
async function bubuhkanWatermark(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, w: WatermarkAbsen) {
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
  ctx.fillText(potongTeks(ctx, `${w.nama} · ${jamWIB()} WIB`, lebarTeksTersedia), xTeks, y0 + tinggiBar * 0.35);

  ctx.font = `400 ${ukuranFontKecil}px sans-serif`;
  ctx.fillText(
    potongTeks(ctx, `${w.titikNama} · ${w.lat.toFixed(6)}, ${w.lon.toFixed(6)}`, lebarTeksTersedia),
    xTeks,
    y0 + tinggiBar * 0.72,
  );
}

/**
 * Kamera depan sungguhan lewat `getUserMedia({facingMode:'user'})` (§3.4
 * 06-RENCANA-PRESENSI-MOBILE.md) -- BUKAN `<input type=file capture>` seperti
 * `LampiranInput.tsx` (Task 11). Beda sengaja: presensi butuh JAMINAN kamera
 * DEPAN (selfie, bukan galeri/kamera belakang) untuk verifikasi wajah --
 * atribut `capture` pada input file tidak konsisten memaksa itu lintas
 * browser, `getUserMedia` + `facingMode:'user'` yang benar-benar menjaminnya.
 */
export function CameraCapture({ onGunakan, onBatal, watermark }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<Status>('meminta');
  const [fotoBlob, setFotoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
        .getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then((stream) => {
          if (batal) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
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
  }, []);

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
      <video ref={videoRef} autoPlay playsInline muted className="w-full border" style={{ borderColor: 'var(--garis)', transform: 'scaleX(-1)' }} />
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
