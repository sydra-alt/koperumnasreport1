'use client';

import { useEffect, useRef, useState } from 'react';
import { kompresGambar } from '../lib/gambar';

type Status = 'meminta' | 'siap' | 'ditolak' | 'gagal' | 'preview';

interface CameraCaptureProps {
  onGunakan: (blob: Blob) => void;
  onBatal: () => void;
}

/**
 * Kamera depan sungguhan lewat `getUserMedia({facingMode:'user'})` (§3.4
 * 06-RENCANA-PRESENSI-MOBILE.md) -- BUKAN `<input type=file capture>` seperti
 * `LampiranInput.tsx` (Task 11). Beda sengaja: presensi butuh JAMINAN kamera
 * DEPAN (selfie, bukan galeri/kamera belakang) untuk verifikasi wajah --
 * atribut `capture` pada input file tidak konsisten memaksa itu lintas
 * browser, `getUserMedia` + `facingMode:'user'` yang benar-benar menjaminnya.
 */
export function CameraCapture({ onGunakan, onBatal }: CameraCaptureProps) {
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
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (batal) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStatus('siap');
      })
      .catch((err) => {
        if (batal) return;
        setStatus(err?.name === 'NotAllowedError' ? 'ditolak' : 'gagal');
      });

    return () => {
      batal = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function ambil() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
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
    return <p>Meminta izin kamera…</p>;
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
