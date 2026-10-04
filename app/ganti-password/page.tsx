'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { createClient } from '../../lib/supabase/client';
import { PASSWORD_AWAL } from '../../lib/passwordAwal';

export default function GantiPasswordPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [baru, setBaru] = useState('');
  const [ulangi, setUlangi] = useState('');
  const [lihatBaru, setLihatBaru] = useState(false);
  const [lihatUlangi, setLihatUlangi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [berhasil, setBerhasil] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (baru.length < 8) {
      setError('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (baru === PASSWORD_AWAL) {
      setError('Kata sandi baru tidak boleh sama dengan kata sandi awal.');
      return;
    }
    if (baru !== ulangi) {
      setError('Kedua kata sandi yang diketik tidak sama.');
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
        setError(hasil.error ?? 'Gagal mengganti kata sandi.');
        setMengirim(false);
        return;
      }

      if (!session?.user.email) {
        setError('Kata sandi berhasil diganti, tapi sesi tidak bisa diperbarui otomatis. Tutup dan masuk ulang lewat halaman Masuk dengan kata sandi baru.');
        setMengirim(false);
        return;
      }
      const supabase = createClient();
      const { error: errLoginUlang } = await supabase.auth.signInWithPassword({ email: session.user.email, password: baru });
      if (errLoginUlang) {
        setError('Kata sandi berhasil diganti, tapi masuk ulang otomatis gagal. Tutup dan masuk ulang lewat halaman Masuk dengan kata sandi baru.');
        setMengirim(false);
        return;
      }

      setMengirim(false);
      setBerhasil(true);
    } catch {
      setError('Gagal mengganti kata sandi. Coba lagi.');
      setMengirim(false);
    }
  }

  if (berhasil) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center p-6" style={{ background: 'var(--halaman)' }}>
        <div className="neumo-kartu flex w-full max-w-sm flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'rgba(30, 138, 76, 0.1)', color: 'var(--hijau)', boxShadow: 'var(--bayangan-neumo-sm)' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--display)', color: 'var(--hijau)' }}>
            Kata sandi berhasil diganti
          </h1>
          <p className="text-xs" style={{ color: 'var(--label)' }}>
            Kata sandi baru Anda sudah aktif. Simpan dengan baik, jangan bagikan ke orang lain.
          </p>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="tombol-utama mt-2 w-full"
            style={{ minHeight: 48 }}
          >
            Lanjutkan ke Beranda
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-6" style={{ background: 'var(--halaman)' }}>
      <div className="w-full max-w-sm">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="tombol-lingkar"
            aria-label="Kembali"
            title="Kembali"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="neumo-kartu flex flex-col gap-5 p-7 md:p-8"
        >
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
              Ganti Kata Sandi
            </h1>
            <p className="mt-1 text-xs" style={{ color: 'var(--label)' }}>
              Perbarui kata sandi akun Koperumnas Anda.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="sandi-baru" className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
              Kata sandi baru
            </label>
            <div className="neumo-inset relative flex items-center px-3.5 py-1" style={{ borderRadius: 'var(--radius-sedang)', minHeight: 48 }}>
              <input
                id="sandi-baru"
                type={lihatBaru ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={baru}
                onChange={(e) => setBaru(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full border-0 bg-transparent pr-8 text-sm outline-none"
                style={{ color: 'var(--tinta)' }}
              />
              <button
                type="button"
                onClick={() => setLihatBaru(!lihatBaru)}
                className="absolute right-2.5 flex items-center justify-center p-1.5 hover:opacity-80"
                style={{ color: 'var(--label)' }}
                aria-label={lihatBaru ? 'Sembunyikan kata sandi baru' : 'Tampilkan kata sandi baru'}
                title={lihatBaru ? 'Sembunyikan kata sandi baru' : 'Tampilkan kata sandi baru'}
              >
                {lihatBaru ? (
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="sandi-ulangi" className="text-xs font-semibold" style={{ color: 'var(--tinta)' }}>
              Ketik ulang kata sandi baru
            </label>
            <div className="neumo-inset relative flex items-center px-3.5 py-1" style={{ borderRadius: 'var(--radius-sedang)', minHeight: 48 }}>
              <input
                id="sandi-ulangi"
                type={lihatUlangi ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={ulangi}
                onChange={(e) => setUlangi(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                className="w-full border-0 bg-transparent pr-8 text-sm outline-none"
                style={{ color: 'var(--tinta)' }}
              />
              <button
                type="button"
                onClick={() => setLihatUlangi(!lihatUlangi)}
                className="absolute right-2.5 flex items-center justify-center p-1.5 hover:opacity-80"
                style={{ color: 'var(--label)' }}
                aria-label={lihatUlangi ? 'Sembunyikan ketik ulang kata sandi' : 'Tampilkan ketik ulang kata sandi'}
                title={lihatUlangi ? 'Sembunyikan ketik ulang kata sandi' : 'Tampilkan ketik ulang kata sandi'}
              >
                {lihatUlangi ? (
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

          <p className="text-xs" style={{ color: 'var(--label)' }}>
            Syarat: Minimal 8 karakter, tidak boleh sama dengan kata sandi awal.
          </p>

          {error && (
            <div className="kartu-status rail-merah p-3 text-xs" style={{ color: 'var(--merah)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={mengirim}
            className="tombol-utama mt-1 w-full"
            style={{ minHeight: 48 }}
          >
            {mengirim ? 'Menyimpan…' : 'Simpan Kata Sandi'}
          </button>
        </form>
      </div>
    </main>
  );
}

