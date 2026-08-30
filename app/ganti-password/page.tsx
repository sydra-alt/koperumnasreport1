'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const PASSWORD_AWAL = 'admin123';

export default function GantiPasswordPage() {
  const router = useRouter();
  const [baru, setBaru] = useState('');
  const [ulangi, setUlangi] = useState('');
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
          <input
            type="password"
            required
            value={baru}
            onChange={(e) => setBaru(e.target.value)}
            className="border px-2 py-2"
            style={{ borderColor: 'var(--garis)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Ketik ulang password baru</span>
          <input
            type="password"
            required
            value={ulangi}
            onChange={(e) => setUlangi(e.target.value)}
            className="border px-2 py-2"
            style={{ borderColor: 'var(--garis)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
          />
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
