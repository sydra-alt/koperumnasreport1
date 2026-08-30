'use client';

import { useState } from 'react';
import { Terlindungi } from '../../../components/Terlindungi';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useAntreanTinjauCuti, usePutuskanCuti, useSignedUrlCuti, type CutiTinjau } from '../../../lib/api/cuti';
import { tanggalIndonesiaDariYmd } from '../../../lib/tanggal';

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
    <li className="flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--kuning)', borderRadius: 'var(--radius-besar)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        {item.userNama} — {LABEL_JENIS[item.jenis] ?? item.jenis}
      </p>
      <p className="text-sm" style={{ color: 'var(--kosong)' }}>
        {tanggalIndonesiaDariYmd(item.tanggalMulai)}
        {item.tanggalSelesai !== item.tanggalMulai ? ` – ${tanggalIndonesiaDariYmd(item.tanggalSelesai)}` : ''}
      </p>
      {item.keterangan && <p className="text-sm">{item.keterangan}</p>}
      {item.suratPath && (
        <button
          type="button"
          onClick={() => void lihatSurat()}
          disabled={membukaSurat}
          className="w-fit border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
        >
          {membukaSurat ? 'Membuka…' : 'Lihat surat'}
        </button>
      )}
      <textarea
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        placeholder="Catatan (opsional)"
        className="border p-2 text-sm"
        style={{ borderColor: 'var(--garis)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
        rows={2}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={putuskan.isPending}
          onClick={() => putuskan.mutate({ id: item.id, disetujui: false, catatan: catatan.trim() || null })}
          className="flex-1 border px-3"
          style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 48, borderRadius: 'var(--radius-pil)' }}
        >
          Tolak
        </button>
        <button
          type="button"
          disabled={putuskan.isPending}
          onClick={() => putuskan.mutate({ id: item.id, disetujui: true, catatan: catatan.trim() || null })}
          className="flex-1 border px-3"
          style={{ borderColor: 'var(--hijau)', background: 'var(--hijau)', color: 'var(--kertas-2)', minHeight: 48, borderRadius: 'var(--radius-pil)' }}
        >
          Setujui
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
  const { data: antrean, isLoading } = useAntreanTinjauCuti();

  if (isLoading) return <p>Memuat…</p>;

  if (!antrean || antrean.length === 0) {
    return <p style={{ color: 'var(--kosong)' }}>Tidak ada pengajuan yang menunggu persetujuan.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {antrean.map((item) => (
        <Baris key={item.id} item={item} />
      ))}
    </ul>
  );
}

export default function TinjauCutiPage() {
  const { roles, profile } = useAuth();
  // Gerbang cuti SENGAJA BEDA dari Tinjau Absensi -- ceo + is_hrd_kadiv()
  // SAJA, TANPA 'pusat' (instruksi eksplisit user, koreksi 1, 30 Agustus
  // 2026): "Peran 'pusat' TIDAK otomatis dapat akses -- kalau suatu saat ada
  // orang lain berperan pusat tanpa HRD, dia tidak boleh menyetujui cuti
  // orang." RLS cuti_select (migrasi 0025) menegakkan aturan yang sama.
  const bolehHrdKadiv = roles.includes('kadiv') && profile?.divisi === 'HRD';

  return (
    <Terlindungi peran={['ceo']} boleh={bolehHrdKadiv}>
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-2xl" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
          Tinjau Cuti / Sakit / Izin
        </h1>
        <Isi />
      </main>
    </Terlindungi>
  );
}
