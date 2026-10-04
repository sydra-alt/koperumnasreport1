'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '../../lib/auth/AuthProvider';

export default function MasukPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lihatPassword, setLihatPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMengirim(true);
    const hasil = await signIn(email, password);
    if (hasil.error) {
      setMengirim(false);
      setError(hasil.error);
      return;
    }
    window.location.assign('/');
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-6" style={{ background: 'var(--halaman)' }}>
      {/* Container Logo dengan Elevasi Neumorphic */}
      <div className="neumo-kartu mb-6 flex h-24 w-24 items-center justify-center overflow-hidden p-2" style={{ borderRadius: '28px' }}>
        <Image
          src="/logo-koperumnas.jpg"
          alt="Koperumnas Group"
          width={80}
          height={80}
          priority
          style={{ borderRadius: '20px', objectFit: 'contain' }}
        />
      </div>

      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="neumo-kartu flex flex-col gap-5 p-7 md:p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
              Masuk
            </h1>
            <p className="mt-1 text-xs" style={{ color: 'var(--label)' }}>
              Portal Laporan &amp; Monitoring Koperumnas
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email-input" className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
              Email
            </label>
            <div className="neumo-inset flex items-center px-3.5 py-1" style={{ borderRadius: 'var(--radius-sedang)', minHeight: 48 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--label)', marginRight: 10, flexShrink: 0 }}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <input
                id="email-input"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@koperumnas.com"
                className="w-full border-0 bg-transparent text-sm outline-none"
                style={{ color: 'var(--tinta)' }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password-input" className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
              Kata sandi
            </label>
            <div className="neumo-inset relative flex items-center px-3.5 py-1" style={{ borderRadius: 'var(--radius-sedang)', minHeight: 48 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: 'var(--label)', marginRight: 10, flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                id="password-input"
                type={lihatPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border-0 bg-transparent pr-8 text-sm outline-none"
                style={{ color: 'var(--tinta)' }}
              />
              <button
                type="button"
                onClick={() => setLihatPassword(!lihatPassword)}
                className="absolute right-2.5 flex items-center justify-center p-1.5 text-label hover:opacity-80"
                style={{ color: 'var(--label)' }}
                aria-label={lihatPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                title={lihatPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {lihatPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="kartu-status rail-merah p-3 text-xs" style={{ color: 'var(--merah)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={mengirim}
            className="tombol-utama mt-1 flex w-full items-center justify-center gap-2"
            style={{ minHeight: 48 }}
          >
            {mengirim ? (
              <span>Memeriksa…</span>
            ) : (
              <>
                <span>Masuk Sekarang</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>

          <p className="text-center text-xs" style={{ color: 'var(--label)' }}>
            Lupa kata sandi? Hubungi admin Koperumnas.
          </p>
        </form>
      </div>
    </main>
  );
}

