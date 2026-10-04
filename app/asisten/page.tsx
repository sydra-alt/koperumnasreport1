'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { ImporOpname } from '../../components/asisten/ImporOpname';
import { ImporBelanja } from '../../components/asisten/ImporBelanja';
import { ImporResep } from '../../components/asisten/ImporResep';
import { TinjauUkuran } from '../../components/asisten/TinjauUkuran';

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
    <main className="flex min-h-svh flex-col items-center justify-center p-6 text-center">
      <div className="neumo-kartu flex w-full max-w-sm flex-col items-center gap-3 p-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--biru-lembut)', color: 'var(--biru)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4" />
            <line x1="8" y1="16" x2="8" y2="16" />
            <line x1="16" y1="16" x2="16" y2="16" />
          </svg>
        </div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--tinta)' }}>{judul}</h1>
        <p className="text-sm" style={{ color: 'var(--label)' }}>{isi}</p>
        <Link href="/" className="tombol-utama mt-2 w-full text-center">
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}

function Asisten() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [percakapanId, setPercakapanId] = useState<string | null>(null);
  const [draf, setDraf] = useState('');
  const [menunggu, setMenunggu] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [riwayatTerbuka, setRiwayatTerbuka] = useState(false);
  const [panelImpor, setPanelImpor] = useState<'opname' | 'resep' | 'belanja' | 'ukuran' | null>(null);

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
    setPanelImpor(null);
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

  const daftarRiwayat = (
    <nav aria-label="Riwayat percakapan" className="flex flex-col gap-1.5 pt-2">
      {daftar.isLoading ? <KerangkaTeks /> : null}
      {daftar.data?.length === 0 ? <p className="text-sm" style={{ color: 'var(--label)' }}>Belum ada percakapan.</p> : null}
      {daftar.data?.map((c) => {
        const aktif = c.id === percakapanId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setPercakapanId(c.id);
              setGalat(null);
              setRiwayatTerbuka(false);
            }}
            className="truncate px-3.5 py-2.5 text-left text-sm transition-all"
            style={{
              minHeight: 44,
              borderRadius: 'var(--radius-sedang)',
              background: 'var(--permukaan)',
              boxShadow: aktif ? 'var(--bayangan-neumo-dalam)' : 'var(--bayangan-neumo-sm)',
              color: aktif ? 'var(--biru)' : 'var(--tinta)',
              fontWeight: aktif ? 600 : 400,
            }}
            title={c.judul}
          >
            {c.judul}
          </button>
        );
      })}
    </nav>
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:flex-row md:p-6">
      {/* Kolom Samping / Sidebar Kontrol */}
      <aside className="flex flex-col gap-3 md:w-68 md:shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="tombol-lingkar shrink-0"
            aria-label="Kembali"
            title="Kembali"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>

          <button
            type="button"
            onClick={mulaiBaru}
            className="tombol-utama flex flex-1 items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Chat baru
          </button>

          <button
            type="button"
            onClick={() => setRiwayatTerbuka((v) => !v)}
            className="tombol-sekunder px-3 text-sm md:hidden"
            aria-expanded={riwayatTerbuka}
          >
            Riwayat
          </button>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {(
            [
              ['opname', 'Impor opname (Excel)'],
              ['resep', 'Impor resep (Excel)'],
              ['belanja', 'Impor belanja (foto nota)'],
              ['ukuran', 'Tinjau jenis ukuran bahan'],
            ] as const
          ).map(([jenis, label]) => {
            const aktif = panelImpor === jenis;
            return (
              <button
                key={jenis}
                type="button"
                onClick={() => {
                  setPanelImpor((v) => (v === jenis ? null : jenis));
                  setGalat(null);
                }}
                className="tombol-sekunder justify-start text-left text-xs"
                style={{
                  minHeight: 42,
                  boxShadow: aktif ? 'var(--bayangan-neumo-dalam)' : 'var(--bayangan-neumo-sm)',
                  color: aktif ? 'var(--biru)' : 'var(--tinta)',
                  fontWeight: aktif ? 600 : 500,
                }}
                aria-expanded={panelImpor === jenis}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className={riwayatTerbuka ? 'block' : 'hidden md:block'}>{daftarRiwayat}</div>
      </aside>

      {/* Area Chat Utama */}
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="neumo-kartu flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--biru-lembut)', color: 'var(--biru)', boxShadow: 'var(--bayangan-neumo-sm)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--display)', fontSize: '18px', fontWeight: 700, color: 'var(--tinta)' }}>Asisten AI Koperumnas</h1>
              <p className="text-xs" style={{ color: 'var(--label)' }}>
                Tanya jawab &amp; analisis laporan, absensi, dan data POS.
              </p>
            </div>
          </div>
        </header>

        {panelImpor ? (
          (() => {
            const props = {
              habis,
              onSelesai: (hasil: { percakapanId: string; pesanUser: unknown; pesanModel: unknown }) => {
                queryClient.setQueryData<PesanAi[]>(['ai-pesan', hasil.percakapanId], [hasil.pesanUser as PesanAi, hasil.pesanModel as PesanAi]);
                setPercakapanId(hasil.percakapanId);
                setGalat(null);
                setPanelImpor(null);
              },
              onGalat: (pesan: string, id: string | null) => {
                setGalat(pesan);
                if (id) setPercakapanId(id);
              },
            };
            return panelImpor === 'opname' ? (
              <ImporOpname {...props} />
            ) : panelImpor === 'resep' ? (
              <ImporResep {...props} />
            ) : panelImpor === 'belanja' ? (
              <ImporBelanja {...props} />
            ) : (
              <TinjauUkuran {...props} />
            );
          })()
        ) : null}

        <div className="flex flex-col gap-4">
          {!percakapanId && !menunggu && !panelImpor ? (
            <div className="flex flex-col gap-2.5">
              <p className="text-xs font-semibold" style={{ color: 'var(--label)' }}>Contoh pertanyaan cepat:</p>
              <div className="flex flex-wrap gap-2">
                {CONTOH.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraf(c)}
                    className="tombol-sekunder text-left text-xs"
                    style={{ minHeight: 40, borderRadius: 'var(--radius-pil)', paddingInline: 14 }}
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
              <p className="text-xs font-semibold" style={{ color: 'var(--biru)' }} role="status">Mengetik balasan...</p>
            </>
          ) : null}
          {galat ? (
            <p
              className="kartu-status rail-merah p-4 text-sm"
              role="alert"
              style={{ color: 'var(--merah)' }}
            >
              {galat}
            </p>
          ) : null}
        </div>

        {/* Form Isian Pertanyaan (Neumorphic Inset Well) */}
        <form onSubmit={tanganiKirim} className="mt-auto flex flex-col gap-2 pt-2">
          <label htmlFor="pertanyaan-ai" className="sr-only">Pertanyaan</label>
          <div className="neumo-inset p-2" style={{ borderRadius: 'var(--radius-sedang)' }}>
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
              placeholder={habis ? 'Batas pesan hari ini sudah habis.' : 'Tulis pertanyaan Anda di sini... (Enter untuk kirim)'}
              disabled={habis || kirim.isPending}
              className="w-full border-0 bg-transparent p-2 text-sm outline-none"
              style={{ resize: 'none', color: 'var(--tinta)' }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs" style={{ color: habis ? 'var(--merah)' : 'var(--label)' }}>
              {status.data
                ? habis
                  ? `Batas ${status.data.batas} pesan per hari sudah tercapai.`
                  : `Sisa ${status.data.batas - status.data.terpakai} dari ${status.data.batas} pesan hari ini`
                : ''}
            </span>
            <button
              type="submit"
              disabled={habis || kirim.isPending || draf.trim() === ''}
              className="tombol-utama inline-flex items-center gap-2"
              style={{ minHeight: 44, paddingInline: 22 }}
            >
              <span>{kirim.isPending ? 'Mengirim...' : 'Kirim'}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
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
        className={dariUser ? 'max-w-[90%] whitespace-pre-wrap px-4 py-3 text-sm text-white' : 'neumo-kartu max-w-[90%] whitespace-pre-wrap px-5 py-4 text-sm'}
        style={{
          borderRadius: dariUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
          background: dariUser ? 'linear-gradient(135deg, #1E4DB7, #3B6FE8)' : 'var(--permukaan)',
          boxShadow: dariUser ? '0 4px 14px rgba(30, 77, 183, 0.28)' : 'var(--bayangan-neumo)',
        }}
      >
        <span className="sr-only">{dariUser ? 'Anda: ' : 'Asisten: '}</span>
        {pesan.isi}
      </div>
      {!dariUser && pesan.tabel
        ? pesan.tabel.map((t, i) => (
            <div key={i} className="flex w-full flex-col gap-2">
              {t.tautan && t.tautan.href.startsWith('/api/pos-handoff?next=') ? (
                <a
                  href={t.tautan.href}
                  target="_blank"
                  rel="noopener"
                  className="tombol-utama inline-flex w-fit items-center"
                >
                  {t.tautan.label}
                </a>
              ) : null}
              <TabelJawaban tabel={t} pesanId={pesan.id} urutan={i} />
            </div>
          ))
        : null}
    </div>
  );
}

