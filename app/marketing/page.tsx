'use client';

import { useMemo, useState } from 'react';
import { Terlindungi } from '../../components/Terlindungi';
import { usePolicy } from '../../lib/api/policy';
import {
  useMarketingBulananSemua,
  useMulaiKerja,
  usePteBulanIniUntuk,
  statusUndangan,
  statusClosing,
  type ProgresBulanan,
} from '../../lib/api/marketing';
import { hitungKelayakanBonus, hitungPotongan } from '../../lib/api/pte';
import { kalenderPteBulanIni } from '../../lib/kalenderPte';
import { TombolEkspor } from '../../components/TombolEkspor';
import { tanggalWIB } from '../../lib/tanggal';

const IKON: Record<'hijau' | 'kuning' | 'merah', string> = { hijau: '🟢', kuning: '🟡', merah: '🔴' };
const WARNA_HARI: Record<string, string> = {
  lengkap: 'var(--hijau)',
  bolong: 'var(--merah)',
  bukan_wajib: 'var(--kertas)',
  akan_datang: 'var(--kertas)',
};

function KalenderKaryawan({ userId }: { userId: string }) {
  const { data: policy } = usePolicy();
  const { data: mulaiKerja } = useMulaiKerja(userId);
  const { data: pteBulanIni } = usePteBulanIniUntuk(userId);

  const pteMulaiBerlaku = (policy?.pte_mulai_berlaku as string | null | undefined) ?? null;
  const hariIni = tanggalWIB();
  const [tahun, bulan] = hariIni.split('-');

  const kalender = useMemo(() => {
    if (!policy) return [];
    const workdays = (policy.workdays as number[] | undefined) ?? [1, 2, 3, 4, 5, 6];
    return kalenderPteBulanIni(`${tahun}-${bulan}`, workdays, pteMulaiBerlaku, mulaiKerja ?? null, hariIni, pteBulanIni ?? []);
  }, [policy, tahun, bulan, pteMulaiBerlaku, mulaiKerja, hariIni, pteBulanIni]);

  if (!policy) return <p>Memuat kalender…</p>;

  return (
    <div className="flex flex-col gap-2">
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
        Kalender {tahun}-{bulan}
      </p>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {kalender.map((h) => (
          <div
            key={h.tanggal}
            title={`${h.tanggal} -- ${h.status}`}
            className="flex items-center justify-center border text-sm"
            style={{
              borderColor: 'var(--garis)',
              background: WARNA_HARI[h.status],
              color: h.status === 'lengkap' || h.status === 'bolong' ? 'var(--kertas-2)' : 'var(--tinta)',
              minHeight: 36,
              fontFamily: 'var(--mono)',
            }}
          >
            {Number(h.tanggal.slice(-2))}
          </div>
        ))}
      </div>
      <p className="text-sm" style={{ color: 'var(--kosong)' }}>
        🟩 Lengkap · 🟥 Bolong · Netral = bukan hari wajib atau belum terjadi.
      </p>
    </div>
  );
}

function Isi() {
  const { data: policy } = usePolicy();
  const { data: semua, isLoading } = useMarketingBulananSemua();
  const [divisiFilter, setDivisiFilter] = useState<string>('semua');
  const [urutan, setUrutan] = useState<'tertinggal' | 'nama'>('tertinggal');
  const [terpilih, setTerpilih] = useState<ProgresBulanan | null>(null);

  const invitTarget = policy ? Number(policy.invite_target) : 20;
  const closingTarget = policy ? Number(policy.closing_target) : 2;

  const daftarDivisi = useMemo(() => {
    const set = new Set((semua ?? []).map((r) => r.divisi ?? '(tanpa divisi)'));
    return ['semua', ...Array.from(set).sort()];
  }, [semua]);

  const barisTersaring = useMemo(() => {
    let baris = semua ?? [];
    if (divisiFilter !== 'semua') baris = baris.filter((r) => (r.divisi ?? '(tanpa divisi)') === divisiFilter);
    baris = [...baris];
    if (urutan === 'tertinggal') {
      baris.sort((a, b) => b.hari_bolong - a.hari_bolong);
    } else {
      baris.sort((a, b) => a.nama.localeCompare(b.nama));
    }
    return baris;
  }, [semua, divisiFilter, urutan]);

  if (isLoading || !policy) return <p>Memuat…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Divisi:{' '}
          <select value={divisiFilter} onChange={(e) => setDivisiFilter(e.target.value)} className="border p-2" style={{ borderColor: 'var(--garis)', minHeight: 44 }}>
            {daftarDivisi.map((d) => (
              <option key={d} value={d}>
                {d === 'semua' ? 'Semua divisi' : d}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 text-sm">
          <span>Urutkan:</span>
          <button
            type="button"
            onClick={() => setUrutan('tertinggal')}
            className="border px-2 py-1"
            style={{ borderColor: 'var(--garis)', background: urutan === 'tertinggal' ? 'var(--kertas-2)' : 'transparent', minHeight: 44 }}
          >
            Paling tertinggal
          </button>
          <button
            type="button"
            onClick={() => setUrutan('nama')}
            className="border px-2 py-1"
            style={{ borderColor: 'var(--garis)', background: urutan === 'nama' ? 'var(--kertas-2)' : 'transparent', minHeight: 44 }}
          >
            Nama
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Nama', 'Divisi', 'Undangan', 'Closing', 'Hari bolong', 'Bonus Rp500rb', 'Potongan Rp300rb'].map((k) => (
                <th key={k} className="border px-2 py-1 text-left" style={{ borderColor: 'var(--garis)', background: 'var(--kertas-2)' }}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {barisTersaring.map((r) => {
              const bonus = hitungKelayakanBonus(policy, r.pte_berlaku, r.hari_bolong, r.hari_lengkap, r.hari_wajib);
              const potongan = hitungPotongan(policy, r.pte_berlaku, r.closing);
              return (
                <tr
                  key={r.user_id}
                  onClick={() => setTerpilih(r)}
                  style={{ cursor: 'pointer', background: terpilih?.user_id === r.user_id ? 'var(--kertas-2)' : 'transparent' }}
                >
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>
                    {r.nama}
                  </td>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>
                    {r.divisi ?? '—'}
                  </td>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)', fontFamily: 'var(--mono)' }}>
                    {IKON[statusUndangan(r.undangan, invitTarget)]} {r.undangan}/{invitTarget}
                  </td>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)', fontFamily: 'var(--mono)' }}>
                    {IKON[statusClosing(r.closing, closingTarget)]} {r.closing}/{closingTarget}
                  </td>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)', fontFamily: 'var(--mono)', color: r.hari_bolong > 0 ? 'var(--merah)' : undefined }}>
                    {r.pte_berlaku ? r.hari_bolong : '—'}
                  </td>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>
                    {!bonus.berlaku ? 'Belum berlaku' : bonus.layak ? '✅' : '❌'}
                  </td>
                  <td className="border px-2 py-1" style={{ borderColor: 'var(--garis)' }}>
                    {!potongan.berlaku ? 'Belum berlaku' : (potongan.potongan ?? 0) > 0 ? `Rp${potongan.potongan?.toLocaleString('id-ID')} (proyeksi)` : '✅ Tidak dipotong'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {terpilih && (
        <div className="border p-4" style={{ borderColor: 'var(--garis)' }}>
          <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
            Detail -- {terpilih.nama}
          </p>
          <KalenderKaryawan userId={terpilih.user_id} />
        </div>
      )}
    </div>
  );
}

export default function MarketingPage() {
  return (
    <Terlindungi peran={['kontrol_marketing', 'ceo', 'pusat']}>
      <main className="flex flex-col gap-4 p-6">
        <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
          Dashboard Kontrol Marketing
        </h1>
        <TombolEkspor path="/api/ekspor/marketing" label="Kepatuhan marketing bulanan" />
        <Isi />
      </main>
    </Terlindungi>
  );
}
