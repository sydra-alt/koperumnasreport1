'use client';

import { useState } from 'react';
import { Terlindungi } from '../../components/Terlindungi';
import { useAuth } from '../../lib/auth/AuthProvider';
import { jamWIB, tanggalWIB } from '../../lib/tanggal';
import { formatRupiah } from '../../lib/rupiah';
import { keteranganHpp, keteranganNilai, namaBulan, type BahanPengecualian, type LokasiAset } from '../../lib/asetPersediaan';
import { useAsetPersediaan } from '../../lib/api/asetPersediaan';

/**
 * Nilai Aset Persediaan (Pusat fase B, 8 Oktober 2026) -- baca saja untuk CEO, Admin, Ita,
 * Accounting. Rancangan: docs/KONTROL-DAN-LABA-RUGI-DESIGN-2026-10.md §4a. Angka dari SQL pos-fnb;
 * bahan tanpa harga / stok minus didaftar terpisah, tidak pernah dinilai Rp0.
 */
const label = { fontSize: 13, color: 'var(--label)', lineHeight: 1.3 } as const;
const angka = { fontVariantNumeric: 'tabular-nums' } as const;

function rapi(s: string) {
  const n = Number(s);
  return Number.isInteger(n) ? n.toLocaleString('id-ID') : Number(n.toFixed(2)).toLocaleString('id-ID');
}

function DaftarBahan({ judul, bahan }: { judul: string; bahan: BahanPengecualian[] }) {
  if (bahan.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer py-2" style={{ minHeight: 44, color: 'var(--label)' }}>{judul} ({bahan.length})</summary>
      <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--garis)' }}>
        {bahan.map((b) => (
          <li key={b.bahanId} className="flex flex-wrap justify-between gap-x-3 py-1.5">
            <span>{b.nama}</span>
            <span style={angka}>{rapi(b.qty)} {b.satuan}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function BarisLokasi({ l }: { l: LokasiAset }) {
  const adaPengecualian = l.tanpaHarga.length + l.stokMinus.length > 0;
  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-semibold">
          {l.nama}
          {l.pusat ? <span className="ml-2 px-2 py-0.5 text-xs" style={{ border: '1px solid var(--garis)', borderRadius: 999, color: 'var(--label)' }}>Pusat</span> : null}
        </span>
        <span className="font-semibold" style={angka}>{formatRupiah(l.nilai)}</span>
      </div>
      <span style={label}>
        {l.jumlahBahanBernilai} bahan bernilai
        {adaPengecualian ? ` · ${l.tanpaHarga.length} tanpa harga · ${l.stokMinus.length} stok minus` : ''}
      </span>
      <DaftarBahan judul="Ada stok, belum berharga (tidak dinilai)" bahan={l.tanpaHarga} />
      <DaftarBahan judul="Stok minus (tidak mengurangi nilai)" bahan={l.stokMinus} />
    </li>
  );
}

function Isi() {
  const bulanIni = tanggalWIB().slice(0, 7);
  const [bulan, setBulan] = useState(bulanIni);
  const { data, isLoading, isError, error } = useAsetPersediaan(bulan);
  const kNilai = data ? keteranganNilai(data.total) : null;
  const kHpp = data ? keteranganHpp(data.hpp.total) : null;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl" style={{ fontFamily: 'var(--display)', fontWeight: 700 }}>Nilai Aset Persediaan</h1>
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          Stok bahan di Pusat dan tiap outlet dikali harga rata-rata, ditambah HPP bulanan dari HPP tiap penjualan. Baca saja; angka dihitung di POS.
        </p>
      </header>
      {isLoading ? <p className="text-sm">Memuat data POS...</p> : null}
      {isError ? <p className="kartu-status rail-merah text-sm">{(error as Error).message}</p> : null}
      {data && kNilai && kHpp ? (
        <>
          <section className="flex flex-col gap-2" aria-labelledby="judul-nilai">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="judul-nilai" style={{ fontFamily: 'var(--display)', fontWeight: 700 }}>Nilai persediaan saat ini</h2>
              <span style={label}>diambil {jamWIB(new Date(data.dibuatPada))} WIB</span>
            </div>
            <p className="text-3xl font-semibold" style={angka}>{formatRupiah(data.total.nilai)}</p>
            <p className={`kartu-status ${kNilai.lengkap ? 'rail-hijau' : 'rail-kuning'} text-sm`}>{kNilai.teks}</p>
            <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--garis)' }}>
              {data.lokasi.map((l) => <BarisLokasi key={l.posOutletId} l={l} />)}
            </ul>
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="judul-hpp">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="judul-hpp" style={{ fontFamily: 'var(--display)', fontWeight: 700 }}>HPP {namaBulan(data.hpp.bulan)}</h2>
              <label className="flex items-center gap-2 text-sm">
                <span style={label}>Bulan</span>
                <input
                  id="bulan-hpp"
                  type="month"
                  value={bulan}
                  max={bulanIni}
                  onChange={(e) => e.target.value && setBulan(e.target.value)}
                  className="border px-2"
                  style={{ borderColor: 'var(--garis)', borderRadius: 8, minHeight: 44 }}
                />
              </label>
            </div>
            <p className="text-3xl font-semibold" style={angka}>{formatRupiah(data.hpp.total.hpp)}</p>
            <p className={`kartu-status ${kHpp.lengkap ? 'rail-hijau' : 'rail-kuning'} text-sm`}>{kHpp.teks}</p>
            <ul className="flex flex-col divide-y" style={{ borderColor: 'var(--garis)' }}>
              {data.hpp.perLokasi.map((h) => (
                <li key={h.posOutletId} className="flex flex-col gap-0.5 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-semibold">{h.nama}</span>
                    <span className="font-semibold" style={angka}>{formatRupiah(h.hpp)}</span>
                  </div>
                  <span style={label}>
                    {h.jumlahPenjualan} penjualan{h.penjualanHppBelumLengkap > 0 ? ` · ${h.penjualanHppBelumLengkap} HPP belum lengkap` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <p style={label}>Refund tidak mengurangi HPP. Pusat tidak menjual, jadi tidak punya baris HPP.</p>
          </section>
        </>
      ) : null}
    </main>
  );
}

export default function AsetPersediaanPage() {
  const { profile } = useAuth();
  return (
    <Terlindungi peran={['ceo', 'admin', 'accounting']} boleh={profile?.akses_semua_outlet_pos === true}>
      <Isi />
    </Terlindungi>
  );
}
