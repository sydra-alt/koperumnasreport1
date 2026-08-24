'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth/AuthProvider';
import { usePolicy } from '../lib/api/policy';
import { useDaftarLokasi } from '../lib/api/lokasi';
import { useDaftarOutlet } from '../lib/api/outlet';
import { useLaporanHariIniSaya } from '../lib/api/beranda';
import { useProgresBulananSaya } from '../lib/api/marketing';
import { hitungTugasHariIni, sapaanWaktu } from '../lib/tugasHariIni';
import { hariISOWIB, jamWIB } from '../lib/tanggal';
import { AngkaGrid } from '../components/AngkaGrid';
import { usePembangunanUntukTanggal, useKeuanganRekapUntukTanggal, useSelisihRestoUntukTanggal } from '../lib/api/dashboard';
import { useLaporanAccountingHariIni, hitungRingkasanKeuanganCeo } from '../lib/api/accounting';
import { formatRupiah } from '../lib/rupiah';

function DashboardCeo() {
  const { data: pembangunan } = usePembangunanUntukTanggal();
  const { data: keuangan } = useKeuanganRekapUntukTanggal();
  const { data: selisihResto } = useSelisihRestoUntukTanggal();
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

const WARNA_LABEL: Record<'belum' | 'draft' | 'selesai', string> = {
  belum: 'var(--biru-3)',
  draft: 'var(--kuning)',
  selesai: 'var(--hijau)',
};

function DaftarTugas() {
  const { assignments, roles } = useAuth();
  const { data: policy } = usePolicy();
  const { data: lokasi } = useDaftarLokasi();
  const { data: outlet } = useDaftarOutlet();
  const { data: laporanHariIni, isLoading } = useLaporanHariIniSaya();
  const { data: progres } = useProgresBulananSaya();

  if (!policy || isLoading) {
    return <p>Memuat…</p>;
  }

  const namaLokasi = (id: string) => lokasi?.find((l) => l.id === id)?.nama ?? id;
  const namaOutlet = (id: string) => outlet?.find((o) => o.id === id)?.nama ?? id;
  const workdays = (policy.workdays as number[] | undefined) ?? [1, 2, 3, 4, 5, 6];
  const hariLibur = !workdays.includes(hariISOWIB());

  if (hariLibur) {
    return (
      <div className="flex flex-col gap-2">
        <p style={{ color: 'var(--kosong)' }}>Hari ini hari libur -- tidak ada laporan yang wajib dikirim.</p>
        <Link href="/riwayat" style={{ color: 'var(--biru-3)' }}>
          Lihat laporan yang sudah dikirim → Laporan Saya
        </Link>
      </div>
    );
  }

  const tugas = hitungTugasHariIni(assignments, roles, laporanHariIni ?? [], policy, jamWIB(), namaLokasi, namaOutlet);
  const tugasBelum = tugas.filter((t) => t.status !== 'selesai');
  const invitTarget = Number(policy.invite_target);
  const closingTarget = Number(policy.closing_target);

  if (tugasBelum.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p>✅ Laporan hari ini sudah lengkap.</p>
        <Link href="/riwayat" style={{ color: 'var(--biru-3)' }}>
          Lihat laporan yang sudah dikirim → Laporan Saya
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
        Yang perlu dikerjakan hari ini
      </p>
      {tugasBelum.map((t) => (
        <div
          key={`${t.formKey}-${t.scopeLabel ?? ''}`}
          className="flex flex-wrap items-center justify-between gap-3 border p-3"
          style={{ borderColor: 'var(--garis)', minHeight: 44 }}
        >
          <div>
            <p style={{ fontFamily: 'var(--display)' }}>
              {t.namaForm}
              {t.scopeLabel ? ` (${t.scopeLabel})` : ''}
            </p>
            <p className="text-sm" style={{ fontFamily: 'var(--mono)', color: t.lewatDeadline ? 'var(--merah)' : WARNA_LABEL[t.status] }}>
              {t.label}
            </p>
          </div>
          <Link
            href={`/lapor/${t.formKey}`}
            className="border px-4 py-2"
            style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44 }}
          >
            {t.tombol}
          </Link>
        </div>
      ))}
      {progres?.pte_berlaku && (
        <p style={{ fontFamily: 'var(--mono)' }}>
          Undangan bulan ini: {progres.undangan} / {invitTarget} · Closing bulan ini: {progres.closing} / {closingTarget}
        </p>
      )}
    </div>
  );
}

export default function Home() {
  const { profile, roles, loading } = useAuth();

  return (
    <main className="flex min-h-svh flex-col gap-6 p-6">
      {loading ? (
        <p>Memuat…</p>
      ) : (
        <>
          <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
            {sapaanWaktu(jamWIB())}, {profile?.nama ?? '—'}.
          </h1>

          <DaftarTugas />

          {roles.includes('ceo') && <DashboardCeo />}
        </>
      )}
    </main>
  );
}
