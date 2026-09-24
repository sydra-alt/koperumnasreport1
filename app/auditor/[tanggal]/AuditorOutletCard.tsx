'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tandaiTinjau, hapusTinjau } from './tandai'
import { formatRupiah } from '@/lib/rupiah'
import { jamWIB } from '@/lib/tanggal'

interface AuditorOutletCardProps {
  outletId: string;
  outletNama: string;
  data: {
    outletId: string;
    outletNama: string;
    adaShift: boolean;
    shiftInfo: { nama: string; jamMulai: string | null; jamSelesai: string | null } | null;
    kontrolFnb: {
      omzetSistem: number | null;
      cash: number | null;
      qris: number | null;
      bank: number | null;
      sesuai: 'ya' | 'tidak' | null;
      selisih: number | null;
      penyebab: string | null;
      totalUang: number | null;
      jumlahOrder: number | null;
      kameraGagal: boolean;
    } | null;
    kebersihan: {
      foto: Record<string, string | null>;
      catatan: string | null;
      status: 'draft' | 'terkirim' | 'terlambat' | null;
      submittedAt: string | null;
    } | null;
    auditStatus: {
      sudahTinjau: boolean;
      ditinjauPada: string | null;
      catatan: string | null;
    } | null;
    fotoGagal: { context: string; alasan: string }[];
  };
  tanggal: string;
}

export function AuditorOutletCard({ outletId, outletNama, data, tanggal }: AuditorOutletCardProps) {
  const [memuat, setMemuat] = useState(false)
  const [catatan, setCatatan] = useState(data.auditStatus?.catatan ?? '')
  const [menampilkanForm, setMenampilkanForm] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      setMemuat(true)
      try {
        const result = data.auditStatus?.sudahTinjau
          ? await hapusTinjau(outletId, tanggal)
          : await tandaiTinjau(outletId, tanggal, catatan || null)
        return result
      } finally {
        setMemuat(false)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditor-data', outletId, tanggal] })
      setMenampilkanForm(false)
    },
  })

  const sudahTinjau = data.auditStatus?.sudahTinjau ?? false
  const tombolLabel = sudahTinjau ? 'Batalkan tanda' : 'Tandai sudah ditinjau'
  const tombolAksi = sudahTinjau ? 'danger' : 'primary'

  return (
    <div
      className="flex flex-col gap-4"
      style={{
        background: 'var(--permukaan)',
        borderRadius: 'var(--radius-besar)',
        boxShadow: 'var(--bayangan-kartu)',
        padding: '16px',
      }}
    >
      {/* Header outlet */}
      <div className="flex items-center justify-between">
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          {outletNama}
        </h2>
        {data.adaShift && (
          <span className="px-2 py-1 text-xs rounded-full" style={{
            background: 'var(--permukaan-2)',
            color: 'var(--label)',
            borderRadius: 'var(--radius-sedang)',
            fontFamily: 'var(--font-sans)',
          }}>
            Ada shift
          </span>
        )}
      </div>

      {/* Status review */}
      <div className="flex items-center gap-2">
        {sudahTinjau && (
          <span className="flex items-center gap-1 text-sm" style={{ color: 'var(--hijau)', fontFamily: 'var(--font-sans)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Sudah ditinjau oleh Anda{' '}
            {data.auditStatus?.ditinjauPada
              ? new Date(data.auditStatus.ditinjauPada).toLocaleString('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </span>
        )}
      </div>

      {/* Shift issues */}
      {data.kontrolFnb?.kameraGagal && (
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{
          background: 'var(--merah)',
          color: 'var(--foreground)',
          borderRadius: 'var(--radius-sedang)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-sm">Kamera gagal</p>
            <p className="text-sm opacity-80" style={{ fontFamily: 'var(--font-sans)' }}>
              Ada masalah dengan kamera saat prepare
            </p>
          </div>
        </div>
      )}

      {data.kontrolFnb?.selisih !== null && data.kontrolFnb?.selisih !== 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{
          background: 'var(--kuning)',
          color: 'var(--foreground)',
          borderRadius: 'var(--radius-sedang)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-sm">Selisih kas</p>
            <p className="text-sm opacity-80" style={{ fontFamily: 'var(--font-sans)' }}>
              {data.kontrolFnb && data.kontrolFnb.selisih !== null ? formatRupiah(data.kontrolFnb.selisih) : '-'} — {data.kontrolFnb?.penyebab || 'Perlu ditelusuri'}
            </p>
          </div>
        </div>
      )}

      {/* ─── Prepare (foto + ada event) ─────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
          Prepare
        </h3>
        <div className="flex flex-col gap-2">
          {data.adaShift ? (
            <p className="text-sm" style={{ color: 'var(--hijau)', fontFamily: 'var(--font-sans)' }}>
              Ada shift hari ini
              {data.shiftInfo?.nama && ` — ${data.shiftInfo.nama}`}
            </p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--merah)', fontFamily: 'var(--font-sans)' }}>
              Tidak ada shift
            </p>
          )}
          {data.shiftInfo?.jamMulai && (
            <p className="text-sm" style={{ color: 'var(--label)', fontFamily: 'var(--font-sans)' }}>
              Jam mulai: {data.shiftInfo.jamMulai || 'Belum diisi'} · Jam selesai: {data.shiftInfo.jamSelesai || 'Belum diisi'}
            </p>
          )}
        </div>
      </section>

      {/* ─── Opname buka ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
          Opname Buka
        </h3>
        <p className="text-sm" style={{ color: 'var(--label)', fontFamily: 'var(--font-sans)' }}>
          Data opname untuk hari ini belum tersedia.
        </p>
      </section>

      {/* ─── Penjualan ────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
          Penjualan Hari Ini
        </h3>
        {data.kontrolFnb ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ fontFamily: 'var(--font-sans)' }}>Total omzet sistem</span>
              <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-sans)' }}>
                {data.kontrolFnb.omzetSistem !== null ? formatRupiah(data.kontrolFnb.omzetSistem) : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ fontFamily: 'var(--font-sans)' }}>Jumlah order</span>
              <span className="text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                {data.kontrolFnb.jumlahOrder !== null ? String(data.kontrolFnb.jumlahOrder) : '-'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm" style={{ color: 'var(--label)', fontFamily: 'var(--font-sans)' }}>
                Rincian pembayaran:
              </span>
              <div className="flex flex-wrap gap-2">
                {data.kontrolFnb.cash !== null && (
                  <span className="px-2 py-1 text-xs rounded" style={{
                    background: 'var(--permukaan-2)',
                    borderRadius: 'var(--radius-sedang)',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    Cash: {formatRupiah(data.kontrolFnb.cash)}
                  </span>
                )}
                {data.kontrolFnb.qris !== null && (
                  <span className="px-2 py-1 text-xs rounded" style={{
                    background: 'var(--permukaan-2)',
                    borderRadius: 'var(--radius-sedang)',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    QRIS: {formatRupiah(data.kontrolFnb.qris)}
                  </span>
                )}
                {data.kontrolFnb.bank !== null && (
                  <span className="px-2 py-1 text-xs rounded" style={{
                    background: 'var(--permukaan-2)',
                    borderRadius: 'var(--radius-sedang)',
                    fontFamily: 'var(--font-sans)',
                  }}>
                    Bank: {formatRupiah(data.kontrolFnb.bank)}
                  </span>
                )}
              </div>
            </div>
            {data.kontrolFnb.sesuai === 'tidak' && (
              <div className="flex items-start gap-2 p-2 rounded" style={{
                background: 'var(--kuning)',
                borderRadius: 'var(--radius-sedang)',
              }}>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }}>
                  Omzet sistem ≠ uang penjualan
                </p>
                <p className="text-sm" style={{ color: 'var(--foreground)', opacity: 0.8, fontFamily: 'var(--font-sans)' }}>
                  Selisih: {data.kontrolFnb?.selisih !== null ? formatRupiah(data.kontrolFnb.selisih) : '-'}
                  {data.kontrolFnb?.penyebab && ` — ${data.kontrolFnb.penyebab}`}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--label)', fontFamily: 'var(--font-sans)' }}>
            Belum ada laporan Kontrol F&B untuk hari ini.
          </p>
        )}
      </section>

      {/* ─── Opname tutup ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
          Opname Tutup
        </h3>
        <p className="text-sm" style={{ color: 'var(--label)', fontFamily: 'var(--font-sans)' }}>
          Data opname untuk hari ini belum tersedia.
        </p>
      </section>

      {/* ─── Closing (foto + catatan kebersihan) ─────────────────────── */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium" style={{ fontFamily: 'var(--font-sans)' }}>
          Closing
        </h3>
        {data.kebersihan ? (
          <div className="flex flex-col gap-3">
            {/* Foto */}
            <div>
              <p className="text-xs mb-2" style={{ color: 'var(--label)', fontFamily: 'var(--font-sans)' }}>
                Foto closing
              </p>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(data.kebersihan.foto).map(([slot, path]) => (
                  <div
                    key={slot}
                    className="aspect-square rounded-lg overflow-hidden"
                    style={{ background: 'var(--permukaan-2)' }}
                  >
                    {path ? (
                      <img
                        src={path}
                        alt={slot}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs" style={{
                        color: 'var(--label)',
                        fontFamily: 'var(--font-sans)',
                      }}>
                        -
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Catatan */}
            {data.kebersihan.catatan && (
              <p className="text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                {data.kebersihan.catatan}
              </p>
            )}
            {data.kebersihan.status === 'terlambat' && (
              <span className="px-2 py-1 text-xs rounded-full" style={{
                background: 'var(--merah)',
                color: 'var(--foreground)',
                borderRadius: 'var(--radius-sedang)',
                fontFamily: 'var(--font-sans)',
              }}>
                Terlambat
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--label)', fontFamily: 'var(--font-sans)' }}>
            Belum ada laporan Kebersihan untuk hari ini.
          </p>
        )}
      </section>

      {/* ─── Tombol action ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMenampilkanForm(!menampilkanForm)}
          className="flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-colors"
          style={{
            background: tombolAksi === 'primary'
              ? 'var(--hijau)'
              : 'var(--permukaan-2)',
            color: tombolAksi === 'primary' ? 'var(--foreground)' : 'var(--foreground)',
            borderRadius: 'var(--radius-sedang)',
            fontFamily: 'var(--font-sans)',
            minHeight: '44px',
          }}
        >
          {tombolLabel}
        </button>

        {menampilkanForm && (
          <div className="flex flex-col gap-2" style={{ flex: 1 }}>
            <textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan (opsional)..."
              className="w-full px-3 py-2 text-sm rounded-lg resize-none"
              style={{
                background: 'var(--permukaan-2)',
                color: 'var(--foreground)',
                borderRadius: 'var(--radius-sedang)',
                fontFamily: 'var(--font-sans)',
                border: '1px solid var(--garis)',
              }}
              rows={2}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => mutation.mutate()}
                disabled={memuat}
                className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50"
                style={{
                  background: 'var(--hijau)',
                  color: 'var(--foreground)',
                  borderRadius: 'var(--radius-sedang)',
                  fontFamily: 'var(--font-sans)',
                  minHeight: '44px',
                }}
              >
                {memuat ? 'Memproses...' : sudahTinjau ? 'Batalkan' : 'Tandai'}
              </button>
              <button
                type="button"
                onClick={() => setMenampilkanForm(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{
                  background: 'var(--permukaan-2)',
                  color: 'var(--foreground)',
                  borderRadius: 'var(--radius-sedang)',
                  fontFamily: 'var(--font-sans)',
                  minHeight: '44px',
                }}
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
