'use client';

import { useAuth } from '../lib/auth/AuthProvider';
import { AngkaGrid } from '../components/AngkaGrid';
import { usePembangunanHariIni, useKeuanganRekapHariIni, useSelisihResto } from '../lib/api/dashboard';
import { useLaporanAccountingHariIni, hitungRingkasanKeuanganCeo } from '../lib/api/accounting';
import { formatRupiah } from '../lib/rupiah';

function DashboardCeo() {
  const { data: pembangunan } = usePembangunanHariIni();
  const { data: keuangan } = useKeuanganRekapHariIni();
  const { data: selisihResto } = useSelisihResto();
  const { data: laporanAccounting } = useLaporanAccountingHariIni();
  const ringkasanKeuangan = laporanAccounting ? hitungRingkasanKeuanganCeo(laporanAccounting) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
          Keuangan Hari Ini
        </p>
        {!keuangan ? (
          <p style={{ color: 'var(--kosong)' }}>Belum ada laporan Accounting hari ini.</p>
        ) : (
          <AngkaGrid
            butir={[
              { label: 'Uang masuk', nilai: formatRupiah(keuangan.totalMasuk) },
              { label: 'Uang keluar', nilai: formatRupiah(keuangan.totalKeluar) },
              { label: 'Net cashflow', nilai: formatRupiah(keuangan.net), warna: keuangan.net < 0 ? 'var(--merah)' : undefined },
              ...(ringkasanKeuangan
                ? [
                    { label: 'Dana tersedia', nilai: formatRupiah(ringkasanKeuangan.danaTersedia) },
                    { label: 'Piutang', nilai: formatRupiah(ringkasanKeuangan.piutangTotal) },
                    { label: 'Kewajiban 7 hari', nilai: formatRupiah(ringkasanKeuangan.kewajiban7Hari) },
                    { label: 'Kewajiban 30 hari', nilai: formatRupiah(ringkasanKeuangan.kewajiban30Hari) },
                    {
                      label: 'Surplus/kekurangan (vs kewajiban 30 hari)',
                      nilai: formatRupiah(ringkasanKeuangan.surplusKekurangan),
                      warna: ringkasanKeuangan.surplusKekurangan < 0 ? 'var(--merah)' : undefined,
                    },
                  ]
                : []),
            ]}
          />
        )}
      </div>

      <div>
        <p className="mb-2" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
          Rekap Unit Pembangunan Hari Ini
        </p>
        <AngkaGrid
          butir={[
            { label: 'Sedang dibangun', nilai: String(pembangunan?.sedangDibangun ?? 0) },
            { label: 'Finishing', nilai: String(pembangunan?.finishing ?? 0) },
            { label: 'Selesai hari ini', nilai: String(pembangunan?.selesaiHariIni ?? 0) },
            { label: 'Belum mulai', nilai: String(pembangunan?.belumMulai ?? 0) },
          ]}
        />
      </div>

      <div>
        <p className="mb-2" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
          Silang-Cek Omzet Resto Hari Ini
        </p>
        {!selisihResto || selisihResto.length === 0 ? (
          <p style={{ color: 'var(--kosong)' }}>Belum ada pasangan laporan Manager Resto + Ita hari ini.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {selisihResto.map((r) => (
              <p key={r.outlet} className="text-sm" style={{ fontFamily: 'var(--mono)' }}>
                <b style={{ fontFamily: 'var(--display)' }}>{r.outlet}</b> -- Manager: {formatRupiah(r.versiManager ?? 0)} · Ita:{' '}
                {formatRupiah(r.versiIta ?? 0)} ·{' '}
                <span style={{ color: r.selisih ? 'var(--merah)' : 'var(--hijau)' }}>selisih {formatRupiah(r.selisih ?? 0)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { profile, roles, loading } = useAuth();

  return (
    <main className="flex min-h-svh flex-col gap-6 p-6">
      <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
        Beranda
      </h1>
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <>
          <p>Masuk sebagai: {profile?.nama ?? '(profil belum termuat)'}</p>
          <p>Peran: {roles.length > 0 ? roles.join(', ') : '(belum ada peran)'}</p>
          {roles.includes('ceo') && <DashboardCeo />}
        </>
      )}
    </main>
  );
}
