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
        <p className="judul-bagian mb-2">
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
        <p className="judul-bagian mb-2">
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
        <p className="judul-bagian mb-2">
          Silang-Cek Omzet Resto Hari Ini
        </p>
        {!selisihResto || selisihResto.length === 0 ? (
          <p style={{ color: 'var(--kosong)' }}>Belum ada pasangan laporan Manager Resto + Kontrol F&amp;B hari ini.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {selisihResto.map((r) => (
              <div
                key={r.outlet}
                className={`kartu-status ${r.selisih ? 'rail-kuning' : 'rail-hijau'}`}
              >
                <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{r.outlet}</p>
                <p className="text-sm" style={{ fontFamily: 'var(--mono)' }}>
                  Manager: {formatRupiah(r.versiManager ?? 0)} · Kontrol F&amp;B:{' '}
                  {formatRupiah(r.versiKontrolFnb ?? 0)}
                </p>
                <p className="text-sm status-teks" style={{ color: r.selisih ? 'var(--merah)' : 'var(--hijau)' }}>
                  {r.selisih ? `Selisih ${formatRupiah(r.selisih ?? 0)}` : 'Tidak ada selisih'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const WARNA_RAIL: Record<'belum' | 'draft' | 'selesai', string> = {
  belum: 'rail-merah',
  draft: 'rail-kuning',
  selesai: 'rail-hijau',
};
const WARNA_STATUS_TEKS: Record<'belum' | 'draft' | 'selesai', string> = {
  belum: 'var(--merah)',
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
      <div className="kartu-status rail-netral flex flex-col gap-2">
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>Hari ini hari libur</p>
        <p className="text-sm" style={{ color: 'var(--label)' }}>Tidak ada laporan yang wajib dikirim.</p>
        <Link href="/riwayat" className="tombol-sekunder" style={{ alignSelf: 'flex-start' }}>
          Lihat laporan yang sudah dikirim
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
      <div className="kartu-status rail-hijau flex flex-col gap-2">
        <p className="angka-kecil" style={{ color: 'var(--hijau)' }}>
          Semua laporan hari ini sudah dikirim
        </p>
        <Link href="/riwayat" className="tombol-sekunder" style={{ alignSelf: 'flex-start' }}>
          Lihat laporan yang sudah dikirim
        </Link>
      </div>
    );
  }

  const persen = tugas.length > 0 ? Math.round((tugasSelesai / tugas.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Ringkasan: angka besar + progress bar (DESIGN.md §5.1, §6.1) */}
      <div>
        <p className="judul-bagian">Yang perlu dikerjakan hari ini</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="angka-besar" style={{ color: 'var(--biru)' }}>
            {tugasSelesai}
          </span>
          <span className="text-sm" style={{ color: 'var(--label)' }}>
            dari {tugas.length} laporan sudah dikirim
          </span>
        </div>
        <div className="progres-bar mt-2">
          <div className="progres-bar-isi" style={{ width: `${persen}%` }} />
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--label)' }}>
          {tugasBelum.length} masih ditunggu
        </p>
      </div>

      {/* Daftar tugas dengan rail status (DESIGN.md §6.1, §4.2) */}
      <div className="flex flex-col gap-3">
        {tugasBelum.map((t) => {
          const railClass = t.lewatDeadline ? 'rail-merah' : WARNA_RAIL[t.status];
          return (
            <div
              key={`${t.formKey}-${t.scopeLabel ?? ''}`}
              className={`kartu-status ${railClass} flex flex-col gap-2`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 'var(--ukuran-isi)' }}>
                    {t.namaForm}
                    {t.scopeLabel ? ` (${t.scopeLabel})` : ''}
                  </p>
                  <p className="status-teks mt-0.5" style={{ color: t.lewatDeadline ? 'var(--merah)' : WARNA_STATUS_TEKS[t.status] }}>
                    {t.label}
                  </p>
                </div>
                <Link
                  href={`/lapor/${t.formKey}`}
                  className="tombol-utama"
                  style={{ fontSize: 14, padding: '8px 16px', minHeight: 44, flexShrink: 0 }}
                >
                  {t.tombol}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Target bulanan (DESIGN.md §6.1) */}
      {progres?.pte_berlaku && (
        <div className="kartu-status rail-biru flex flex-col gap-1">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--biru)' }}>Target bulan ini</p>
          <div className="flex gap-4">
            <div>
              <span className="angka-kecil" style={{ color: 'var(--biru)' }}>{progres.undangan}</span>
              <span className="text-sm" style={{ color: 'var(--label)' }}> dari {invitTarget}</span>
              <p className="text-sm" style={{ color: 'var(--label)' }}>Undangan</p>
            </div>
            <div>
              <span className="angka-kecil" style={{ color: 'var(--biru)' }}>{progres.closing}</span>
              <span className="text-sm" style={{ color: 'var(--label)' }}> dari {closingTarget}</span>
              <p className="text-sm" style={{ color: 'var(--label)' }}>Closing</p>
            </div>
          </div>
        </div>
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
  const semuaSudah = Boolean(masuk) && Boolean(pulang);

  function baris(label: string, data: typeof masuk) {
    if (!data) {
      return (
        <div className="flex items-center justify-between gap-2">
          <div>
            <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{label}</p>
            <p className="status-teks" style={{ color: 'var(--kosong)' }}>Belum dilakukan</p>
          </div>
        </div>
      );
    }
    const jam = new Date(data.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const luarRadius = data.status === 'di_luar_radius';
    return (
      <div className="flex items-center justify-between gap-2">
        <div>
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{label}</p>
          <p className="text-sm">
            <span style={{ fontFamily: 'var(--mono)' }}>{jam}</span>
            {' · '}
            <span className="status-teks" style={{ color: luarRadius ? 'var(--kuning)' : 'var(--hijau)' }}>
              {luarRadius ? `Di luar radius ${data.lokasiNama ?? ''}` : `Dalam radius ${data.lokasiNama ?? ''}`}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`kartu-status ${semuaSudah ? 'rail-hijau' : 'rail-netral'} flex flex-col gap-3`}>
      <p className="judul-bagian" style={{ fontSize: 'var(--ukuran-judul)' }}>Absen hari ini</p>
      <div className="flex flex-col gap-3">
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
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-angka-besar)', lineHeight: 1.2, color: 'var(--biru)' }}>
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
