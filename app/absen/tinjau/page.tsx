'use client';

import { useState } from 'react';
import { Terlindungi } from '../../../components/Terlindungi';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useAntreanTinjauAbsen, usePutuskanAbsensi, useSignedUrlAbsensi, type AbsensiTinjau } from '../../../lib/api/absensi';
import { tanggalIndonesiaDariYmd } from '../../../lib/tanggal';
import { TombolEkspor } from '../../../components/TombolEkspor';

function Baris({ item }: { item: AbsensiTinjau }) {
  const signedUrl = useSignedUrlAbsensi();
  const putuskan = usePutuskanAbsensi();
  const [catatan, setCatatan] = useState('');
  const [membukaFoto, setMembukaFoto] = useState(false);

  const jam = new Date(item.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

  async function lihatFoto() {
    setMembukaFoto(true);
    try {
      const url = await signedUrl.mutateAsync({ path: item.fotoPath, umurDetik: 120 });
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setMembukaFoto(false);
    }
  }

  return (
    <li className="flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--kuning)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        {item.userNama} — {item.tipe === 'masuk' ? 'Masuk' : 'Pulang'}
      </p>
      <p className="text-sm" style={{ color: 'var(--kosong)' }}>
        {tanggalIndonesiaDariYmd(item.tanggal)} · {jam} · {item.lokasiNama ?? '—'}
      </p>
      <p className="text-sm" style={{ fontFamily: 'var(--mono)' }}>
        Jarak {item.jarakMeter !== null ? `${Math.round(item.jarakMeter)} meter` : '—'} · Akurasi GPS{' '}
        {item.akurasiMeter !== null ? `±${Math.round(item.akurasiMeter)} meter` : '—'}
      </p>
      <button
        type="button"
        onClick={() => void lihatFoto()}
        disabled={membukaFoto}
        className="w-fit border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44 }}
      >
        {membukaFoto ? 'Membuka…' : 'Lihat foto'}
      </button>
      <textarea
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        placeholder="Catatan (opsional)"
        className="border p-2 text-sm"
        style={{ borderColor: 'var(--garis)', minHeight: 44 }}
        rows={2}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={putuskan.isPending}
          onClick={() => putuskan.mutate({ id: item.id, diterima: false, catatan: catatan.trim() || null })}
          className="flex-1 border px-3"
          style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 48 }}
        >
          Tolak
        </button>
        <button
          type="button"
          disabled={putuskan.isPending}
          onClick={() => putuskan.mutate({ id: item.id, diterima: true, catatan: catatan.trim() || null })}
          className="flex-1 border px-3"
          style={{ borderColor: 'var(--hijau)', background: 'var(--hijau)', color: 'var(--kertas-2)', minHeight: 48 }}
        >
          Terima
        </button>
      </div>
      {putuskan.isError && (
        <p className="text-sm" style={{ color: 'var(--merah)' }}>
          {(putuskan.error as Error).message}
        </p>
      )}
    </li>
  );
}

function Isi() {
  const { data: antrean, isLoading } = useAntreanTinjauAbsen();

  if (isLoading) return <p>Memuat…</p>;

  if (!antrean || antrean.length === 0) {
    return <p style={{ color: 'var(--kosong)' }}>Tidak ada presensi di luar radius yang menunggu diperiksa.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {antrean.map((item) => (
        <Baris key={item.id} item={item} />
      ))}
    </ul>
  );
}

export default function TinjauAbsenPage() {
  const { roles, profile } = useAuth();
  const bolehHrdKadiv = roles.includes('kadiv') && profile?.divisi === 'HRD';

  return (
    <Terlindungi peran={['ceo', 'pusat']} boleh={bolehHrdKadiv}>
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-2xl" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
          Tinjau Absensi
        </h1>
        <TombolEkspor path="/api/ekspor/absensi" label="Rekap absensi bulanan" />
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Presensi 🟡 di luar radius yang belum diputuskan.
        </p>
        <Isi />
      </main>
    </Terlindungi>
  );
}
