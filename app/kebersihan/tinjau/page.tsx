'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Terlindungi } from '../../../components/Terlindungi';
import { PemilihTanggal } from '../../../components/PemilihTanggal';
import { KerangkaDaftarKartu } from '../../../components/Kerangka';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useLaporanKebersihanUntukTanggal, SLOT_KEBERSIHAN, type LaporanKebersihanRow } from '../../../lib/api/kebersihan';
import { useSignedUrl } from '../../../lib/api/attachment';
import { jamWIB, tanggalWIB } from '../../../lib/tanggal';
import { Istilah } from '../../../components/Istilah';
import { TEKS_TINJAU } from '../../../lib/istilah';

/**
 * Tinjau Laporan Kebersihan (CEO, 6 September 2026) -- gerbang SAMA PERSIS
 * dengan Tinjau Absensi: ceo, pusat, is_hrd_kadiv(). Lima foto ditampilkan
 * berdampingan begitu satu outlet dibuka, supaya sekali lihat tahu kondisi
 * hari itu.
 */
function KartuOutlet({ laporan, tanggal }: { laporan: LaporanKebersihanRow; tanggal: string }) {
  const [terbuka, setTerbuka] = useState(false);
  const [urlPerSlot, setUrlPerSlot] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(false);
  const signedUrl = useSignedUrl();

  const jumlahTerisi = laporan.foto.length;
  const lengkap = jumlahTerisi === SLOT_KEBERSIHAN.length;
  const rail = lengkap ? 'rail-hijau' : jumlahTerisi > 0 ? 'rail-kuning' : 'rail-merah';

  async function buka() {
    const sudahDibuka = terbuka;
    setTerbuka(!sudahDibuka);
    if (sudahDibuka || Object.keys(urlPerSlot).length > 0) return;
    setMemuat(true);
    try {
      const hasil: Record<string, string> = {};
      for (const f of laporan.foto) {
        hasil[f.slot] = await signedUrl.mutateAsync({ path: f.path, umurDetik: 300 });
      }
      setUrlPerSlot(hasil);
    } finally {
      setMemuat(false);
    }
  }

  return (
    <div className={`kartu-status ${rail} flex flex-col gap-3.5 p-5`}>
      <button type="button" onClick={() => void buka()} className="flex items-center justify-between gap-2 text-left" style={{ minHeight: 44 }}>
        <div>
          <p style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 16 }}>{laporan.outletNama}</p>
          <p className="status-teks mt-0.5" style={{ color: lengkap ? 'var(--hijau)' : jumlahTerisi > 0 ? 'var(--kuning)' : 'var(--merah)' }}>
            {jumlahTerisi} dari {SLOT_KEBERSIHAN.length} foto
            {laporan.status === 'terlambat' ? ' · Terlambat' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {laporan.submittedAt && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full neumo-inset-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>
              {jamWIB(new Date(laporan.submittedAt))}
            </span>
          )}
          <span className="tombol-lingkar !w-7 !h-7 text-xs font-bold text-[var(--label)]">
            {terbuka ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {terbuka && (
        <div className="grid gap-3 pt-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
          {SLOT_KEBERSIHAN.map((slot) => {
            const foto = laporan.foto.find((f) => f.slot === slot.key);
            const url = urlPerSlot[slot.key];
            return (
              <div key={slot.key} className="flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-[var(--label)]">{slot.label}</p>
                {!foto ? (
                  <div
                    className="flex items-center justify-center text-xs font-medium neumo-inset-sm rounded-2xl p-2 text-center"
                    style={{ aspectRatio: '1', color: 'var(--kosong)' }}
                  >
                    Belum ada foto
                  </div>
                ) : memuat ? (
                  <div style={{ aspectRatio: '1', borderRadius: 'var(--radius-sedang)' }} className="kerangka neumo-inset-sm" />
                ) : url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed URL sementara */}
                    <img
                      src={url}
                      alt={`Foto ${slot.label} — ${laporan.outletNama}, ${tanggal}`}
                      className="w-full cursor-pointer rounded-2xl shadow-[var(--bayangan-neumo-sm)] transition-transform hover:scale-105"
                      style={{ aspectRatio: '1', objectFit: 'cover' }}
                      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                    />
                    {foto?.uploadedByNama && (
                      <p className="text-[11px]" style={{ color: 'var(--kosong)' }}>
                        {foto.uploadedByNama} · {jamWIB(new Date(foto.createdAt))}
                      </p>
                    )}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TinjauKebersihanIsi() {
  const [tanggal, setTanggal] = useState(tanggalWIB());
  const { data: daftar, isLoading } = useLaporanKebersihanUntukTanggal(tanggal);

  return (
    <div className="flex flex-col gap-4">
      <PemilihTanggal tanggal={tanggal} onUbah={setTanggal} />

      {isLoading ? (
        <KerangkaDaftarKartu jumlah={3} />
      ) : !daftar || daftar.length === 0 ? (
        <p style={{ color: 'var(--kosong)' }}>Belum ada Laporan Kebersihan pada tanggal ini.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {daftar.map((laporan) => (
            <KartuOutlet key={laporan.outletId} laporan={laporan} tanggal={tanggal} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TinjauKebersihanPage() {
  const { roles, profile } = useAuth();
  const bolehHrdKadiv = roles.includes('kadiv') && profile?.divisi === 'HRD';

  return (
    <Terlindungi peran={['ceo', 'pusat']} boleh={bolehHrdKadiv}>
      <main className="mx-auto flex max-w-2xl flex-col gap-5 p-5 md:p-8">
        <header className="neumo-kartu flex items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="tombol-lingkar text-lg font-bold" aria-label="Kembali ke Beranda">
              ‹
            </Link>
            <h1 className="sapaan">
              <Istilah nama="Tinjau" teks={TEKS_TINJAU}>Tinjau Kebersihan</Istilah>
            </h1>
          </div>
        </header>
        <TinjauKebersihanIsi />
      </main>
    </Terlindungi>
  );
}
