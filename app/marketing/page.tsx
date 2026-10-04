'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Terlindungi } from '../../components/Terlindungi';
import { KerangkaTabel, KerangkaTeks } from '../../components/Kerangka';
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
import { poinMaksimalHarian, ringkasanPoinBulanan, usePteHarianBulananSemua } from '../../lib/api/pteHarian';
import { kalenderPteBulanIni } from '../../lib/kalenderPte';
import { TombolEkspor } from '../../components/TombolEkspor';
import { tanggalWIB } from '../../lib/tanggal';
import { marketingAktif, PESAN_MARKETING_NONAKTIF } from '../../lib/marketing';

const IKON: Record<'hijau' | 'kuning' | 'merah', string> = { hijau: '🟢', kuning: '🟡', merah: '🔴' };
const WARNA_HARI: Record<string, string> = {
  lengkap: 'var(--hijau)',
  bolong: 'var(--merah)',
  bukan_wajib: 'var(--permukaan)',
  akan_datang: 'var(--permukaan)',
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

  if (!policy) return <KerangkaTeks baris={2} />;

  return (
    <div className="flex flex-col gap-3">
      <p className="judul-seksi">
        Kalender {tahun}-{bulan}
      </p>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {kalender.map((h) => (
          <div
            key={h.tanggal}
            title={`${h.tanggal} -- ${h.status}`}
            className="flex items-center justify-center text-xs font-bold rounded-xl shadow-[var(--bayangan-neumo-sm)]"
            style={{
              background: WARNA_HARI[h.status],
              color: h.status === 'lengkap' || h.status === 'bolong' ? '#FFFFFF' : 'var(--tinta)',
              minHeight: 38,
              fontFamily: 'var(--mono)',
            }}
          >
            {Number(h.tanggal.slice(-2))}
          </div>
        ))}
      </div>
      <p className="text-xs" style={{ color: 'var(--kosong)' }}>
        🟩 Lengkap · 🟥 Bolong · Netral = bukan hari wajib atau belum terjadi.
      </p>
    </div>
  );
}

function Isi() {
  const { data: policy } = usePolicy();
  const { data: semua, isLoading } = useMarketingBulananSemua();
  const { data: poinBulananSemua } = usePteHarianBulananSemua();
  const [divisiFilter, setDivisiFilter] = useState<string>('semua');
  const [urutan, setUrutan] = useState<'tertinggal' | 'nama'>('tertinggal');
  const [terpilih, setTerpilih] = useState<ProgresBulanan | null>(null);

  const closingTarget = policy ? Number(policy.closing_target) : 2;
  const poinMaksimal = policy ? poinMaksimalHarian(policy) : 80;

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

  if (isLoading || !policy) return <KerangkaTabel baris={5} kolom={7} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm font-semibold text-[var(--label)] flex items-center gap-2">
          Divisi:
          <select value={divisiFilter} onChange={(e) => setDivisiFilter(e.target.value)} className="text-sm font-medium">
            {daftarDivisi.map((d) => (
              <option key={d} value={d}>
                {d === 'semua' ? 'Semua divisi' : d}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1.5 p-1 rounded-2xl neumo-inset-sm">
          <span className="text-xs font-semibold text-[var(--label)] px-2">Urutkan:</span>
          <button
            type="button"
            onClick={() => setUrutan('tertinggal')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              urutan === 'tertinggal'
                ? 'nav-pil-aktif'
                : 'text-[var(--tinta)] hover:text-[var(--biru-2)] hover:bg-[var(--permukaan)]'
            }`}
          >
            Paling tertinggal
          </button>
          <button
            type="button"
            onClick={() => setUrutan('nama')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              urutan === 'nama'
                ? 'nav-pil-aktif'
                : 'text-[var(--tinta)] hover:text-[var(--biru-2)] hover:bg-[var(--permukaan)]'
            }`}
          >
            Nama
          </button>
        </div>
      </div>

      <div className="neumo-kartu overflow-hidden p-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-[var(--permukaan-2)]">
                {['Nama', 'Divisi', 'Poin bulan ini', 'Hari penuh', 'Closing', 'Hari bolong', 'Bonus Rp500rb', 'Potongan Rp300rb'].map((k) => (
                  <th key={k} className="px-3.5 py-2.5 text-left text-xs font-bold text-[var(--biru)] border-b border-white/60">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {barisTersaring.map((r) => {
                const bonus = hitungKelayakanBonus(policy, r.pte_berlaku, r.hari_bolong, r.hari_lengkap, r.hari_wajib);
                const potongan = hitungPotongan(policy, r.pte_berlaku, r.closing);
                const { totalPoin, hariPenuh } = ringkasanPoinBulanan(poinBulananSemua?.get(r.user_id) ?? [], poinMaksimal);
                const targetPoinBulan = r.hari_wajib * poinMaksimal;
                const aktif = terpilih?.user_id === r.user_id;
                return (
                  <tr
                    key={r.user_id}
                    onClick={() => setTerpilih(r)}
                    className={`cursor-pointer transition-colors border-b border-white/40 ${
                      aktif ? 'bg-[var(--biru-lembut)] font-semibold' : 'hover:bg-[var(--permukaan-bersih)]'
                    }`}
                  >
                    <td className="px-3.5 py-2.5 font-semibold text-[var(--biru)]">
                      {r.nama}
                    </td>
                    <td className="px-3.5 py-2.5 text-[var(--label)]">
                      {r.divisi ?? '—'}
                    </td>
                    <td className="px-3.5 py-2.5" style={{ fontFamily: 'var(--mono)' }}>
                      {r.pte_berlaku
                        ? `${IKON[statusUndangan(totalPoin, targetPoinBulan)]} ${totalPoin}/${targetPoinBulan.toLocaleString('id-ID')}`
                        : 'Belum berlaku'}
                    </td>
                    <td className="px-3.5 py-2.5" style={{ fontFamily: 'var(--mono)' }}>
                      {r.pte_berlaku ? `${hariPenuh}/${r.hari_wajib}` : '—'}
                    </td>
                    <td className="px-3.5 py-2.5" style={{ fontFamily: 'var(--mono)' }}>
                      {IKON[statusClosing(r.closing, closingTarget)]} {r.closing}/{closingTarget}
                    </td>
                    <td className="px-3.5 py-2.5" style={{ fontFamily: 'var(--mono)', color: r.hari_bolong > 0 ? 'var(--merah)' : undefined }}>
                      {r.pte_berlaku ? r.hari_bolong : '—'}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {!bonus.berlaku ? 'Belum berlaku' : bonus.layak ? '✅' : '❌'}
                    </td>
                    <td className="px-3.5 py-2.5">
                      {!potongan.berlaku ? 'Belum berlaku' : (potongan.potongan ?? 0) > 0 ? `Rp${potongan.potongan?.toLocaleString('id-ID')} (proyeksi)` : '✅ Tidak dipotong'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {terpilih && (
        <div className="neumo-kartu p-6 flex flex-col gap-4">
          <p className="judul-seksi">
            Detail -- {terpilih.nama}
          </p>
          <KalenderKaryawan userId={terpilih.user_id} />
        </div>
      )}
    </div>
  );
}

export default function MarketingPage() {
  const { data: policy } = usePolicy();
  if (policy && !marketingAktif(policy)) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center">
        <h1 className="text-2xl font-bold text-[var(--biru)]">Kontrol Marketing</h1>
        <p style={{ maxWidth: 360 }}>{PESAN_MARKETING_NONAKTIF}</p>
      </main>
    );
  }
  return (
    <Terlindungi peran={['kontrol_marketing', 'ceo', 'pusat']}>
      <main className="mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
        <header className="neumo-kartu flex items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="tombol-lingkar text-lg font-bold" aria-label="Kembali ke Beranda">
              ‹
            </Link>
            <h1 className="sapaan">
              Kontrol Marketing
            </h1>
          </div>
        </header>
        <TombolEkspor path="/api/ekspor/marketing" label="Kepatuhan marketing bulanan" />
        <Isi />
      </main>
    </Terlindungi>
  );
}
