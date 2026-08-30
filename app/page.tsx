'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth/AuthProvider';
import { usePolicy } from '../lib/api/policy';
import { useDaftarLokasi } from '../lib/api/lokasi';
import { useDaftarOutlet } from '../lib/api/outlet';
import { useDaftarShift } from '../lib/api/shift';
import { useLaporanHariIniSaya } from '../lib/api/beranda';
import { useProgresBulananSaya } from '../lib/api/marketing';
import { useTitikAbsenSaya, useAbsenHariIni } from '../lib/api/absensi';
import { hitungTugasHariIni, sapaanWaktu } from '../lib/tugasHariIni';
import { hariISOWIB, jamWIB } from '../lib/tanggal';
import { AngkaGrid } from '../components/AngkaGrid';
import { KeadaanGagal } from '../components/KeadaanGagal';
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
        <p className="mb-2" style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
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
        <p className="mb-2" style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
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
        <p className="mb-2" style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
          Silang-Cek Omzet Resto Hari Ini
        </p>
        {!selisihResto || selisihResto.length === 0 ? (
          <p style={{ color: 'var(--kosong)' }}>Belum ada pasangan laporan Manager Resto + Kontrol F&amp;B hari ini.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {selisihResto.map((r) => (
              <p key={r.outlet} className="text-sm" style={{ fontFamily: 'var(--mono)' }}>
                <b style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{r.outlet}</b> -- Manager: {formatRupiah(r.versiManager ?? 0)} · Kontrol F&amp;B:{' '}
                {formatRupiah(r.versiKontrolFnb ?? 0)} ·{' '}
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
  const { data: policy, isError: policyGagal, refetch: refetchPolicy } = usePolicy();
  const { data: lokasi } = useDaftarLokasi();
  const { data: outlet } = useDaftarOutlet();
  const { data: shift } = useDaftarShift();
  const { data: laporanHariIni, isLoading, isError: laporanGagal, refetch: refetchLaporan } = useLaporanHariIniSaya();
  const { data: progres } = useProgresBulananSaya();

  // Keadaan GAGAL (query error) -- BEDA dari keadaan KOSONG (memang belum
  // ada tugas) di bawah. Tanpa ini, kegagalan jaringan/server terlihat
  // identik dengan "semua laporan sudah lengkap", yang justru paling
  // berbahaya untuk disalahartikan (instruksi eksplisit user, 30 Agustus 2026).
  if (policyGagal || laporanGagal) {
    return (
      <KeadaanGagal
        pesan="Gagal memuat tugas hari ini."
        onCoba={() => {
          void refetchPolicy();
          void refetchLaporan();
        }}
      />
    );
  }

  if (!policy || isLoading) {
    return <p>Memuat…</p>;
  }

  const namaLokasi = (id: string) => lokasi?.find((l) => l.id === id)?.nama ?? id;
  const namaOutlet = (id: string) => outlet?.find((o) => o.id === id)?.nama ?? id;
  const namaShift = (id: string) => shift?.find((s) => s.id === id)?.nama ?? id;
  const batasLaporShift = (id: string) => shift?.find((s) => s.id === id)?.batasLapor ?? null;
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

  const tugas = hitungTugasHariIni(assignments, roles, laporanHariIni ?? [], policy, jamWIB(), namaLokasi, namaOutlet, namaShift, batasLaporShift);
  const tugasBelum = tugas.filter((t) => t.status !== 'selesai');
  const tugasSelesai = tugas.length - tugasBelum.length;
  const invitTarget = Number(policy.invite_target);
  const closingTarget = Number(policy.closing_target);

  if (tugasBelum.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p>
          <b style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>Semua laporan hari ini sudah dikirim.</b>
        </p>
        <Link href="/riwayat" style={{ color: 'var(--biru-3)' }}>
          Lihat laporan yang sudah dikirim → Laporan Saya
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
          Yang perlu dikerjakan hari ini
        </p>
        {/* "sudah/target + kalimat manusia" (DESIGN.md §21) -- BUKAN cuma "2/5". */}
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          {tugasSelesai} dari {tugas.length} laporan sudah dikirim — {tugasBelum.length} masih ditunggu.
        </p>
      </div>
      {tugasBelum.map((t) => (
        <div
          key={`${t.formKey}-${t.scopeLabel ?? ''}`}
          className="flex flex-wrap items-center justify-between gap-3 border p-3"
          style={{ borderColor: t.lewatDeadline ? 'var(--merah)' : 'var(--garis)', borderRadius: 'var(--radius-besar)', minHeight: 44 }}
        >
          <div>
            <p style={{ fontFamily: 'var(--display)', fontWeight: 500 }}>
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
            style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
          >
            {t.tombol}
          </Link>
        </div>
      ))}
      {progres?.pte_berlaku && (
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          Target bulan ini — Undangan {progres.undangan} dari {invitTarget} orang, Closing {progres.closing} dari {closingTarget} konsumen.
        </p>
      )}
    </div>
  );
}

/**
 * Status absen -- SENGAJA SATU BAGIAN TERPISAH dari "Yang perlu dikerjakan
 * hari ini" di atas (koreksi eksplisit user, 30 Agustus 2026: "Absen bukan
 * bagian form" -- DESIGN.md §10.2 contoh aslinya sempat mencampur keduanya
 * jadi satu daftar bertitik, itu YANG DIKOREKSI). Absen bukan laporan
 * berbasis `assignment`/`form_key` -- ini presensi, mekanisme beda total
 * (lihat app/absen/page.tsx). Ditampilkan di sini (§10.2.3 alasan: "jangan
 * memaksa pengguna masuk ke halaman Absen hanya untuk melihat status") --
 * BUKAN ditampilkan sama sekali kalau orangnya tidak punya titik absen
 * (pola sama dengan AbsenFab, components/KopHalaman.tsx).
 */
function StatusAbsenHariIni() {
  const { session } = useAuth();
  const { data: titikSaya } = useTitikAbsenSaya(session?.user.id);
  const { data: absenHariIni, isError, refetch } = useAbsenHariIni(session?.user.id);

  if (!titikSaya || titikSaya.length === 0) return null;

  if (isError) {
    return <KeadaanGagal pesan="Gagal memuat status absen." onCoba={() => void refetch()} />;
  }

  const masuk = absenHariIni?.find((a) => a.tipe === 'masuk');
  const pulang = absenHariIni?.find((a) => a.tipe === 'pulang');

  function baris(label: string, data: typeof masuk) {
    if (!data) {
      return (
        <p>
          <b style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{label}</b>
          <br />
          <span style={{ color: 'var(--kosong)' }}>Belum dilakukan</span>
        </p>
      );
    }
    const jam = new Date(data.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    return (
      <p>
        <b style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{label}</b>
        <br />
        <span style={{ fontFamily: 'var(--mono)' }}>{jam}</span> ·{' '}
        <span style={{ color: data.status === 'di_luar_radius' ? 'var(--kuning)' : 'var(--hijau)' }}>
          {data.status === 'di_luar_radius' ? `🟡 di luar radius ${data.lokasiNama ?? ''}` : `Dalam radius ${data.lokasiNama ?? ''}`}
        </span>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 border p-3" style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)' }}>
      <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>Absen hari ini</p>
      <div className="flex flex-col gap-2 text-sm">
        {baris('Masuk', masuk)}
        {baris('Pulang', pulang)}
      </div>
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
          <h1 className="text-2xl" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
            {sapaanWaktu(jamWIB())}, {profile?.nama ?? '—'}.
          </h1>

          <DaftarTugas />

          <StatusAbsenHariIni />

          {roles.includes('ceo') && <DashboardCeo />}
        </>
      )}
    </main>
  );
}
