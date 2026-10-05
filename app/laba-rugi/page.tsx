'use client';

import { useEffect, useState, useTransition } from 'react';
import { Terlindungi } from '../../components/Terlindungi';
import { useAuth } from '../../lib/auth/AuthProvider';
import { tanggalWIB } from '../../lib/tanggal';
import { namaBulan } from '../../lib/asetPersediaan';
import {
  buatRingkasanWhatsApp,
  formatRupiah,
  type KategoriBiaya,
  type LabaRugiKonsolidasi,
  type OutletPnlView,
} from '../../lib/labaRugi';

const labelStyle = { fontSize: 13, color: 'var(--label)', lineHeight: 1.4 } as const;
const numStyle = { fontVariantNumeric: 'tabular-nums' } as const;

export default function LabaRugiPage() {
  const { roles, assignments, profile } = useAuth();
  const [bulan, setBulan] = useState('2026-09');
  const [activeTab, setActiveTab] = useState('konsolidasi'); // 'konsolidasi' | outletId
  const [data, setData] = useState<LabaRugiKonsolidasi | null>(null);
  const [kategoriList, setKategoriList] = useState<KategoriBiaya[]>([]);
  const [isCeoOnly, setIsCeoOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pesanSukses, setPesanSukses] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Modals state
  const [modalBiayaBuka, setModalBiayaBuka] = useState(false);
  const [inputKategoriId, setInputKategoriId] = useState('');
  const [inputJumlahBiaya, setInputJumlahBiaya] = useState('');
  const [inputCatatanBiaya, setInputCatatanBiaya] = useState('');

  const [modalManualBuka, setModalManualBuka] = useState(false);
  const [manualOmzetMakanan, setManualOmzetMakanan] = useState('');
  const [manualOmzetMinuman, setManualOmzetMinuman] = useState('');
  const [manualOmzetThrift, setManualOmzetThrift] = useState('');
  const [manualHppMakanan, setManualHppMakanan] = useState('');
  const [manualHppMinuman, setManualHppMinuman] = useState('');
  const [manualHppThrift, setManualHppThrift] = useState('');
  const [manualStokAwalThrift, setManualStokAwalThrift] = useState('');
  const [manualPembelianThrift, setManualPembelianThrift] = useState('');
  const [manualStokAkhirThrift, setManualStokAkhirThrift] = useState('');
  const [manualCatatan, setManualCatatan] = useState('');

  const [modalTinjauBuka, setModalTinjauBuka] = useState(false);
  const [catatanTinjau, setCatatanTinjau] = useState('');

  const [modalFinalBuka, setModalFinalBuka] = useState(false);
  const [catatanFinal, setCatatanFinal] = useState('');
  const [catatanKualitas, setCatatanKualitas] = useState('');

  const [modalBukaKembali, setModalBukaKembali] = useState(false);
  const [alasanBukaKembali, setAlasanBukaKembali] = useState('');

  const isCeo = roles.includes('ceo');
  const isAdmin = roles.includes('admin');
  const isAccounting = roles.includes('accounting');
  const isIta =
    Boolean(profile?.akses_semua_outlet_pos) ||
    assignments.some((a) => a.form_key === 'kontrol_fnb') ||
    profile?.nama?.toLowerCase().includes('ita');

  const bolehUbahBiaya = isAccounting || isAdmin;
  const bolehTinjau = isIta || isAdmin;
  const bolehFinalkan = isAccounting || isAdmin;
  const bolehBukaKembali = isCeo || isAdmin;

  const muatData = async (targetBulan: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/laba-rugi?bulan=${targetBulan}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? `Gagal memuat data (${res.status})`);
        setData(null);
      } else {
        setData(json.data);
        setKategoriList(json.kategoriBiaya ?? []);
        setIsCeoOnly(Boolean(json.isCeoOnly));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kesalahan jaringan');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    muatData(bulan);
  }, [bulan]);

  const kirimAksi = async (action: string, args: Record<string, any>, outletIdTarget?: string) => {
    setError(null);
    setPesanSukses(null);
    try {
      const res = await fetch('/api/laba-rugi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          bulan,
          outletId: outletIdTarget ?? (activeTab === 'konsolidasi' ? undefined : activeTab),
          args,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Gagal memproses aksi');
      } else {
        setPesanSukses('Aksi berhasil disimpan.');
        await muatData(bulan);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kesalahan server');
    }
  };

  const currentOutlet: OutletPnlView | undefined =
    activeTab === 'konsolidasi' ? undefined : data?.outlets.find((o) => o.outletId === activeTab);

  const isCurrentFinal = currentOutlet?.status === 'final_akunting';

  const salinWa = () => {
    if (!data) return;
    const teks = buatRingkasanWhatsApp(data, activeTab === 'konsolidasi' ? 'Semua Outlet' : currentOutlet?.outletNama);
    navigator.clipboard.writeText(teks);
    setPesanSukses('Ringkasan WhatsApp berhasil disalin ke clipboard!');
  };

  return (
    <Terlindungi peran={['ceo', 'admin', 'accounting']} boleh={isIta}>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
        {/* Header Title & Controls */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Laba Rugi Bulanan</h1>
            <p style={labelStyle}>
              Laporan keuangan berkala per outlet & konsolidasi (Sistem Laporan Koperumnas Group)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium" style={{ color: 'var(--label)' }}>
              Bulan:
            </label>
            <input
              type="month"
              value={bulan}
              max={tanggalWIB().slice(0, 7)}
              onChange={(e) => setBulan(e.target.value)}
              className="rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)', minHeight: 40 }}
            />
            <button
              onClick={() => muatData(bulan)}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: 'var(--garis)', minHeight: 40 }}
            >
              Segarkan
            </button>
            <a
              href={`/api/laba-rugi/export?bulan=${bulan}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              style={{ minHeight: 40, display: 'inline-flex', alignItems: 'center' }}
            >
              Unduh Excel (.xlsx)
            </a>
            <button
              onClick={salinWa}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
              style={{ minHeight: 40 }}
            >
              Salin Ringkasan WA
            </button>
          </div>
        </header>

        {/* Notifikasi / Error */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        )}
        {pesanSukses && (
          <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            {pesanSukses}
          </div>
        )}

        {/* Outlet Switcher Tabs */}
        {data && data.outlets.length > 0 && (
          <nav
            className="flex gap-2 overflow-x-auto pb-2"
            style={{ borderBottom: '1px solid var(--garis)' }}
            aria-label="Pilih Outlet"
          >
            <button
              onClick={() => setActiveTab('konsolidasi')}
              className={`whitespace-nowrap px-4 py-2 text-sm font-semibold transition ${
                activeTab === 'konsolidasi'
                  ? 'border-b-2 border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
              }`}
              style={{ minHeight: 44 }}
            >
              Konsolidasi (Semua Outlet)
            </button>
            {data.outlets.map((ot) => (
              <button
                key={ot.outletId}
                onClick={() => setActiveTab(ot.outletId)}
                className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2 text-sm font-semibold transition ${
                  activeTab === ot.outletId
                    ? 'border-b-2 border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
                style={{ minHeight: 44 }}
              >
                <span>{ot.outletNama}</span>
                <span
                  className="rounded-full px-1.5 py-0.2 text-[10px] uppercase font-bold"
                  style={{
                    backgroundColor:
                      ot.status === 'final_akunting'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : ot.status === 'ditinjau_ita'
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'rgba(156, 163, 175, 0.2)',
                    color:
                      ot.status === 'final_akunting'
                        ? '#059669'
                        : ot.status === 'ditinjau_ita'
                        ? '#2563eb'
                        : '#4b5563',
                  }}
                >
                  {ot.status === 'final_akunting' ? 'Final' : ot.status === 'ditinjau_ita' ? 'Ditinjau' : 'Draft'}
                </span>
              </button>
            ))}
          </nav>
        )}

        {/* Banner Pembatasan CEO jika Belum Final */}
        {isCeoOnly && currentOutlet && !isCurrentFinal && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <h2 className="text-base font-bold">Laporan Belum Berstatus Final Akunting</h2>
            <p className="mt-1 text-sm">
              Sesuai keputusan CEO, layar CEO hanya menampilkan laporan yang sudah berstatus{' '}
              <strong>Final Akunting</strong>. Status saat ini untuk {currentOutlet.outletNama} adalah{' '}
              <strong>
                {currentOutlet.status === 'ditinjau_ita' ? 'Ditinjau Ita' : 'Draft (Sedang Disiapkan)'}
              </strong>
              . Angka operasional belum dapat ditampilkan hingga proses verifikasi Akunting selesai.
            </p>
          </div>
        )}

        {/* Status & Action Bar (Saat Tab Outlet Dipilih) */}
        {currentOutlet && (
          <div
            className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
          >
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Status:</span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-bold uppercase"
                  style={{
                    backgroundColor:
                      currentOutlet.status === 'final_akunting'
                        ? '#d1fae5'
                        : currentOutlet.status === 'ditinjau_ita'
                        ? '#dbeafe'
                        : '#f3f4f6',
                    color:
                      currentOutlet.status === 'final_akunting'
                        ? '#065f46'
                        : currentOutlet.status === 'ditinjau_ita'
                        ? '#1e40af'
                        : '#374151',
                  }}
                >
                  {currentOutlet.status === 'final_akunting'
                    ? 'Final Akunting (Terkunci)'
                    : currentOutlet.status === 'ditinjau_ita'
                    ? 'Ditinjau Ita'
                    : 'Draft'}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: currentOutlet.sumber === 'manual' ? '#fef3c7' : '#e0e7ff',
                    color: currentOutlet.sumber === 'manual' ? '#92400e' : '#3730a3',
                  }}
                >
                  Sumber: {currentOutlet.sumber.toUpperCase()}
                </span>
                {currentOutlet.lastOpnameDate && (
                  <span style={labelStyle}>Opname: {currentOutlet.lastOpnameDate}</span>
                )}
              </div>
              {currentOutlet.catatanIta && (
                <p className="text-xs italic text-zinc-600 dark:text-zinc-400">
                  Catatan Ita: {currentOutlet.catatanIta}
                </p>
              )}
              {currentOutlet.catatanAkunting && (
                <p className="text-xs italic text-zinc-600 dark:text-zinc-400">
                  Catatan Akunting: {currentOutlet.catatanAkunting}
                </p>
              )}
              {currentOutlet.alasanBukaKembali && (
                <p className="text-xs italic text-amber-700 dark:text-amber-300">
                  Alasan buka kembali: {currentOutlet.alasanBukaKembali}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {!isCurrentFinal && bolehUbahBiaya && (
                <>
                  <button
                    onClick={() => {
                      setInputKategoriId(kategoriList[0]?.id ?? '');
                      setInputJumlahBiaya('');
                      setInputCatatanBiaya('');
                      setModalBiayaBuka(true);
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                    style={{ minHeight: 40 }}
                  >
                    + Input Biaya
                  </button>
                  <button
                    onClick={() => {
                      setManualOmzetMakanan(String(currentOutlet.makanan.omzet || ''));
                      setManualOmzetMinuman(String(currentOutlet.minuman.omzet || ''));
                      setManualOmzetThrift(String(currentOutlet.thrift.omzet || ''));
                      setManualHppMakanan(String(currentOutlet.makanan.hpp || ''));
                      setManualHppMinuman(String(currentOutlet.minuman.hpp || ''));
                      setManualHppThrift(String(currentOutlet.thrift.hpp || ''));
                      setManualCatatan('');
                      setModalManualBuka(true);
                    }}
                    className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ borderColor: 'var(--garis)', minHeight: 40 }}
                  >
                    Input Mode Manual
                  </button>
                </>
              )}

              {!isCurrentFinal && bolehTinjau && currentOutlet.status === 'draft' && (
                <button
                  onClick={() => {
                    setCatatanTinjau('');
                    setModalTinjauBuka(true);
                  }}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  style={{ minHeight: 40 }}
                >
                  Tandai Ditinjau Ita
                </button>
              )}

              {!isCurrentFinal && bolehFinalkan && currentOutlet.status !== 'final_akunting' && (
                <button
                  onClick={() => {
                    setCatatanFinal('');
                    setCatatanKualitas('');
                    setModalFinalBuka(true);
                  }}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
                  style={{ minHeight: 40 }}
                >
                  Tetapkan Final Akunting
                </button>
              )}

              {isCurrentFinal && bolehBukaKembali && (
                <button
                  onClick={() => {
                    setAlasanBukaKembali('');
                    setModalBukaKembali(true);
                  }}
                  className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
                  style={{ minHeight: 40 }}
                >
                  Buka Kembali Bulan Final
                </button>
              )}

              {!isCurrentFinal && bolehTinjau && currentOutlet.posOutletId && (
                <button
                  onClick={() => kirimAksi('ambil_snapshot', { posOutletId: currentOutlet.posOutletId })}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ borderColor: 'var(--garis)', minHeight: 40 }}
                >
                  Ambil Snapshot POS
                </button>
              )}

              {!isCurrentFinal && bolehUbahBiaya && currentOutlet.posOutletId && (
                <button
                  onClick={() => kirimAksi('hitung_ulang_hpp', { posOutletId: currentOutlet.posOutletId })}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ borderColor: 'var(--garis)', minHeight: 40 }}
                >
                  Hitung Ulang HPP
                </button>
              )}
            </div>
          </div>
        )}

        {/* Data Quality Warnings */}
        {data && (
          <div className="flex flex-col gap-2">
            {(activeTab === 'konsolidasi'
              ? data.konsolidasi.badges.pesanPeringatan
              : currentOutlet?.badges.pesanPeringatan ?? []
            ).map((pesan, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
              >
                <span>⚠️</span>
                <span>{pesan}</span>
              </div>
            ))}
          </div>
        )}

        {/* Headline KPI Cards */}
        {data && (!isCeoOnly || isCurrentFinal || activeTab === 'konsolidasi') && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {(() => {
              const view = activeTab === 'konsolidasi' ? data.konsolidasi : currentOutlet!;
              const omzet = view.totalPenjualan.penjualanBersih;
              const hpp = view.totalPenjualan.hpp;
              const labaKotor = view.totalPenjualan.labaKotor;
              const marginKotor = view.totalPenjualan.marginPersen;
              const biaya = view.totalBiayaOperasional;
              const labaBersih = view.labaRugiBersih;
              const marginBersih = view.marginBersihPersen;

              return (
                <>
                  <div
                    className="flex flex-col gap-1 rounded-xl border p-4"
                    style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                  >
                    <span style={labelStyle}>Omzet Bersih</span>
                    <span className="text-xl font-bold" style={numStyle}>
                      {formatRupiah(omzet)}
                    </span>
                  </div>

                  <div
                    className="flex flex-col gap-1 rounded-xl border p-4"
                    style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                  >
                    <span style={labelStyle}>HPP (Modal)</span>
                    <span className="text-xl font-bold text-red-600 dark:text-red-400" style={numStyle}>
                      {formatRupiah(hpp)}
                    </span>
                  </div>

                  <div
                    className="flex flex-col gap-1 rounded-xl border p-4"
                    style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                  >
                    <span style={labelStyle}>Laba Kotor</span>
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400" style={numStyle}>
                      {formatRupiah(labaKotor)}
                    </span>
                    <span className="text-xs text-zinc-500">{marginKotor.toFixed(1)}% margin</span>
                  </div>

                  <div
                    className="flex flex-col gap-1 rounded-xl border p-4"
                    style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                  >
                    <span style={labelStyle}>Biaya Operasional</span>
                    <span className="text-xl font-bold text-amber-600 dark:text-amber-400" style={numStyle}>
                      {formatRupiah(biaya)}
                    </span>
                  </div>

                  <div
                    className="col-span-2 flex flex-col gap-1 rounded-xl border p-4 sm:col-span-1"
                    style={{
                      borderColor: labaBersih >= 0 ? 'var(--garis)' : '#f87171',
                      backgroundColor: 'var(--kartu)',
                    }}
                  >
                    <span style={labelStyle}>Laba / Rugi Bersih</span>
                    <span
                      className={`text-xl font-extrabold ${
                        labaBersih >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}
                      style={numStyle}
                    >
                      {formatRupiah(labaBersih)}
                    </span>
                    <span className="text-xs text-zinc-500">{marginBersih.toFixed(1)}% bersih</span>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Main P&L Table (Owner's Structure) */}
        {data && (!isCeoOnly || isCurrentFinal || activeTab === 'konsolidasi') && (
          <section
            className="flex flex-col overflow-hidden rounded-xl border shadow-sm"
            style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
          >
            <div className="border-b px-5 py-4" style={{ borderColor: 'var(--garis)' }}>
              <h2 className="text-lg font-bold">
                Laporan Laba Rugi — {activeTab === 'konsolidasi' ? 'Konsolidasi Semua Outlet' : currentOutlet?.outletNama}
              </h2>
              <p style={labelStyle}>Periode {namaBulan(bulan)}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr className="border-b text-xs uppercase" style={{ borderColor: 'var(--garis)', color: 'var(--label)' }}>
                    <th className="px-5 py-3 font-semibold">Pos Laporan Keuangan</th>
                    <th className="px-4 py-3 font-semibold text-right">Makanan</th>
                    <th className="px-4 py-3 font-semibold text-right">Minuman</th>
                    <th className="px-4 py-3 font-semibold text-right">Thrift</th>
                    <th className="px-5 py-3 font-semibold text-right">Total (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--garis)' }}>
                  {(() => {
                    const view = activeTab === 'konsolidasi' ? data.konsolidasi : currentOutlet!;
                    return (
                      <>
                        {/* 1. Omzet */}
                        <tr className="bg-zinc-50/50 dark:bg-zinc-900/30">
                          <td className="px-5 py-2.5 font-medium">Penjualan Bersih (Net Sales)</td>
                          <td className="px-4 py-2.5 text-right font-medium" style={numStyle}>
                            {formatRupiah(view.makanan.penjualanBersih)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium" style={numStyle}>
                            {formatRupiah(view.minuman.penjualanBersih)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium" style={numStyle}>
                            {formatRupiah(view.thrift.penjualanBersih)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-bold" style={numStyle}>
                            {formatRupiah(view.totalPenjualan.penjualanBersih)}
                          </td>
                        </tr>

                        {/* 2. HPP */}
                        <tr>
                          <td className="px-5 py-2.5 font-medium text-red-600 dark:text-red-400">
                            − HPP / Modal Penjualan (COGS)
                          </td>
                          <td className="px-4 py-2.5 text-right text-red-600 dark:text-red-400" style={numStyle}>
                            {formatRupiah(view.makanan.hpp)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-red-600 dark:text-red-400" style={numStyle}>
                            {formatRupiah(view.minuman.hpp)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-red-600 dark:text-red-400" style={numStyle}>
                            {formatRupiah(view.thrift.hpp)}
                          </td>
                          <td className="px-5 py-2.5 text-right font-bold text-red-600 dark:text-red-400" style={numStyle}>
                            {formatRupiah(view.totalPenjualan.hpp)}
                          </td>
                        </tr>

                        {/* 3. Laba Kotor */}
                        <tr className="bg-emerald-50/60 font-bold text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100">
                          <td className="px-5 py-3">= Laba Kotor</td>
                          <td className="px-4 py-3 text-right" style={numStyle}>
                            {formatRupiah(view.makanan.labaKotor)}
                          </td>
                          <td className="px-4 py-3 text-right" style={numStyle}>
                            {formatRupiah(view.minuman.labaKotor)}
                          </td>
                          <td className="px-4 py-3 text-right" style={numStyle}>
                            {formatRupiah(view.thrift.labaKotor)}
                          </td>
                          <td className="px-5 py-3 text-right text-base" style={numStyle}>
                            {formatRupiah(view.totalPenjualan.labaKotor)}
                          </td>
                        </tr>

                        {/* 4. Biaya Operasional Header */}
                        <tr className="border-t font-semibold" style={{ borderColor: 'var(--garis)' }}>
                          <td colSpan={4} className="px-5 py-2.5 text-xs uppercase" style={{ color: 'var(--label)' }}>
                            Biaya Operasional Bulanan
                          </td>
                          <td className="px-5 py-2.5 text-right text-xs uppercase" style={{ color: 'var(--label)' }}>
                            Jumlah
                          </td>
                        </tr>

                        {/* Biaya list */}
                        {view.biayaOperasional.map((b) => (
                          <tr key={b.kategoriId} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                            <td colSpan={4} className="px-5 py-2">
                              <span className="font-medium">− {b.kategoriNama}</span>
                              {'catatan' in b && typeof (b as any).catatan === 'string' && (b as any).catatan ? (
                                <span className="ml-2 text-xs italic text-zinc-500">({(b as any).catatan})</span>
                              ) : null}
                            </td>
                            <td className="px-5 py-2 text-right" style={numStyle}>
                              {formatRupiah(b.jumlah)}
                            </td>
                          </tr>
                        ))}

                        {/* Subtotal Biaya */}
                        <tr className="border-t font-semibold" style={{ borderColor: 'var(--garis)' }}>
                          <td colSpan={4} className="px-5 py-2.5 text-amber-700 dark:text-amber-300">
                            Total Biaya Operasional
                          </td>
                          <td className="px-5 py-2.5 text-right text-amber-700 dark:text-amber-300" style={numStyle}>
                            {formatRupiah(view.totalBiayaOperasional)}
                          </td>
                        </tr>

                        {/* 5. Laba / Rugi Bersih */}
                        <tr
                          className={`border-t-2 font-extrabold ${
                            view.labaRugiBersih >= 0
                              ? 'bg-emerald-100/60 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100'
                              : 'bg-red-100/60 text-red-950 dark:bg-red-950/40 dark:text-red-100'
                          }`}
                          style={{ borderColor: 'var(--garis)' }}
                        >
                          <td colSpan={4} className="px-5 py-3 text-base">
                            = LABA / RUGI BERSIH
                          </td>
                          <td className="px-5 py-3 text-right text-lg" style={numStyle}>
                            {formatRupiah(view.labaRugiBersih)}
                          </td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Baris Kontrol Opname (Stok Awal + Pembelian - Stok Akhir) */}
        {currentOutlet && currentOutlet.sumber === 'pos' && currentOutlet.controlLine.stokAkhir !== null && (
          <section
            className="flex flex-col gap-3 rounded-xl border p-5 shadow-sm"
            style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
          >
            <h3 className="text-base font-bold">Baris Kontrol Pemakaian Aktual (Opname Fisik)</h3>
            <p style={labelStyle}>
              Membandingkan pemakaian fisik aktual (stok awal + pembelian/transfer − stok akhir) terhadap HPP resep penjualan.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-0.5 rounded-lg border p-3" style={{ borderColor: 'var(--garis)' }}>
                <span style={labelStyle}>Stok Awal</span>
                <span className="font-semibold" style={numStyle}>
                  {currentOutlet.controlLine.stokAwal !== null
                    ? formatRupiah(currentOutlet.controlLine.stokAwal)
                    : 'Belum ada snapshot'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg border p-3" style={{ borderColor: 'var(--garis)' }}>
                <span style={labelStyle}>+ Pembelian / Transfer Masuk</span>
                <span className="font-semibold text-emerald-600" style={numStyle}>
                  {formatRupiah(currentOutlet.controlLine.pembelianDanTransfer)}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg border p-3" style={{ borderColor: 'var(--garis)' }}>
                <span style={labelStyle}>− Stok Akhir (Opname)</span>
                <span className="font-semibold text-red-600" style={numStyle}>
                  {currentOutlet.controlLine.stokAkhir !== null
                    ? formatRupiah(currentOutlet.controlLine.stokAkhir)
                    : '-'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 rounded-lg border p-3" style={{ borderColor: 'var(--garis)' }}>
                <span style={labelStyle}>= Pemakaian Aktual</span>
                <span className="font-bold" style={numStyle}>
                  {currentOutlet.controlLine.pemakaianAktual !== null
                    ? formatRupiah(currentOutlet.controlLine.pemakaianAktual)
                    : '-'}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* MODAL INPUT BIAYA BULANAN */}
        {modalBiayaBuka && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              className="flex w-full max-w-md flex-col gap-4 rounded-xl border p-5 shadow-xl"
              style={{ backgroundColor: 'var(--kartu)', borderColor: 'var(--garis)' }}
            >
              <h3 className="text-lg font-bold">Input Biaya Operasional</h3>
              <div className="flex flex-col gap-1">
                <label style={labelStyle}>Kategori Biaya</label>
                <select
                  value={inputKategoriId}
                  onChange={(e) => setInputKategoriId(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                >
                  {kategoriList.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label style={labelStyle}>Jumlah (Rupiah)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={inputJumlahBiaya}
                  onChange={(e) => setInputJumlahBiaya(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label style={labelStyle}>Catatan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Pembayaran sewa via transfer BCA"
                  value={inputCatatanBiaya}
                  onChange={(e) => setInputCatatanBiaya(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                />
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setModalBiayaBuka(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: 'var(--garis)' }}
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    kirimAksi('simpan_biaya', {
                      kategoriId: inputKategoriId,
                      jumlah: Number(inputJumlahBiaya),
                      catatan: inputCatatanBiaya,
                    });
                    setModalBiayaBuka(false);
                  }}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Simpan Biaya
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL INPUT MANUAL MODE */}
        {modalManualBuka && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              className="flex w-full max-w-lg flex-col gap-4 rounded-xl border p-5 shadow-xl max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: 'var(--kartu)', borderColor: 'var(--garis)' }}
            >
              <h3 className="text-lg font-bold">Input Laba Rugi Mode Manual</h3>
              <p style={labelStyle}>
                Khusus outlet yang belum menggunakan kasir POS. Masukkan omzet dan HPP secara langsung.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label style={labelStyle}>Omzet Makanan</label>
                  <input
                    type="number"
                    value={manualOmzetMakanan}
                    onChange={(e) => setManualOmzetMakanan(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label style={labelStyle}>HPP Makanan</label>
                  <input
                    type="number"
                    value={manualHppMakanan}
                    onChange={(e) => setManualHppMakanan(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label style={labelStyle}>Omzet Minuman</label>
                  <input
                    type="number"
                    value={manualOmzetMinuman}
                    onChange={(e) => setManualOmzetMinuman(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label style={labelStyle}>HPP Minuman</label>
                  <input
                    type="number"
                    value={manualHppMinuman}
                    onChange={(e) => setManualHppMinuman(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label style={labelStyle}>Omzet Thrift</label>
                  <input
                    type="number"
                    value={manualOmzetThrift}
                    onChange={(e) => setManualOmzetThrift(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label style={labelStyle}>HPP Thrift</label>
                  <input
                    type="number"
                    value={manualHppThrift}
                    onChange={(e) => setManualHppThrift(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label style={labelStyle}>Catatan Manual (Wajib)</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan sumber draf / alasan input manual"
                  value={manualCatatan}
                  onChange={(e) => setManualCatatan(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                />
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setModalManualBuka(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: 'var(--garis)' }}
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    kirimAksi('simpan_manual', {
                      omzetMakanan: Number(manualOmzetMakanan || 0),
                      omzetMinuman: Number(manualOmzetMinuman || 0),
                      omzetThrift: Number(manualOmzetThrift || 0),
                      hppMakanan: Number(manualHppMakanan || 0),
                      hppMinuman: Number(manualHppMinuman || 0),
                      hppThrift: Number(manualHppThrift || 0),
                      catatan: manualCatatan,
                    });
                    setModalManualBuka(false);
                  }}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Simpan Manual
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL TINJAU ITA */}
        {modalTinjauBuka && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              className="flex w-full max-w-md flex-col gap-4 rounded-xl border p-5 shadow-xl"
              style={{ backgroundColor: 'var(--kartu)', borderColor: 'var(--garis)' }}
            >
              <h3 className="text-lg font-bold">Tandai Ditinjau Ita</h3>
              <p style={labelStyle}>
                Memverifikasi bahwa penjualan dan stok outlet ini sudah diperiksa dan siap diteruskan ke Akunting.
              </p>
              <div className="flex flex-col gap-1">
                <label style={labelStyle}>Catatan Pemeriksaan (Opsional)</label>
                <textarea
                  rows={3}
                  placeholder="Catatan untuk Akunting"
                  value={catatanTinjau}
                  onChange={(e) => setCatatanTinjau(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                />
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setModalTinjauBuka(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: 'var(--garis)' }}
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    kirimAksi('tinjau', { catatanIta: catatanTinjau });
                    setModalTinjauBuka(false);
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Konfirmasi Ditinjau
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL FINAL AKUNTING */}
        {modalFinalBuka && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              className="flex w-full max-w-lg flex-col gap-4 rounded-xl border p-5 shadow-xl"
              style={{ backgroundColor: 'var(--kartu)', borderColor: 'var(--garis)' }}
            >
              <h3 className="text-lg font-bold">Tetapkan Final Akunting</h3>
              <p style={labelStyle}>
                Setelah ditetapkan Final, seluruh biaya dan snapshot persediaan bulan ini akan <strong>DIKUNCI</strong> dan
                laporan dapat dilihat oleh CEO.
              </p>

              {currentOutlet?.badges.pesanPeringatan && currentOutlet.badges.pesanPeringatan.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="font-bold">Peringatan Kualitas Data:</p>
                  <ul className="mt-1 list-disc pl-4">
                    {currentOutlet.badges.pesanPeringatan.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                  <p className="mt-2 font-medium">
                    Sesuai instruksi CEO, finalisasi dengan peringatan memerlukan penjelasan tertulis di bawah:
                  </p>
                </div>
              )}

              {currentOutlet?.badges.pesanPeringatan && currentOutlet.badges.pesanPeringatan.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label style={labelStyle}>Penjelasan Kualitas Data untuk CEO (Wajib)</label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: 2 bahan tanpa harga sudah diverifikasi nilainya di bawah Rp10.000 dan tidak material."
                    value={catatanKualitas}
                    onChange={(e) => setCatatanKualitas(e.target.value)}
                    className="rounded-lg border px-3 py-2 text-sm"
                    style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label style={labelStyle}>Catatan Akunting (Opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Catatan penutupan bulan"
                  value={catatanFinal}
                  onChange={(e) => setCatatanFinal(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                />
              </div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setModalFinalBuka(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: 'var(--garis)' }}
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    kirimAksi('finalkan', {
                      catatanAkunting: catatanFinal,
                      catatanKualitasData: catatanKualitas,
                    });
                    setModalFinalBuka(false);
                  }}
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow"
                >
                  Kunci & Tetapkan Final
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL BUKA KEMBALI */}
        {modalBukaKembali && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div
              className="flex w-full max-w-md flex-col gap-4 rounded-xl border p-5 shadow-xl"
              style={{ backgroundColor: 'var(--kartu)', borderColor: 'var(--garis)' }}
            >
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400">Buka Kembali Bulan Final</h3>
              <p style={labelStyle}>
                Status akan dikembalikan ke Ditinjau Ita. Pembukaan kembali dicatat di audit log beserta alasan tertulis.
              </p>
              <div className="flex flex-col gap-1">
                <label style={labelStyle}>Alasan Buka Kembali (Wajib Diisi)</label>
                <textarea
                  rows={3}
                  placeholder="Contoh: Koreksi nota sewa atau pembatalan transaksi"
                  value={alasanBukaKembali}
                  onChange={(e) => setAlasanBukaKembali(e.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--garis)', backgroundColor: 'var(--kartu)' }}
                />
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => setModalBukaKembali(false)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium"
                  style={{ borderColor: 'var(--garis)' }}
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    kirimAksi('buka_kembali', { alasan: alasanBukaKembali });
                    setModalBukaKembali(false);
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Buka Kunci Bulan
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </Terlindungi>
  );
}
