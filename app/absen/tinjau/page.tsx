'use client';

import { useMemo, useState } from 'react';
import { Terlindungi } from '../../../components/Terlindungi';
import { PemilihTanggal } from '../../../components/PemilihTanggal';
import { TombolEkspor } from '../../../components/TombolEkspor';
import { KerangkaDaftarKartu } from '../../../components/Kerangka';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { usePolicy } from '../../../lib/api/policy';
import {
  usePresensiUntukTanggal,
  usePutuskanAbsensi,
  useSignedUrlAbsensi,
  type PresensiHarianRow,
} from '../../../lib/api/absensi';
import { jamWIB, tanggalWIB } from '../../../lib/tanggal';

type Filter = 'semua' | 'belum_absen' | 'terlambat' | 'luar_radius';

const FILTER_LABEL: Record<Filter, string> = {
  semua: 'Semua',
  belum_absen: 'Belum absen',
  terlambat: 'Terlambat',
  luar_radius: 'Di luar radius',
};

function statusInfo(status: 'valid' | 'di_luar_radius' | 'manual_hrd' | null): { label: string; warna: string } | null {
  if (status === null) return null;
  if (status === 'di_luar_radius') return { label: 'Di luar radius', warna: 'var(--kuning)' };
  if (status === 'manual_hrd') return { label: 'Dicatat manual HRD', warna: 'var(--biru)' };
  return { label: 'Dalam radius', warna: 'var(--hijau)' };
}

function luarRadius(b: PresensiHarianRow): boolean {
  return b.statusMasuk === 'di_luar_radius' || b.statusPulang === 'di_luar_radius';
}

function KeputusanTanda({
  label,
  id,
  keputusan,
}: {
  label: string;
  id: string;
  keputusan: 'diterima' | 'ditolak' | null;
}) {
  const putuskan = usePutuskanAbsensi();
  const [catatan, setCatatan] = useState('');

  if (keputusan) {
    return (
      <p className="text-sm" style={{ color: keputusan === 'diterima' ? 'var(--hijau)' : 'var(--merah)' }}>
        {label}: {keputusan === 'diterima' ? 'Diterima' : 'Ditolak'} HRD
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm" style={{ color: 'var(--kuning)' }}>
        {label} di luar radius, menunggu keputusan HRD.
      </p>
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
          onClick={() => putuskan.mutate({ id, diterima: false, catatan: catatan.trim() || null })}
          className="flex-1 border px-3"
          style={{ borderColor: 'var(--merah)', color: 'var(--merah)', minHeight: 44 }}
        >
          Tolak
        </button>
        <button
          type="button"
          disabled={putuskan.isPending}
          onClick={() => putuskan.mutate({ id, diterima: true, catatan: catatan.trim() || null })}
          className="flex-1 border px-3"
          style={{ borderColor: 'var(--hijau)', background: 'var(--hijau)', color: 'var(--kertas-2)', minHeight: 44 }}
        >
          Terima
        </button>
      </div>
      {putuskan.isError && (
        <p className="text-sm" style={{ color: 'var(--merah)' }}>
          {(putuskan.error as Error).message}
        </p>
      )}
    </div>
  );
}

function DetailKunjungan({
  label,
  waktu,
  status,
  fotoPath,
  lat,
  lon,
  jarakMeter,
  akurasiMeter,
  id,
  keputusanHrd,
  terlambatInfo,
}: {
  label: string;
  waktu: string | null;
  status: 'valid' | 'di_luar_radius' | 'manual_hrd' | null;
  fotoPath: string | null;
  lat: number | null;
  lon: number | null;
  jarakMeter: number | null;
  akurasiMeter: number | null;
  id: string | null;
  keputusanHrd: 'diterima' | 'ditolak' | null;
  /** Cuma diisi utk "Masuk" -- rincian penelusuran terlambat_menit (instruksi eksplisit user, 31 Agustus 2026: "angka yang menyentuh penilaian orang harus bisa ditelusuri tanpa bertanya"). */
  terlambatInfo?: { menit: number | null; jamEfektif: string | null; toleransiMenit: number | null };
}) {
  const signedUrl = useSignedUrlAbsensi();
  const [membukaFoto, setMembukaFoto] = useState(false);
  const info = statusInfo(status);

  if (!waktu || !id) {
    return (
      <div className="flex flex-col gap-1">
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{label}</p>
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>Belum ada.</p>
      </div>
    );
  }

  async function lihatFoto() {
    if (!fotoPath) return;
    setMembukaFoto(true);
    try {
      const url = await signedUrl.mutateAsync({ path: fotoPath, umurDetik: 120 });
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setMembukaFoto(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{label}</p>
        <span className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>{jamWIB(new Date(waktu))}</span>
      </div>
      {info && (
        <p className="status-teks" style={{ color: info.warna }}>
          {info.label}
        </p>
      )}
      {terlambatInfo && terlambatInfo.jamEfektif && terlambatInfo.toleransiMenit !== null && (
        <p className="text-sm" style={{ fontFamily: 'var(--mono)', color: (terlambatInfo.menit ?? 0) > 0 ? 'var(--merah)' : 'var(--label)' }}>
          Masuk {jamWIB(new Date(waktu))} · jam masuk {terlambatInfo.jamEfektif} · toleransi {terlambatInfo.toleransiMenit} menit → terlambat{' '}
          {terlambatInfo.menit ?? 0} menit
        </p>
      )}
      <p className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>
        Jarak {jarakMeter !== null ? `${Math.round(jarakMeter)} meter` : '—'} · Akurasi GPS{' '}
        {akurasiMeter !== null ? `±${Math.round(akurasiMeter)} meter` : '—'}
        {lat !== null && lon !== null ? ` · ${lat.toFixed(6)}, ${lon.toFixed(6)}` : ''}
      </p>
      <button
        type="button"
        onClick={() => void lihatFoto()}
        disabled={membukaFoto || !fotoPath}
        className="w-fit border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44 }}
      >
        {membukaFoto ? 'Membuka…' : 'Lihat foto'}
      </button>
      {status === 'di_luar_radius' && <KeputusanTanda label={label} id={id} keputusan={keputusanHrd} />}
    </div>
  );
}

function BarisPresensi({ baris, toleransiMenit }: { baris: PresensiHarianRow; toleransiMenit: number | null }) {
  const [terbuka, setTerbuka] = useState(false);
  const belumAbsen = !baris.masukId;
  const info = statusInfo(baris.statusMasuk);
  const rail = belumAbsen ? 'rail-netral' : luarRadius(baris) ? 'rail-kuning' : 'rail-hijau';

  return (
    <div className={`kartu-status ${rail} flex flex-col gap-2`}>
      <button type="button" onClick={() => setTerbuka((t) => !t)} className="flex flex-col gap-1 text-left" style={{ minHeight: 44 }}>
        <div className="flex items-baseline justify-between gap-2">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{baris.nama}</p>
          <span className="status-teks" style={{ color: belumAbsen ? 'var(--kosong)' : info?.warna }}>
            {belumAbsen ? 'Belum absen' : info?.label}
          </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--label)' }}>{baris.titikNama ?? '—'}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>
          <span>Masuk {baris.jamMasuk ? jamWIB(new Date(baris.jamMasuk)) : '—'}</span>
          <span>Pulang {baris.jamPulang ? jamWIB(new Date(baris.jamPulang)) : '—'}</span>
          {baris.terlambatMenit ? <span style={{ color: 'var(--merah)' }}>Terlambat {baris.terlambatMenit} menit</span> : null}
        </div>
      </button>

      {terbuka && (
        <div className="flex flex-col gap-4 border-t pt-3" style={{ borderColor: 'var(--garis)' }}>
          <DetailKunjungan
            label="Masuk"
            waktu={baris.jamMasuk}
            status={baris.statusMasuk}
            fotoPath={baris.masukFotoPath}
            lat={baris.masukLat}
            lon={baris.masukLon}
            jarakMeter={baris.masukJarakMeter}
            akurasiMeter={baris.masukAkurasiMeter}
            id={baris.masukId}
            keputusanHrd={baris.masukKeputusanHrd}
            terlambatInfo={{ menit: baris.terlambatMenit, jamEfektif: baris.masukJamEfektif, toleransiMenit }}
          />
          <DetailKunjungan
            label="Pulang"
            waktu={baris.jamPulang}
            status={baris.statusPulang}
            fotoPath={baris.pulangFotoPath}
            lat={baris.pulangLat}
            lon={baris.pulangLon}
            jarakMeter={baris.pulangJarakMeter}
            akurasiMeter={baris.pulangAkurasiMeter}
            id={baris.pulangId}
            keputusanHrd={baris.pulangKeputusanHrd}
          />
        </div>
      )}
    </div>
  );
}

function TinjauAbsenIsi() {
  const [tanggal, setTanggal] = useState(tanggalWIB());
  const [filter, setFilter] = useState<Filter>('semua');
  const { data: baris, isLoading } = usePresensiUntukTanggal(tanggal);
  const { data: policy } = usePolicy();
  const toleransiMenit = policy ? Number(policy.toleransi_terlambat_menit ?? 15) : null;

  const terfilter = useMemo(() => {
    const semua = baris ?? [];
    if (filter === 'belum_absen') return semua.filter((b) => !b.masukId);
    if (filter === 'terlambat') return semua.filter((b) => (b.terlambatMenit ?? 0) > 0);
    if (filter === 'luar_radius') return semua.filter(luarRadius);
    return semua;
  }, [baris, filter]);

  const jumlah = useMemo(() => {
    const semua = baris ?? [];
    return {
      total: semua.length,
      belumAbsen: semua.filter((b) => !b.masukId).length,
      terlambat: semua.filter((b) => (b.terlambatMenit ?? 0) > 0).length,
      luarRadius: semua.filter(luarRadius).length,
    };
  }, [baris]);

  return (
    <div className="flex flex-col gap-4">
      <PemilihTanggal tanggal={tanggal} onUbah={setTanggal} />
      <TombolEkspor path="/api/ekspor/absensi" label="Rekap absensi bulanan" />

      {isLoading ? (
        <KerangkaDaftarKartu jumlah={4} />
      ) : (baris ?? []).length === 0 ? (
        <p style={{ color: 'var(--kosong)' }}>Belum ada orang dengan titik absen yang ditugaskan.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="angka-besar" style={{ color: 'var(--biru)' }}>{jumlah.total - jumlah.belumAbsen}</span>
            <span className="text-sm" style={{ color: 'var(--label)' }}>dari {jumlah.total} sudah absen</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="border px-3 text-sm"
                style={{
                  borderColor: filter === f ? 'var(--biru)' : 'var(--garis)',
                  color: filter === f ? 'var(--biru)' : 'var(--label)',
                  background: filter === f ? 'var(--biru-lembut)' : 'transparent',
                  minHeight: 44,
                  borderRadius: 'var(--radius-pil)',
                }}
              >
                {FILTER_LABEL[f]}
                {f === 'belum_absen' && jumlah.belumAbsen > 0 ? ` (${jumlah.belumAbsen})` : ''}
                {f === 'terlambat' && jumlah.terlambat > 0 ? ` (${jumlah.terlambat})` : ''}
                {f === 'luar_radius' && jumlah.luarRadius > 0 ? ` (${jumlah.luarRadius})` : ''}
              </button>
            ))}
          </div>

          {terfilter.length === 0 ? (
            <p style={{ color: 'var(--kosong)' }}>Tidak ada yang cocok dengan saringan ini.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {terfilter.map((b) => (
                <BarisPresensi key={b.userId} baris={b} toleransiMenit={toleransiMenit} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
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
        <TinjauAbsenIsi />
      </main>
    </Terlindungi>
  );
}
