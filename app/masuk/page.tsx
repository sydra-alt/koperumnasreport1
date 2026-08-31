'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';

export default function MasukPage() {
  const { signIn } = useAuth();
  const router = useRouter();
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
    setMengirim(false);
    if (hasil.error) {
      setError(hasil.error);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-6" style={{ background: 'var(--kertas)' }}>
      <Image src="/logo-koperumnas.jpg" alt="Koperumnas Group" width={96} height={96} priority className="mb-4" style={{ borderRadius: 'var(--radius-besar)' }} />
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4 border p-6" style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)' }}>
        <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
          Masuk
        </h1>

        <label className="flex flex-col gap-1">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border px-2 py-2"
            style={{ borderColor: 'var(--garis)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Kata sandi</span>
          <div className="relative flex items-center">
            <input
              type={lihatPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border px-2 py-2 pr-11"
              style={{ borderColor: 'var(--garis)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
            />
            <button
              type="button"
              onClick={() => setLihatPassword(!lihatPassword)}
              className="absolute right-0 flex items-center justify-center p-2 text-label hover:opacity-80"
              style={{ minHeight: 44, minWidth: 44, color: 'var(--label)' }}
              aria-label={lihatPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              title={lihatPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              {lihatPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                  <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                  <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                  <line x1="2" y1="2" x2="22" y2="22" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </label>

        {error && (
          <p className="text-sm" style={{ color: 'var(--merah)' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={mengirim}
          className="px-4 py-3"
          style={{ background: 'var(--biru)', color: 'var(--kertas-2)', minHeight: 44, borderRadius: 'var(--radius-pil)' }}
        >
          {mengirim ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
