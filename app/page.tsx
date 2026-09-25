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
import { hitungTugasHariIni, labelSisaWaktu, sapaanWaktu } from '../lib/tugasHariIni';
import {
  AMBANG_MENDEKATI_BAWAAN_MENIT,
  tambahUrgensi,
  urutkanBerdasarkanBatas,
  type TugasDenganUrgensi,
  type Urgensi,
} from '../lib/urgensiTugas';
import { batasJamKirim } from '../lib/api/report';
import type { PolicyMap } from '../lib/api/policy';
import { hariISOWIB, jamWIB, tanggalWIB } from '../lib/tanggal';
import {
  poinMaksimalHarian,
  ringkasanPoinBulanan,
  useAdaAturanPteDiOutlet,
  usePteHarianBulanIniUntuk,
  type PteHarianBulanRow,
} from '../lib/api/pteHarian';
import type { AngkaButir } from '../components/AngkaGrid';
import { KeadaanGagal } from '../components/KeadaanGagal';
import { KerangkaBeranda, KerangkaDaftarKartu } from '../components/Kerangka';
import { usePembangunanUntukTanggal } from '../lib/api/pembangunan';
import { useKeuanganRekapUntukTanggal } from '../lib/api/dashboard';
import { SilangCekOmzetBeranda } from '../components/SilangCekOmzet';
import { useLaporanAccountingHariIni, hitungRingkasanKeuanganCeo } from '../lib/api/accounting';
import { formatRupiah } from '../lib/rupiah';
import { bolehLihatTautanPos } from '../lib/posLink';

/**
 * Lembar angka datar untuk rekap Beranda: label kecil + angka mono, dipisah
 * garis tipis (bukan sembilan kartu berbayangan). Di HP satu kolom (baris
 * label kiri / angka kanan -- mudah dipindai ke bawah), di desktop grid.
 * `utama` = jumlah angka pertama yang diberi ukuran lebih besar.
 * Jumlah butir HARUS habis dibagi `kolom` (lihat .panel-garis di globals.css).
 * AngkaGrid (components/AngkaGrid.tsx) TIDAK diubah -- masih dipakai halaman lain.
 */
function LembarAngka({ butir, utama = 0, kolom = 3 }: { butir: AngkaButir[]; utama?: number; kolom?: 2 | 3 }) {
  return (
    <div className={`panel-garis ${kolom === 2 ? 'kolom-2' : 'kolom-3'}`}>
      {butir.map((b, i) => (
        <div key={b.label} className="sel-angka">
          <p style={{ fontSize: 13, color: 'var(--label)', lineHeight: 1.3 }}>{b.label}</p>
          <p
            style={{
              fontFamily: 'var(--mono)',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              fontSize: i < utama ? 18 : 15,
              lineHeight: 1.2,
              color: b.warna ?? 'var(--tinta)',
              textAlign: 'right',
            }}
          >
            {b.nilai}
          </p>
        </div>
      ))}
      {/* sel kosong penutup baris terakhir (desktop) supaya celah grid tidak tampak sebagai blok gelap */}
      {Array.from({ length: (kolom - (butir.length % kolom)) % kolom }, (_, i) => (
        <div key={`isi-${i}`} aria-hidden="true" className="hidden md:block" />
      ))}
    </div>
  );
}

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

  const { data: pembangunan } = usePembangunanUntukTanggal();
  const { data: keuangan } = useKeuanganRekapUntukTanggal();
  const { data: laporanAccounting } = useLaporanAccountingHariIni();
  const ringkasanKeuangan = laporanAccounting ? hitungRingkasanKeuanganCeo(laporanAccounting) : null;

  return (
    <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
      {bolehKeuangan && (
        <section className={bolehOperasional ? '' : 'lg:col-span-2'}>
          <p className="judul-seksi mb-2">
            Keuangan Hari Ini
          </p>
          {!keuangan ? (
            <p style={{ color: 'var(--kosong)' }}>Belum ada laporan Accounting hari ini.</p>
          ) : (
            <LembarAngka
              utama={3}
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
        </section>
      )}

      {bolehOperasional && (
        <section>
          <p className="judul-seksi mb-2">
            Rekap Unit Pembangunan Hari Ini
          </p>
          <LembarAngka
            kolom={2}
            butir={[
              { label: 'Sedang dibangun', nilai: String(pembangunan?.sedangDibangun ?? 0) },
              { label: 'Finishing', nilai: String(pembangunan?.finishing ?? 0) },
              { label: 'Selesai hari ini', nilai: String(pembangunan?.selesaiHariIni ?? 0) },
              { label: 'Belum mulai', nilai: String(pembangunan?.belumMulai ?? 0) },
            ]}
          />
        </section>
      )}

      {/* Silang-Cek Omzet Resto: TIGA sumber (Manager, Kontrol F&B, POS) -- lihat components/SilangCekOmzet.tsx. */}
      {/* CEO dan accounting (keputusan CEO 19 September 2026: Shabita perlu melihat perbandingan ini; RLS POS + laporan ketikan sudah mengizinkan accounting). */}
      {bolehKeuangan && (roles.includes('ceo') || roles.includes('accounting')) && (
        <section className="lg:col-span-2">
          <SilangCekOmzetBeranda tampilPos />
        </section>
      )}
    </div>
  );
}

/**
 * Tombol handoff satu pintu masuk ke dashboard pos-fnb (25 September 2026,
 * menggantikan tautan polos "buka tab baru, login sendiri" yang dulu ada di
 * DashboardCeo -- lihat lib/posLink.ts). SENGAJA di LUAR DashboardCeo/gerbang
 * peran ceo|pusat|accounting -- gelombang pertama (Ita) role-nya `karyawan`
 * biasa, jadi gerbangnya HARUS per-email (bolehLihatTautanPos), bukan
 * mewarisi gerbang peran dashboard CEO.
 */
function TombolPos() {
  const { session } = useAuth();
  if (!bolehLihatTautanPos(session?.user.email)) {
    return null;
  }

  return (
    <section>
      <p className="judul-seksi mb-2">Buka Dashboard Toko</p>
      <div className="panel panel-baris flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm">
            Buka dashboard sistem kasir (produk, stok, opname, penjualan) yang <b>terpisah</b> dari laporan ini.
          </p>
          <p className="text-sm" style={{ color: 'var(--label)' }}>
            Terbuka di tab baru -- Anda TIDAK perlu masuk lagi kalau akun toko Anda sudah disiapkan admin.
          </p>
        </div>
        <a
          className="tombol-sekunder"
          style={{ flexShrink: 0 }}
          href="/api/pos-handoff"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Buka dashboard sistem kasir di tab baru"
        >
          Buka Dashboard Toko ↗
        </a>
      </div>
    </section>
  );
}

/**
 * Warna tugas (redesign Beranda, 19 September 2026, aturan CEO): MERAH hanya
 * untuk yang SUDAH lewat batas, AMBER untuk yang mendekati batas, selain itu
 * netral. Semua dari token yang ada (rail-* di globals.css) -- tidak ada
 * warna baru. Ambang "mendekati" dan urutan lihat lib/urgensiTugas.ts.
 */
const RAIL_URGENSI: Record<Urgensi, string> = {
  lewat: 'rail-merah',
  mendekati: 'rail-kuning',
  santai: 'rail-netral',
};
const WARNA_TEKS_URGENSI: Record<Urgensi, string> = {
  lewat: 'var(--merah)',
  mendekati: 'var(--kuning)',
  santai: 'var(--label)',
};

/** "batas 18.00" / "terlambat 2 jam"; draft diberi awalan karena `hitungTugasHariIni` tidak memuat batas untuk draft. */
function labelStatusTugas(t: TugasDenganUrgensi, jam: string): string {
  const dasar = t.batas ? labelSisaWaktu(t.batas, jam).label : t.label;
  return t.status === 'draft' ? `Draft tersimpan · ${dasar}` : dasar;
}

/** Tugas PERTAMA (batas terdekat/paling terlambat): kartu besar, satu-satunya tombol berat di layar. */
function KartuTugasUtama({ t, jam }: { t: TugasDenganUrgensi; jam: string }) {
  return (
    <div className={`kartu-status ${RAIL_URGENSI[t.urgensi]} flex flex-col gap-3`} style={{ padding: '16px 18px' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm" style={{ color: 'var(--label)', fontWeight: 600 }}>Kerjakan dulu</span>
        <span className="status-teks" style={{ color: WARNA_TEKS_URGENSI[t.urgensi] }}>{labelStatusTugas(t, jam)}</span>
      </div>
      <div>
        <p style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 'var(--ukuran-judul)', lineHeight: 1.25 }}>{t.namaForm}</p>
        {t.scopeLabel && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--label)' }}>{t.scopeLabel}</p>
        )}
      </div>
      <Link href={`/lapor/${t.formKey}`} className="tombol-utama" style={{ width: '100%', maxWidth: 360, minHeight: 48 }}>
        {t.tombol}
      </Link>
    </div>
  );
}

const STATUS_BARIS: Record<Urgensi, string> = { lewat: 'status-merah', mendekati: 'status-kuning', santai: '' };

/** Tugas berikutnya: BARIS dalam satu panel (bukan kartu per tugas); tombol lebar tetap dan lebih ringan supaya judul tidak berebut ruang. */
function BarisTugas({ t, jam }: { t: TugasDenganUrgensi; jam: string }) {
  return (
    <div className={`panel-baris ${STATUS_BARIS[t.urgensi]} flex items-center gap-3`} style={{ padding: '12px 14px 12px 16px' }}>
      <div className="min-w-0 flex-1">
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 'var(--ukuran-isi)', lineHeight: 1.3 }}>{t.namaForm}</p>
        {t.scopeLabel && (
          <p style={{ fontSize: 13, color: 'var(--label)', lineHeight: 1.3 }}>{t.scopeLabel}</p>
        )}
        <p className="status-teks mt-0.5" style={{ color: WARNA_TEKS_URGENSI[t.urgensi] }}>{labelStatusTugas(t, jam)}</p>
      </div>
      <Link
        href={`/lapor/${t.formKey}`}
        className="tombol-sekunder"
        style={{ flex: '0 0 112px', width: 112, minHeight: 44, padding: '8px', fontSize: 14, whiteSpace: 'nowrap' }}
      >
        {t.tombol}
      </Link>
    </div>
  );
}

type ProgresSaya = ReturnType<typeof useProgresBulananSaya>['data'];

/**
 * PTE poin -- dirender DI LUAR cabang "masih ada tugas" (bug 19 September
 * 2026: dulu kartu ini lenyap begitu semua laporan terkirim, tepat saat
 * orang ingin melihat hasilnya). Tanpa gerbang pte_berlaku: informasi poin
 * harian tetap berguna dilihat SEBELUM bonus/potongan resmi berlaku.
 */
function BagianPte({ policy, poinBulanIni, progres }: { policy: PolicyMap; poinBulanIni: PteHarianBulanRow[] | undefined; progres: ProgresSaya }) {
  const closingTarget = Number(policy.closing_target);
  const poinMaksimal = poinMaksimalHarian(policy);
  const poinHariIni = poinBulanIni?.find((r) => r.tanggal === tanggalWIB()) ?? null;
  const { totalPoin: poinTotalBulanIni, hariPenuh } = ringkasanPoinBulanan(poinBulanIni ?? [], poinMaksimal);
  const hariWajibBulanIni = progres?.hari_wajib ?? 0;
  const targetPoinBulanIni = hariWajibBulanIni * poinMaksimal;

  return (
    <div className="panel">
      <div className="panel-baris status-biru flex flex-col gap-1">
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
      <div className="panel-baris flex flex-col gap-1">
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
        <div className="panel-baris status-biru flex flex-col gap-1">
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

function DaftarTugas() {
  const { assignments, roles, authGagal, refetchAuth, session, profile } = useAuth();
  const { data: policy, isError: policyGagal, refetch: refetchPolicy } = usePolicy();
  const { data: lokasi } = useDaftarLokasi();
  const { data: outlet } = useDaftarOutlet();
  const { data: shift } = useDaftarShift();
  const { data: laporanHariIni, isLoading, isError: laporanGagal, refetch: refetchLaporan } = useLaporanHariIniSaya();
  const { data: progres } = useProgresBulananSaya();
  const { data: poinBulanIni } = usePteHarianBulanIniUntuk(session?.user.id ?? null);
  const idOutletSaya = Array.from(new Set(assignments.map((a) => a.outlet_id).filter((id): id is string => Boolean(id))));
  const { data: adaAturanPteDiOutlet } = useAdaAturanPteDiOutlet(idOutletSaya);

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

  const jam = jamWIB();
  // hitungTugasHariIni TIDAK diubah -- hasilnya dipakai apa adanya, lalu
  // ditambah batas/urgensi hanya untuk urutan dan warna (lib/urgensiTugas.ts).
  const tugasMentah = hitungTugasHariIni(assignments, roles, laporanHariIni ?? [], policy, jam, namaLokasi, namaOutlet, namaShift, batasLaporShift);
  const tugas = tambahUrgensi(tugasMentah, {
    assignments,
    jamSekarang: jam,
    ambangMenit: Number(policy.tugas_mendekati_batas_menit ?? AMBANG_MENDEKATI_BAWAAN_MENIT),
    batasUntuk: (formKey, shiftId) => batasJamKirim(policy, formKey, shiftId ? batasLaporShift(shiftId) : null),
    labelScope: (a) =>
      [a.lokasi_id ? namaLokasi(a.lokasi_id) : a.outlet_id ? namaOutlet(a.outlet_id) : null, a.shift_id ? namaShift(a.shift_id) : null]
        .filter(Boolean)
        .join(' · ') || null,
  });
  const tugasBelum = urutkanBerdasarkanBatas(tugas.filter((t) => t.status !== 'selesai'));
  const tugasSelesai = tugas.length - tugasBelum.length;

  // Kartu PTE: HANYA untuk yang kena PTE -- (1) tidak dikecualikan Admin
  // (profile.wajib_pte) DAN (2) bekerja di outlet yang unitnya punya aturan PTE
  // (unit_bisnis.label_undangan, migrasi 0057: cuma Indosteak & Indokopi).
  // Definisi ini SENGAJA dari data yang ada: tidak ada baris assignment
  // form_key='personal_marketing' sama sekali -- tugas itu muncul dari peran
  // `karyawan`, bukan dari assignment (lihat hitungTugasHariIni).
  const tampilPte = profile?.wajib_pte !== false && adaAturanPteDiOutlet === true;
  const bagianPte = tampilPte ? <BagianPte policy={policy} poinBulanIni={poinBulanIni} progres={progres} /> : null;

  // Tata letak saja: di desktop tugas di kolom kiri (maks. 720px), PTE di kolom kanan kalau ada.
  const tataLetak = bagianPte ? 'lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:items-start' : '';

  if (tugasBelum.length === 0) {
    return (
      <div className={`grid gap-5 ${tataLetak}`}>
        <div className="kartu-status rail-hijau flex flex-col gap-2 lg:max-w-[720px]">
          <p className="angka-kecil" style={{ color: 'var(--hijau)' }}>
            Semua laporan hari ini sudah dikirim
          </p>
          <Link href="/riwayat" className="tombol-sekunder" style={{ alignSelf: 'flex-start' }}>
            Lihat laporan yang sudah dikirim
          </Link>
        </div>
        {bagianPte}
      </div>
    );
  }

  const persen = tugas.length > 0 ? Math.round((tugasSelesai / tugas.length) * 100) : 0;
  const [tugasUtama, ...tugasLain] = tugasBelum;

  return (
    <div className={`grid gap-5 ${tataLetak}`}>
      <div className="flex flex-col gap-3 lg:max-w-[720px]">
        {/* Ringkasan sengaja KECIL (bukan angka besar): yang harus menonjol
            adalah tugas pertama, bukan skornya. */}
        <div>
          <p className="judul-bagian">Yang perlu dikerjakan hari ini</p>
          <div className="progres-bar mt-2" style={{ height: 4 }}>
            <div className="progres-bar-isi" style={{ width: `${persen}%` }} />
          </div>
          <p className="text-sm mt-1.5" style={{ color: 'var(--label)' }}>
            {tugasSelesai} dari {tugas.length} laporan terkirim · {tugasBelum.length} masih ditunggu
          </p>
        </div>

        <KartuTugasUtama t={tugasUtama} jam={jam} />
        {tugasLain.length > 0 && (
          <div className="panel">
            {tugasLain.map((t) => (
              <BarisTugas key={`${t.formKey}-${t.scopeLabel ?? ''}`} t={t} jam={jam} />
            ))}
          </div>
        )}
      </div>

      {bagianPte}
    </div>
  );
}

/**
 * Status absen -- SATU BARIS ringkas di atas daftar tugas (19 September
 * 2026: dulu kartu besar di posisi ketiga, di bawah lipatan HP padahal
 * dipakai dua kali sehari). SENGAJA tetap terpisah dari "Yang perlu
 * dikerjakan hari ini" (koreksi eksplisit user, 30 Agustus 2026: "Absen
 * bukan bagian form" -- presensi, mekanisme beda total, lihat
 * app/absen/page.tsx). Seluruh baris adalah tautan ke /absen. TIDAK
 * ditampilkan kalau orangnya tidak punya titik absen (pola sama dengan
 * AbsenFab, components/KopHalaman.tsx).
 */
function AbsenRingkas() {
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

  function bagian(label: string, data: typeof masuk) {
    if (!data) return <span style={{ color: 'var(--label)' }}>{label} belum</span>;
    const jam = new Date(data.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const luarRadius = data.status === 'di_luar_radius';
    return (
      <span style={{ color: luarRadius ? 'var(--kuning)' : 'var(--hijau)', fontWeight: 600 }}>
        {label} <span style={{ fontFamily: 'var(--mono)' }}>{jam}</span>
        {luarRadius ? ' · di luar radius' : ''}
      </span>
    );
  }

  return (
    <Link
      href="/absen"
      className={`panel panel-baris ${semuaSudah ? 'status-hijau' : ''} flex items-center justify-between gap-3 md:min-w-[340px]`}
      style={{ minHeight: 48, color: 'var(--tinta)', textDecoration: 'none' }}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span style={{ fontFamily: 'var(--display)', fontWeight: 700 }}>Absen</span>
        {bagian('Masuk', masuk)}
        <span style={{ color: 'var(--label)' }} aria-hidden>·</span>
        {bagian('Pulang', pulang)}
      </div>
      <span aria-hidden style={{ color: 'var(--label)', fontSize: 20 }}>›</span>
    </Link>
  );
}

export default function Home() {
  const { profile, roles, loading } = useAuth();

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-[1120px] flex-col gap-5 px-4 py-5 md:gap-7 md:px-8 md:py-8">
      {loading ? (
        <KerangkaBeranda />
      ) : (
        <>
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
            <h1 className="sapaan">
              {sapaanWaktu(jamWIB())}, {profile?.nama ?? '—'}.
            </h1>
            <AbsenRingkas />
          </header>

          <DaftarTugas />

          <TombolPos />

          {(roles.includes('ceo') || roles.includes('pusat') || roles.includes('accounting')) && <DashboardCeo />}
        </>
      )}
    </main>
  );
}
