'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const PASSWORD_AWAL = 'admin123';

export default function GantiPasswordPage() {
  const router = useRouter();
  const [baru, setBaru] = useState('');
  const [ulangi, setUlangi] = useState('');
  const [lihatBaru, setLihatBaru] = useState(false);
  const [lihatUlangi, setLihatUlangi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (baru.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (baru === PASSWORD_AWAL) {
      setError('Password baru tidak boleh sama dengan password awal.');
      return;
    }
    if (baru !== ulangi) {
      setError('Kedua password yang diketik tidak sama.');
      return;
    }

    setMengirim(true);
    try {
      const res = await fetch('/api/ganti-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: baru }),
      });
      const hasil = await res.json();
      if (!res.ok) {
        setError(hasil.error ?? 'Gagal mengganti password.');
        setMengirim(false);
        return;
      }
      // router.push (App Router) tetap membuat permintaan server untuk rute
      // baru -- proxy.ts ikut berjalan lagi & membaca profile.harus_ganti_
      // password yang baru saja berubah, bukan state lama yang di-cache.
      router.push('/');
      router.refresh();
    } catch {
      setError('Gagal mengganti password. Coba lagi.');
      setMengirim(false);
    }
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-6" style={{ background: 'var(--kertas)' }}>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 border p-6"
        style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)' }}
      >
        <h1 className="text-2xl" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
          Ganti Password
        </h1>
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Password awal akun Anda perlu diganti dulu sebelum bisa memakai sistem ini.
        </p>

        <label className="flex flex-col gap-1">
          <span>Password baru</span>
          <div className="relative flex items-center">
            <input
              type={lihatBaru ? 'text' : 'password'}
              required
              value={baru}
              onChange={(e) => setBaru(e.target.value)}
              className="w-full border px-2 py-2 pr-11"
              style={{ borderColor: 'var(--garis)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
            />
            <button
              type="button"
              onClick={() => setLihatBaru(!lihatBaru)}
              className="absolute right-0 flex items-center justify-center p-2 text-label hover:opacity-80"
              style={{ minHeight: 44, minWidth: 44, color: 'var(--label)' }}
              aria-label={lihatBaru ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
              title={lihatBaru ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
            >
              {lihatBaru ? (
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

        <label className="flex flex-col gap-1">
          <span>Ketik ulang password baru</span>
          <div className="relative flex items-center">
            <input
              type={lihatUlangi ? 'text' : 'password'}
              required
              value={ulangi}
              onChange={(e) => setUlangi(e.target.value)}
              className="w-full border px-2 py-2 pr-11"
              style={{ borderColor: 'var(--garis)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
            />
            <button
              type="button"
              onClick={() => setLihatUlangi(!lihatUlangi)}
              className="absolute right-0 flex items-center justify-center p-2 text-label hover:opacity-80"
              style={{ minHeight: 44, minWidth: 44, color: 'var(--label)' }}
              aria-label={lihatUlangi ? 'Sembunyikan ketik ulang password' : 'Tampilkan ketik ulang password'}
              title={lihatUlangi ? 'Sembunyikan ketik ulang password' : 'Tampilkan ketik ulang password'}
            >
              {lihatUlangi ? (
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

        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Minimal 8 karakter, tidak boleh sama dengan password awal.
        </p>

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
          {mengirim ? 'Menyimpan…' : 'Simpan & Lanjutkan'}
        </button>
      </form>
    </main>
  );
}
