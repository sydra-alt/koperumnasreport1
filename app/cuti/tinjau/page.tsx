'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Terlindungi } from '../../../components/Terlindungi';
import { KerangkaDaftarKartu } from '../../../components/Kerangka';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useAntreanTinjauCuti, usePutuskanCuti, useSignedUrlCuti, type CutiTinjau } from '../../../lib/api/cuti';
import { tanggalIndonesiaDariYmd } from '../../../lib/tanggal';
import { Istilah } from '../../../components/Istilah';
import { TEKS_TINJAU } from '../../../lib/istilah';

const LABEL_JENIS: Record<string, string> = { cuti: 'Cuti', sakit: 'Sakit', izin: 'Izin' };

function Baris({ item }: { item: CutiTinjau }) {
  const putuskan = usePutuskanCuti();
  const signedUrl = useSignedUrlCuti();
  const [catatan, setCatatan] = useState('');
  const [membukaSurat, setMembukaSurat] = useState(false);

  async function lihatSurat() {
    if (!item.suratPath) return;
    setMembukaSurat(true);
    try {
      const url = await signedUrl.mutateAsync({ path: item.suratPath, umurDetik: 120 });
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setMembukaSurat(false);
    }
  }

  return (
    <li className="kartu-status rail-kuning flex flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between gap-2">
        <p style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 700, color: 'var(--biru)' }}>
          {item.userNama} — {LABEL_JENIS[item.jenis] ?? item.jenis}
        </p>
        <span className="status-teks" style={{ color: 'var(--kuning)' }}>Menunggu</span>
      </div>
      <p className="text-xs font-semibold" style={{ color: 'var(--label)', fontFamily: 'var(--mono)' }}>
        {tanggalIndonesiaDariYmd(item.tanggalMulai)}
        {item.tanggalSelesai !== item.tanggalMulai ? ` – ${tanggalIndonesiaDariYmd(item.tanggalSelesai)}` : ''}
      </p>
      {item.keterangan && <p className="text-sm" style={{ color: 'var(--tinta)' }}>{item.keterangan}</p>}
      {item.suratPath && (
        <button
          type="button"
          onClick={() => void lihatSurat()}
          disabled={membukaSurat}
          className="tombol-sekunder self-start !py-1.5 !px-3.5 text-xs font-bold"
        >
          {membukaSurat ? 'Membuka…' : 'Lihat surat'}
        </button>
      )}
      <textarea
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        placeholder="Catatan persetujuan (opsional)"
        className="w-full text-sm"
        rows={2}
      />
      <div className="flex gap-3 mt-1">
        <button
          type="button"
          disabled={putuskan.isPending}
          onClick={() => putuskan.mutate({ id: item.id, disetujui: false, catatan: catatan.trim() || null })}
          className="tombol-sekunder flex-1 !text-[var(--merah)] hover:!bg-[var(--merah-lembut)]"
        >
          Tolak
        </button>
        <button
          type="button"
          disabled={putuskan.isPending}
          onClick={() => putuskan.mutate({ id: item.id, disetujui: true, catatan: catatan.trim() || null })}
          className="tombol-utama flex-1 !bg-[var(--hijau)]"
        >
          Setujui
        </button>
      </div>
      {putuskan.isError && (
        <p className="text-sm font-medium" style={{ color: 'var(--merah)' }}>
          {(putuskan.error as Error).message}
        </p>
      )}
    </li>
  );
}

function Isi() {
  const { data: antrean, isLoading } = useAntreanTinjauCuti();

  if (isLoading) return <KerangkaDaftarKartu />;

  if (!antrean || antrean.length === 0) {
    <div className="panel neumo-kartu p-6 text-center">
      <p style={{ color: 'var(--kosong)' }}>Tidak ada pengajuan yang menunggu persetujuan.</p>
    </div>
  }

  return (
    <ul className="flex flex-col gap-3.5 list-none p-0">
      {(antrean ?? []).map((item) => (
        <Baris key={item.id} item={item} />
      ))}
    </ul>
  );
}

export default function TinjauCutiPage() {
  const { roles, profile } = useAuth();
  const bolehHrdKadiv = roles.includes('kadiv') && profile?.divisi === 'HRD';

  return (
    <Terlindungi peran={['ceo']} boleh={bolehHrdKadiv}>
      <main className="mx-auto flex max-w-xl flex-col gap-5 p-5 md:p-8">
        <header className="neumo-kartu flex items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="tombol-lingkar text-lg font-bold" aria-label="Kembali ke Beranda">
              ‹
            </Link>
            <h1 className="sapaan">
              <Istilah nama="Tinjau" teks={TEKS_TINJAU}>Tinjau Cuti / Sakit / Izin</Istilah>
            </h1>
          </div>
        </header>
        <Isi />
      </main>
    </Terlindungi>
  );
}
