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
import { hariISOWIB, jamWIB, tanggalWIB } from '../lib/tanggal';
import { poinMaksimalHarian, ringkasanPoinBulanan, usePteHarianBulanIniUntuk } from '../lib/api/pteHarian';
import { AngkaGrid } from '../components/AngkaGrid';
import { KeadaanGagal } from '../components/KeadaanGagal';
import { KerangkaBeranda, KerangkaDaftarKartu } from '../components/Kerangka';
import { usePembangunanUntukTanggal } from '../lib/api/pembangunan';
import { useKeuanganRekapUntukTanggal, useSelisihRestoUntukTanggal } from '../lib/api/dashboard';
import { useLaporanAccountingHariIni, hitungRingkasanKeuanganCeo } from '../lib/api/accounting';
import { formatRupiah } from '../lib/rupiah';
import { bolehLihatTautanPos, URL_LAPORAN_PENJUALAN_POS } from '../lib/posLink';

function DashboardCeo() {
  // 03-CALC-SPEC.md §4.3 -- v_keuangan_rekap (4 angka agregat) sengaja
  // dibaca ceo, pusat, DAN accounting; rekap pembangunan/selisih resto
  // TETAP ceo-only, spec tidak menyebutkan peran lain untuk bagian itu.
  // Gerbang UI sebelumnya cuma 'ceo' untuk SELURUH komponen ini -- bug
  // (lebih sempit dari spec, ditemukan audit Phase 2A 19 September 2026),
  // bukan bagian dari redesign Phase 2B (ditulis manual di sini, bukan
  // lewat merge/cherry-pick, supaya tidak menarik redesign yang belum
  // disetujui).
  const { roles } = useAuth();
  const bolehKeuangan = roles.includes('ceo') || roles.includes('pusat') || roles.includes('accounting');
  const bolehOperasional = roles.includes('ceo');
  const bolehTautanPos = bolehLihatTautanPos(roles);

  const { data: pembangunan } = usePembangunanUntukTanggal();
  const { data: keuangan } = useKeuanganRekapUntukTanggal();
  const { data: selisihResto } = useSelisihRestoUntukTanggal();
  const { data: laporanAccounting } = useLaporanAccountingHariIni();
  const ringkasanKeuangan = laporanAccounting ? hitungRingkasanKeuanganCeo(laporanAccounting) : null;

  return (
    <div className="flex flex-col gap-6">
      {bolehKeuangan && (
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
      )}

      {bolehTautanPos && (
        <div>
          <p className="judul-bagian mb-2">
            Penjualan Kasir (POS)
          </p>
          <div className="kartu-status rail-netral flex flex-col gap-3">
            <p className="text-sm">
              Penjualan per outlet ada di sistem kasir yang <b>terpisah</b> dari laporan ini.
            </p>
            <p className="text-sm" style={{ color: 'var(--label)' }}>
              Terbuka di tab baru dan meminta masuk sendiri dengan akun POS — sesi Anda di sini tidak menyambung ke sana.
            </p>
            <a
              className="tombol-sekunder"
              href={URL_LAPORAN_PENJUALAN_POS}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Buka Laporan Penjualan di sistem POS terpisah (tab baru, login sendiri)"
            >
              Buka Penjualan di POS ↗
            </a>
          </div>
        </div>
      )}

      {bolehOperasional && (
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
      )}

      {bolehOperasional && (
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
      )}
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
  const { assignments, roles, authGagal, refetchAuth, session } = useAuth();
  const { data: policy, isError: policyGagal, refetch: refetchPolicy } = usePolicy();
  const { data: lokasi } = useDaftarLokasi();
  const { data: outlet } = useDaftarOutlet();
  const { data: shift } = useDaftarShift();
  const { data: laporanHariIni, isLoading, isError: laporanGagal, refetch: refetchLaporan } = useLaporanHariIniSaya();
  const { data: progres } = useProgresBulananSaya();
  const { data: poinBulanIni } = usePteHarianBulanIniUntuk(session?.user.id ?? null);

  // Keadaan GAGAL (query error) -- BEDA dari keadaan KOSONG (memang belum
  // ada tugas) di bawah. Tanpa ini, kegagalan jaringan/server terlihat
  // identik dengan "semua laporan sudah lengkap", yang justru paling
  // berbahaya untuk disalahartikan (instruksi eksplisit user, 30 Agustus 2026).
  // `authGagal` (lib/auth/AuthProvider.tsx) ditambahkan lewat audit Phase 2A
  // (19 September 2026) -- `assignments`/`roles` dulu bisa diam-diam jatuh
  // ke [] kalau query profil/peran/penugasan gagal, bikin "gagal muat"
  // terlihat identik dengan "memang tidak ditugaskan apa-apa".
  if (policyGagal || laporanGagal || authGagal) {
    return (
      <KeadaanGagal
        pesan="Gagal memuat tugas hari ini."
        onCoba={() => {
          void refetchPolicy();
          void refetchLaporan();
          refetchAuth();
        }}
      />
    );
  }

  if (!policy || isLoading) {
    return <KerangkaDaftarKartu />;
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
  const closingTarget = Number(policy.closing_target);
  const poinMaksimal = poinMaksimalHarian(policy);
  const hariIni = tanggalWIB();
  const poinHariIni = poinBulanIni?.find((r) => r.tanggal === hariIni) ?? null;
  const { totalPoin: poinTotalBulanIni, hariPenuh } = ringkasanPoinBulanan(poinBulanIni ?? [], poinMaksimal);
  const hariWajibBulanIni = progres?.hari_wajib ?? 0;
  const targetPoinBulanIni = hariWajibBulanIni * poinMaksimal;

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

      {/* PTE poin hari ini (MENGGANTIKAN "Undangan bulan ini" lama, 20
          September 2026) -- tanpa gerbang pte_berlaku, sama seperti panel
          serupa di LaporForm.tsx: informasi poin harian tetap berguna
          dilihat SEBELUM bonus/potongan resmi berlaku. */}
      <div className="kartu-status rail-biru flex flex-col gap-1">
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--biru)' }}>PTE poin hari ini</p>
        <div className="flex items-baseline gap-2">
          <span className="angka-kecil" style={{ color: 'var(--biru)' }}>{poinHariIni?.poin_total ?? 0}</span>
          <span className="text-sm" style={{ color: 'var(--label)' }}>dari {poinMaksimal} poin</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          Digital {poinHariIni?.poin_digital ?? 0}/{Number(policy.pte_poin_digital_per_platform) * 3} · Undangan{' '}
          {poinHariIni?.poin_undangan ?? 0}/{Number(policy.pte_poin_undangan_per_orang) * Number(policy.pte_poin_undangan_target)} · Review{' '}
          {poinHariIni?.poin_review ?? 0}/{Number(policy.pte_poin_review_lengkap)} · Kesaksian {poinHariIni?.poin_kesaksian ?? 0}/
          {Number(policy.pte_poin_kesaksian_lengkap)}
        </p>
      </div>

      {/* Akumulasi bulanan -- "hari mencapai poin penuh" LEBIH PENTING dari
          totalnya sendirian (instruksi eksplisit user, 20 September 2026):
          kekurangan satu hari tidak bisa ditutup poin besok. */}
      <div className="kartu-status rail-netral flex flex-col gap-1">
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>PTE poin bulan ini</p>
        <div className="flex items-baseline gap-2">
          <span className="angka-kecil" style={{ color: 'var(--biru)' }}>{poinTotalBulanIni}</span>
          <span className="text-sm" style={{ color: 'var(--label)' }}>
            {progres?.pte_berlaku
              ? `dari ${targetPoinBulanIni.toLocaleString('id-ID')} poin target (${hariWajibBulanIni} hari kerja)`
              : 'poin (target bulanan belum berlaku -- PTE belum dimulai)'}
          </span>
        </div>
        {progres?.pte_berlaku && (
          <p className="text-sm" style={{ color: 'var(--label)' }}>
            {hariPenuh} dari {hariWajibBulanIni} hari mencapai poin penuh
          </p>
        )}
      </div>

      {/* Closing -- TETAP TERPISAH dari poin PTE (aturan CEO: closing bonus
          sendiri >=2/bulan, bukan komponen 80 poin harian, instruksi
          eksplisit user 20 September 2026). */}
      {progres?.pte_berlaku && (
        <div className="kartu-status rail-biru flex flex-col gap-1">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--biru)' }}>Closing bulan ini</p>
          <div className="flex items-baseline gap-2">
            <span className="angka-kecil" style={{ color: 'var(--biru)' }}>{progres.closing}</span>
            <span className="text-sm" style={{ color: 'var(--label)' }}>dari {closingTarget}</span>
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
        <KerangkaBeranda />
      ) : (
        <>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-angka-besar)', lineHeight: 1.2, color: 'var(--biru)' }}>
            {sapaanWaktu(jamWIB())}, {profile?.nama ?? '—'}.
          </h1>

          <DaftarTugas />

          <StatusAbsenHariIni />

          {(roles.includes('ceo') || roles.includes('pusat') || roles.includes('accounting')) && <DashboardCeo />}
        </>
      )}
    </main>
  );
}
