'use client';

import { useEffect, useRef } from 'react';

interface KonfirmasiDialogProps {
  terbuka: boolean;
  judul: string;
  pesan?: string;
  /** Teks tombol setuju, spesifik ke tindakannya (mis. "Ya, atur ulang"). */
  ya: string;
  batal?: string;
  bahaya?: boolean;
  onYa: () => void;
  onBatal: () => void;
}

/**
 * Pengganti confirm() bawaan browser (5 Oktober 2026, audit UI P21): dialog
 * aplikasi sendiri dengan tombol berbahasa Indonesia yang menyebut
 * tindakannya. Elemen <dialog> asli (fokus terkunci, Esc menutup).
 */
export function KonfirmasiDialog({ terbuka, judul, pesan, ya, batal = 'Batal', bahaya = false, onYa, onBatal }: KonfirmasiDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (terbuka && !d.open) d.showModal();
    if (!terbuka && d.open) d.close();
  }, [terbuka]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onBatal();
      }}
      className="panel m-auto w-[min(92vw,380px)] p-0"
      style={{ border: '1px solid var(--garis)', background: 'var(--kertas)', color: 'var(--tinta)' }}
    >
      <div className="flex flex-col gap-3 p-4">
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 17 }}>{judul}</p>
        {pesan && <p className="text-sm" style={{ color: 'var(--label)' }}>{pesan}</p>}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onYa}
            className="px-4"
            style={{ minHeight: 44, borderRadius: 'var(--radius-pil)', background: bahaya ? 'var(--merah)' : 'var(--biru)', color: 'var(--kertas-2)' }}
          >
            {ya}
          </button>
          <button
            type="button"
            onClick={onBatal}
            className="border px-4"
            style={{ minHeight: 44, borderRadius: 'var(--radius-pil)', borderColor: 'var(--garis)' }}
          >
            {batal}
          </button>
        </div>
      </div>
    </dialog>
  );
}
