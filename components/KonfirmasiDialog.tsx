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
      className="neumo-kartu m-auto w-[min(92vw,400px)] p-0 backdrop:backdrop-blur-sm backdrop:bg-black/30"
      style={{ border: '1px solid rgba(255, 255, 255, 0.85)', background: 'var(--permukaan)', color: 'var(--tinta)', borderRadius: '24px' }}
    >
      <div className="flex flex-col gap-4 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: bahaya ? 'rgba(217, 37, 37, 0.1)' : 'var(--biru-lembut)', color: bahaya ? 'var(--merah)' : 'var(--biru)', boxShadow: 'var(--bayangan-neumo-sm)' }}>
          {bahaya ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          )}
        </div>

        <div>
          <p style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 18, color: 'var(--tinta)' }}>{judul}</p>
          {pesan && <p className="mt-1 text-xs" style={{ color: 'var(--label)', lineHeight: 1.5 }}>{pesan}</p>}
        </div>

        <div className="mt-2 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onYa}
            className="tombol-utama w-full"
            style={{
              minHeight: 46,
              background: bahaya ? 'linear-gradient(135deg, #D92525, #B71C1C)' : undefined,
              boxShadow: bahaya ? '0 4px 14px rgba(217, 37, 37, 0.3)' : undefined,
            }}
          >
            {ya}
          </button>
          <button
            type="button"
            onClick={onBatal}
            className="tombol-sekunder w-full"
            style={{ minHeight: 46 }}
          >
            {batal}
          </button>
        </div>
      </div>
    </dialog>
  );
}
