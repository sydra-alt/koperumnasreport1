'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { createClient } from '../../lib/supabase/client';

const PASSWORD_AWAL = 'admin123';

export default function GantiPasswordPage() {
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

      // KRUSIAL, ditemukan 10 September 2026 lewat uji berulang (bukan
      // sekadar dugaan): /api/ganti-password mengganti password lewat Auth
      // Admin API (service_role, server-side) -- ini TIDAK memperbarui sesi
      // browser sama sekali. Supabase mencabut sesi/refresh-token LAMA
      // begitu password berubah, jadi cookie sesi yang sedang dipakai
      // browser ini langsung mati -- navigasi APA PUN sesudahnya (router.push
      // ATAUPUN window.location.assign, sudah dibuktikan keduanya gagal
      // sama) akan ditendang proxy.ts balik ke /masuk karena getUser()
      // gagal. Perbaikannya BUKAN soal cara pindah halaman -- harus login
      // ULANG di klien dengan password BARU supaya cookie sesi yang valid
      // benar-benar tertulis, SEBELUM menampilkan/meninggalkan layar ini.
      if (!session?.user.email) {
        setError('Password berhasil diganti, tapi sesi tidak bisa diperbarui otomatis. Tutup dan masuk ulang lewat halaman Masuk dengan password baru.');
        setMengirim(false);
        return;
      }
      const supabase = createClient();
      const { error: errLoginUlang } = await supabase.auth.signInWithPassword({ email: session.user.email, password: baru });
      if (errLoginUlang) {
        setError('Password berhasil diganti, tapi masuk ulang otomatis gagal. Tutup dan masuk ulang lewat halaman Masuk dengan password baru.');
        setMengirim(false);
        return;
      }

      // Tampilkan layar konfirmasi DULU (instruksi eksplisit user, 10
      // September 2026) -- jangan langsung pindah halaman, supaya orang
      // sungguh sadar passwordnya sudah berubah sebelum layar berikutnya
      // muncul. Navigasi (di tombol "Lanjutkan" di bawah) pakai window.
      // location.assign, BUKAN router.push -- alasan sama seperti
      // app/masuk/page.tsx (race cookie sesi lama vs baru, lihat komentar
      // di sana) -- sesi yang dipakai sekarang sudah sesi BARU dari login
      // ulang di atas, bukan sesi lama yang sudah dicabut.
      setMengirim(false);
      setBerhasil(true);
    } catch {
      setError('Gagal mengganti password. Coba lagi.');
      setMengirim(false);
    }
  }

  if (berhasil) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center p-6" style={{ background: 'var(--kertas)' }}>
        <div className="kartu-status rail-hijau flex w-full max-w-sm flex-col gap-4 p-6" style={{ borderRadius: 'var(--radius-besar)' }}>
          <h1 className="text-2xl" style={{ fontFamily: 'var(--display)', color: 'var(--hijau)' }}>
            Kata sandi berhasil diganti
          </h1>
          <p className="text-sm">Simpan baik-baik, kalau lupa hubungi admin.</p>
          <button
            type="button"
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- sengaja, sama alasan app/masuk/page.tsx (race cookie sesi)
            onClick={() => window.location.assign('/')}
            className="px-4 py-3"
            style={{ background: 'var(--biru)', color: 'var(--kertas-2)', minHeight: 44, borderRadius: 'var(--radius-pil)' }}
          >
            Lanjutkan
          </button>
        </div>
      </main>
    );
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
              autoComplete="new-password"
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
              autoComplete="new-password"
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
