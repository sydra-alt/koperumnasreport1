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
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4 border p-6" style={{ borderColor: 'var(--garis)' }}>
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
            style={{ borderColor: 'var(--garis)', minHeight: 44 }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Kata sandi</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border px-2 py-2"
            style={{ borderColor: 'var(--garis)', minHeight: 44 }}
          />
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
          style={{ background: 'var(--biru)', color: 'var(--kertas-2)', minHeight: 44 }}
        >
          {mengirim ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
