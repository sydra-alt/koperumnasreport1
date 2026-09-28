'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth/AuthProvider';
import {
  GalatKirimAi,
  useStatusAi,
  useDaftarPercakapan,
  useKirimPesanAi,
  usePesanPercakapan,
  type PesanAi,
} from '../../lib/api/asisten';
import { KerangkaTeks } from '../../components/Kerangka';
import { TabelJawaban } from '../../components/asisten/TabelJawaban';

/**
 * Asisten AI, fase 1 (28 September 2026) -- tanya jawab & analisis. Status
 * dari `ai_status()`: "belum diaktifkan" (policy hilang/batas 0), "tidak
 * tersedia untuk akun Anda" (profile.punya_akses_ai belum dinyalakan Admin), dan "jatah hari
 * ini habis" SENGAJA tiga pesan berbeda -- jangan digabung. Gerbang
 * sungguhan tetap di database dan di /api/ai/chat.
 */

const CONTOH = ['Berapa omzet POS kemarin per outlet?', 'Siapa yang belum kirim laporan minggu ini?', 'Stok bahan apa yang di bawah minimum?'];

export default function AsistenPage() {
  const { session, loading } = useAuth();
  const login = Boolean(session);
  const status = useStatusAi(login);

  if (loading || (login && status.isLoading)) {
    return <div className="p-6"><KerangkaTeks /></div>;
  }
  if (!login || status.isError || !status.data) {
    return <Pemberitahuan judul="Status asisten tidak bisa dibaca" isi="Muat ulang halaman ini. Kalau tetap begini, hubungi admin." />;
  }
  if (!status.data.aktif) {
    return <Pemberitahuan judul="Asisten AI belum diaktifkan" isi="Asisten AI belum diaktifkan untuk bisnis ini. Hubungi CEO/admin kalau ingin menyalakannya." />;
  }
  if (!status.data.boleh) {
    return <Pemberitahuan judul="Belum diaktifkan untuk akun Anda" isi="Asisten AI hanya untuk orang yang diberi akses. Hubungi CEO/admin kalau Anda butuh akses." />;
  }
  return <Asisten />;
}

function Pemberitahuan({ judul, isi }: { judul: string; isi: string }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-2xl" style={{ color: 'var(--tinta)' }}>{judul}</h1>
      <p style={{ color: 'var(--label)' }}>{isi}</p>
    </main>
  );
}

function Asisten() {
  const queryClient = useQueryClient();
  const [percakapanId, setPercakapanId] = useState<string | null>(null);
  const [draf, setDraf] = useState('');
  const [menunggu, setMenunggu] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [riwayatTerbuka, setRiwayatTerbuka] = useState(false);

  const daftar = useDaftarPercakapan(true);
  const pesan = usePesanPercakapan(percakapanId);
  const status = useStatusAi(true);
  const kirim = useKirimPesanAi();

  const habis = status.data ? status.data.terpakai >= status.data.batas : false;

  function mulaiBaru() {
    setPercakapanId(null);
    setGalat(null);
    setDraf('');
    setRiwayatTerbuka(false);
  }

  async function tanganiKirim(e: FormEvent) {
    e.preventDefault();
    const teks = draf.trim();
    if (!teks || kirim.isPending) return;
    setGalat(null);
    setMenunggu(teks);
    setDraf('');
    try {
      const hasil = await kirim.mutateAsync({ percakapanId, pesan: teks });
      queryClient.setQueryData<PesanAi[]>(['ai-pesan', hasil.percakapanId], (lama) => [
        ...(percakapanId === hasil.percakapanId ? (lama ?? []) : []),
        hasil.pesanUser,
        hasil.pesanModel,
      ]);
      setPercakapanId(hasil.percakapanId);
    } catch (err) {
      console.error('asisten: kirim gagal', err);
      if (err instanceof GalatKirimAi) {
        setGalat(err.message);
        if (err.percakapanId) setPercakapanId(err.percakapanId);
        if (err.batasTercapai) setDraf(teks);
      } else {
        setGalat('Terjadi kesalahan. Coba lagi.');
        setDraf(teks);
      }
    } finally {
      setMenunggu(null);
    }
  }

  const gayaTombolUtama = {
    background: 'var(--biru)',
    color: 'var(--kertas-2)',
    borderRadius: 'var(--radius-kecil)',
    minHeight: 44,
  } as const;

  const daftarRiwayat = (
    <nav aria-label="Riwayat percakapan" className="flex flex-col gap-1">
      {daftar.isLoading ? <KerangkaTeks /> : null}
      {daftar.data?.length === 0 ? <p className="text-sm" style={{ color: 'var(--label)' }}>Belum ada percakapan.</p> : null}
      {daftar.data?.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => {
            setPercakapanId(c.id);
            setGalat(null);
            setRiwayatTerbuka(false);
          }}
          className="truncate px-3 py-2 text-left text-sm"
          style={{
            minHeight: 44,
            borderRadius: 'var(--radius-kecil)',
            background: c.id === percakapanId ? 'var(--biru-lembut)' : 'transparent',
            color: c.id === percakapanId ? 'var(--biru)' : 'var(--tinta)',
          }}
          title={c.judul}
        >
          {c.judul}
        </button>
      ))}
    </nav>
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:flex-row md:p-6">
      <aside className="flex flex-col gap-3 md:w-64 md:shrink-0">
        <div className="flex gap-2">
          <button type="button" onClick={mulaiBaru} className="flex-1 px-4 text-sm font-semibold" style={gayaTombolUtama}>
            Chat baru
          </button>
          <button
            type="button"
            onClick={() => setRiwayatTerbuka((v) => !v)}
            className="border px-3 text-sm md:hidden"
            style={{ borderColor: 'var(--garis-tegas)', borderRadius: 'var(--radius-kecil)', minHeight: 44 }}
            aria-expanded={riwayatTerbuka}
          >
            Riwayat
          </button>
        </div>
        <div className={riwayatTerbuka ? 'block' : 'hidden md:block'}>{daftarRiwayat}</div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h1 style={{ fontSize: 'var(--ukuran-judul)', fontWeight: 600 }}>Asisten AI</h1>
          <p className="text-sm" style={{ color: 'var(--label)' }}>
            Jawaban hanya dari data yang bisa Anda lihat: laporan, absensi, dan data POS outletmu.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          {!percakapanId && !menunggu ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm" style={{ color: 'var(--label)' }}>Contoh pertanyaan:</p>
              <div className="flex flex-wrap gap-2">
                {CONTOH.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraf(c)}
                    className="border px-3 py-2 text-left text-sm"
                    style={{ borderColor: 'var(--biru-garis)', borderRadius: 'var(--radius-pil)', minHeight: 44 }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {percakapanId && pesan.isLoading ? <KerangkaTeks /> : null}
          {percakapanId ? pesan.data?.map((m) => <Gelembung key={m.id} pesan={m} />) : null}
          {menunggu ? (
            <>
              <Gelembung pesan={{ id: 'menunggu', peran: 'user', isi: menunggu, tabel: null, createdAt: '' }} />
              <p className="text-sm" style={{ color: 'var(--label)' }} role="status">Menunggu jawaban...</p>
            </>
          ) : null}
          {galat ? (
            <p
              className="border p-3 text-sm"
              role="alert"
              style={{ borderColor: 'var(--merah-garis)', background: 'var(--merah-lembut)', color: 'var(--merah)', borderRadius: 'var(--radius-kecil)' }}
            >
              {galat}
            </p>
          ) : null}
        </div>

        <form onSubmit={tanganiKirim} className="flex flex-col gap-2">
          <label htmlFor="pertanyaan-ai" className="sr-only">Pertanyaan</label>
          <textarea
            id="pertanyaan-ai"
            value={draf}
            onChange={(e) => setDraf(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={3}
            maxLength={2000}
            placeholder={habis ? 'Batas pesan hari ini sudah habis.' : 'Tulis pertanyaan...'}
            disabled={habis || kirim.isPending}
            className="w-full border p-3"
            style={{ borderColor: 'var(--garis-tegas)', borderRadius: 'var(--radius-kecil)', background: 'var(--permukaan)' }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm" style={{ color: habis ? 'var(--merah)' : 'var(--label)' }}>
              {status.data
                ? habis
                  ? `Batas ${status.data.batas} pesan per hari sudah tercapai. Coba lagi besok.`
                  : `Sisa ${status.data.batas - status.data.terpakai} dari ${status.data.batas} pesan hari ini`
                : ''}
            </span>
            <button
              type="submit"
              disabled={habis || kirim.isPending || draf.trim() === ''}
              className="px-6 text-sm font-semibold disabled:opacity-50"
              style={gayaTombolUtama}
            >
              {kirim.isPending ? 'Mengirim...' : 'Kirim'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function Gelembung({ pesan }: { pesan: PesanAi }) {
  const dariUser = pesan.peran === 'user';
  return (
    <div className={`flex flex-col gap-2 ${dariUser ? 'items-end' : 'items-start'}`}>
      <div
        className="max-w-[90%] whitespace-pre-wrap px-4 py-3"
        style={{
          borderRadius: 'var(--radius-besar)',
          background: dariUser ? 'var(--biru-lembut)' : 'var(--permukaan)',
          border: dariUser ? 'none' : '1px solid var(--garis)',
        }}
      >
        <span className="sr-only">{dariUser ? 'Anda: ' : 'Asisten: '}</span>
        {pesan.isi}
      </div>
      {!dariUser && pesan.tabel
        ? pesan.tabel.map((t, i) => (
            <div key={i} className="w-full">
              <TabelJawaban tabel={t} pesanId={pesan.id} urutan={i} />
            </div>
          ))
        : null}
    </div>
  );
}
