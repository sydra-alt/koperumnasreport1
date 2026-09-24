import { notFound } from 'next/navigation'
import { tanggalIndonesiaDariYmd, geserTanggalYmd } from '@/lib/tanggal'
import { fetchAuditorPageData } from '@/lib/auditor/server'
import { createClient } from '@/lib/supabase/server'
import { AuditorOutletCard } from './AuditorOutletCard'

/**
 * Halaman Auditor — menampilkan data lintas-outlet untuk SATU hari bisnis.
 *
 * URL: /auditor/[tanggal]
 * Contoh: /auditor/2026-09-23
 *
 * Fitur:
 *   - Pilih tanggal (default: kemarin, WIB)
 *   - List outlet yang diassign sebagai auditor
 *   - Per outlet: Prepare, Opname buka/tutup, Penjualan, Closing, Shift issues
 *   - Tandai "sudah ditinjau" per outlet dengan catatan opsional
 *   - Hari tanpa shift: tampilkan "Belum ada shift"
 */

export default async function HalamanAuditor({
  params,
}: {
  params: Promise<{ tanggal: string }>
}) {
  const { tanggal: tanggalParam } = await params

  // Validasi format tanggal
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalParam)) {
    notFound()
  }

  // Dapatkan user dari sesi (Server Component)
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    notFound() // atau redirect ke /masuk
  }

  const userId = session.user.id
  const tanggal = tanggalParam

  // Fetch data halaman
  const { outlets, data: auditData } = await fetchAuditorPageData(userId, tanggal)

  // Jika tidak ada outlet yang diaudit, tampilkan pesan kosong
  if (outlets.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4" style={{ minHeight: '100vh', background: 'var(--latar)' }}>
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-sans)' }}>
            Auditor
          </h1>
        </header>
        <div className="flex flex-col gap-3" style={{ background: 'var(--permukaan)', borderRadius: 'var(--radius-besar)', padding: '24px' }}>
          <p className="text-base" style={{ fontFamily: 'var(--font-sans)' }}>
            Anda tidak memiliki akses ke outlet mana pun untuk audit.
          </p>
          <p className="text-sm" style={{ color: 'var(--label)', fontFamily: 'var(--font-sans)' }}>
            Mintalah administrator untuk menugaskan Anda sebagai auditor untuk outlet yang relevan.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4" style={{ minHeight: '100vh', background: 'var(--latar)' }}>
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-sans)' }}>
            Halaman Auditor
          </h1>
          <p className="text-sm" style={{ color: 'var(--label)', fontFamily: 'var(--font-sans)' }}>
            {tanggalIndonesiaDariYmd(tanggal)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/auditor/${geserTanggalYmd(tanggal, -1)}`}
            className="px-3 py-2 text-sm rounded-lg"
            style={{
              background: 'var(--permukaan-2)',
              color: 'var(--foreground)',
              borderRadius: 'var(--radius-sedang)',
              fontFamily: 'var(--font-sans)',
              minWidth: '44px',
              textAlign: 'center',
            }}
          >
            ←
          </a>
          <span className="text-sm" style={{ fontFamily: 'var(--font-sans)', color: 'var(--label)' }}>
            {tanggal}
          </span>
          <a
            href={`/auditor/${geserTanggalYmd(tanggal, 1)}`}
            className="px-3 py-2 text-sm rounded-lg"
            style={{
              background: 'var(--permukaan-2)',
              color: 'var(--foreground)',
              borderRadius: 'var(--radius-sedang)',
              fontFamily: 'var(--font-sans)',
              minWidth: '44px',
              textAlign: 'center',
            }}
          >
            →
          </a>
        </div>
      </header>

      {/* Konten */}
      <div className="flex flex-col gap-3">
        {auditData.length === 0 ? (
          <p className="p-4" style={{ color: 'var(--label)', fontFamily: 'var(--font-sans)' }}>
            Tidak ada data untuk hari ini.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {auditData.map((item) => (
              <AuditorOutletCard
                key={item.outletId}
                outletId={item.outletId}
                outletNama={item.outletNama}
                data={item}
                tanggal={tanggal}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
