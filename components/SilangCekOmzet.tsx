'use client';

import {
  useOmzetTigaSumberUntukTanggal,
  useStatusSinkronPos,
  type OmzetTigaSumberRow,
  type PosStatus,
  type StatusSinkronPos,
} from '../lib/api/dashboard';
import { formatRupiah } from '../lib/rupiah';
import { geserTanggalYmd, tanggalIndonesiaDariYmd, tanggalWIB } from '../lib/tanggal';
import { KeadaanGagal } from './KeadaanGagal';

/**
 * Silang-Cek Omzet Resto -- TIGA sumber untuk outlet dan tanggal yang sama
 * (19 September 2026, keputusan CEO):
 *   Manager Resto (ketikan) | Kontrol F&B/Ita (ketikan) | POS (mesin) + selisih.
 * POS = angka mesin yang tidak bisa diketik siapa pun -- itulah gunanya
 * kontrol silang. SEMUA aturan (kapan selisih dihitung, kapan angka POS
 * disembunyikan karena basi, "tanpa transaksi" vs "belum ada data") dihitung
 * di database (omzet_tiga_sumber_untuk_tanggal, migrasi 0062); komponen ini
 * hanya menampilkan. Angka utama POS = "Uang diterima" (setara cara Ita
 * mengisi); "Penjualan bersih sebelum pajak" angka kedua.
 */

const RAIL: Record<'hijau' | 'kuning' | 'netral', string> = { hijau: 'rail-hijau', kuning: 'rail-kuning', netral: 'rail-netral' };

function stempel(iso: string): string {
  const d = new Date(iso);
  const tgl = d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short' });
  const jam = d.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  return `${tgl} ${jam} WIB`;
}

/** '04:00' -> '03.59' (menit terakhir hari bisnis sebelumnya). */
function menitSebelum(hhmm: string): string {
  const [j, m] = hhmm.split(':').map(Number);
  const total = (((j * 60 + m - 1) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}.${String(total % 60).padStart(2, '0')}`;
}
const titik = (hhmm: string) => hhmm.replace(':', '.');
const galatRingkas = (g: string | null) => (g ? g.replace(/[.\s]+$/, '') : 'penyebab tidak diketahui');

function teksSelisih(nama: string, nilai: number): { teks: string; warna: string } {
  if (nilai === 0) return { teks: `${nama}: sama`, warna: 'var(--hijau)' };
  return {
    teks: `${nama}: ${nilai > 0 ? 'lebih tinggi' : 'lebih rendah'} ${formatRupiah(Math.abs(nilai))}`,
    warna: 'var(--merah)',
  };
}

const TEKS_POS_KOSONG: Partial<Record<PosStatus, string>> = {
  tanpa_transaksi: 'Belum ada transaksi POS',
  belum_dipetakan: 'Outlet belum dipetakan ke POS',
  belum_pernah_sinkron: 'Belum ada data POS',
  belum_ada_data_pos: 'Belum ada data POS',
  basi: 'Data POS basi — disembunyikan',
  belum_dimulai: 'Hari bisnis belum mulai',
};

function Sel({ label, children, sub }: { label: string; children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 md:flex-col md:items-start md:justify-start md:gap-0.5">
      <p style={{ fontSize: 13, color: 'var(--label)', lineHeight: 1.3 }}>{label}</p>
      <div className="text-right md:text-left">
        {children}
        {sub}
      </div>
    </div>
  );
}

const nilaiGaya = { fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600 } as const;
const kosongGaya = { fontSize: 14, color: 'var(--kosong)' } as const;

/**
 * `datar` (dipakai Beranda saja): tiap outlet jadi BARIS dalam satu panel, bukan
 * kartu berbayangan sendiri-sendiri -- status (selisih/lengkap) tetap membawa
 * bahasa warna yang sama lewat rail 4px + latar lembut. Terpusat memakai
 * tampilan kartu lama (belum di-redesign).
 */
function KartuOutlet({ r, tampilPos, datar = false }: { r: OmzetTigaSumberRow; tampilPos: boolean; datar?: boolean }) {
  const daftar: { nama: string; nilai: number | null }[] = [
    { nama: 'Manager vs Kontrol F&B', nilai: r.selisihManagerKontrol },
    ...(tampilPos
      ? [
          { nama: 'Manager vs POS', nilai: r.selisihManagerPos },
          { nama: 'Kontrol F&B vs POS', nilai: r.selisihKontrolPos },
        ]
      : []),
  ];
  const ada = daftar.filter((s): s is { nama: string; nilai: number } => s.nilai !== null);
  const semuaAda = ada.length === daftar.length;
  const adaBeda = ada.some((s) => s.nilai !== 0);
  const rail = ada.length === 0 ? 'netral' : adaBeda ? 'kuning' : semuaAda ? 'hijau' : 'netral';

  const posAdaAngka = r.posStatus === 'final' || r.posStatus === 'berjalan';

  // Outlet yang sama sekali tidak punya angka (mis. belum dipetakan & belum ada laporan): satu baris ringkas,
  // bukan kartu penuh berisi enam kalimat "belum ada" -- di HP itu menenggelamkan outlet yang punya angka.
  if (r.manager === null && r.kontrolFnb === null && !posAdaAngka) {
    return (
      <div className={datar ? 'panel-baris flex flex-col gap-0.5' : 'kartu-status rail-netral flex flex-col gap-0.5'} style={{ padding: '10px 16px' }}>
        <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{r.outlet}</p>
        <p style={{ fontSize: 13, color: 'var(--kosong)', lineHeight: 1.35 }}>
          Belum ada laporan Manager Resto maupun Kontrol F&amp;B
          {tampilPos ? ` · ${(TEKS_POS_KOSONG[r.posStatus] ?? 'Belum ada data POS').replace(/^./, (c) => c.toLowerCase())}` : ''}
        </p>
      </div>
    );
  }

  return (
    <div className={datar ? `panel-baris ${rail === 'kuning' ? 'status-kuning' : rail === 'hijau' ? 'status-hijau' : ''} flex flex-col gap-3` : `kartu-status ${RAIL[rail]} flex flex-col gap-3`}>
      <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{r.outlet}</p>
      <div className={`grid grid-cols-1 gap-2 ${tampilPos ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <Sel label="Manager Resto · diketik">
          {r.manager === null ? <span style={kosongGaya}>Belum ada laporan</span> : <span style={nilaiGaya}>{formatRupiah(r.manager)}</span>}
        </Sel>
        <Sel label="Kontrol F&B · diketik">
          {r.kontrolFnb === null ? <span style={kosongGaya}>Belum ada laporan</span> : <span style={nilaiGaya}>{formatRupiah(r.kontrolFnb)}</span>}
        </Sel>
        {tampilPos && (
          <Sel
            label="POS · mesin · Uang diterima"
            sub={
              posAdaAngka ? (
                <>
                  {r.posStatus === 'berjalan' && (
                    <p className="status-teks" style={{ color: 'var(--kuning)' }}>sementara, hari bisnis belum tutup</p>
                  )}
                  <p style={{ fontSize: 13, color: 'var(--label)', lineHeight: 1.3 }}>
                    Penjualan bersih sebelum pajak{' '}
                    <span style={{ fontFamily: 'var(--mono)' }}>{formatRupiah(r.posPenjualanBersih ?? 0)}</span> · {r.posJumlahOrder ?? 0} order
                  </p>
                </>
              ) : undefined
            }
          >
            {posAdaAngka && r.posUangDiterima !== null ? (
              <span style={nilaiGaya}>{formatRupiah(r.posUangDiterima)}</span>
            ) : (
              <span style={kosongGaya}>{TEKS_POS_KOSONG[r.posStatus] ?? 'Belum ada data POS'}</span>
            )}
          </Sel>
        )}
      </div>
      {ada.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <p style={{ fontSize: 13, color: 'var(--label)' }}>Selisih (ketikan dibanding pembanding)</p>
          {ada.map((s) => {
            const t = teksSelisih(s.nama, s.nilai);
            return (
              <p key={s.nama} className="text-sm status-teks" style={{ color: t.warna }}>
                {t.teks}
              </p>
            );
          })}
        </div>
      )}
      {tampilPos && r.posStatus === 'berjalan' && (
        <p style={{ fontSize: 13, color: 'var(--label)' }}>Selisih dengan POS tampil setelah hari bisnis tutup.</p>
      )}
    </div>
  );
}

/** Peringatan/stempel sinkron -- SATU tempat untuk semua keadaan (belum pernah, basi, gagal, normal). */
function BannerSinkron({ status }: { status: StatusSinkronPos }) {
  const gagalTerbaru = status.percobaanStatus === 'gagal' && status.percobaanTerakhir !== null;
  const ekor = status.jumlahBelumDipetakan > 0 && (
    <p className="text-sm" style={{ color: 'var(--kuning)' }}>
      {status.jumlahBelumDipetakan} outlet POS belum dipetakan — angkanya belum masuk.
    </p>
  );

  if (!status.pernahBerhasil) {
    return (
      <div className="kartu-status rail-kuning flex flex-col gap-1">
        <p className="status-teks" style={{ color: 'var(--kuning)' }}>Data POS belum pernah ditarik</p>
        <p className="text-sm">Angka POS belum tersedia. Kolom POS ditampilkan kosong sampai sinkron pertama berhasil.</p>
        {gagalTerbaru && (
          <p className="text-sm" style={{ color: 'var(--merah)' }}>
            Percobaan terakhir gagal ({stempel(status.percobaanTerakhir!)}): {galatRingkas(status.percobaanGalat)}
          </p>
        )}
        {ekor}
      </div>
    );
  }
  if (status.basi) {
    return (
      <div className="kartu-status rail-kuning flex flex-col gap-1">
        <p className="status-teks" style={{ color: 'var(--kuning)' }}>Data POS basi — angka POS disembunyikan</p>
        <p className="text-sm">
          Sinkron berhasil terakhir {stempel(status.dataPer!)}, lebih dari {status.maksUmurJam} jam lalu.
        </p>
        {gagalTerbaru && (
          <p className="text-sm" style={{ color: 'var(--merah)' }}>
            Percobaan terakhir gagal ({stempel(status.percobaanTerakhir!)}): {galatRingkas(status.percobaanGalat)}
          </p>
        )}
        {ekor}
      </div>
    );
  }
  if (gagalTerbaru) {
    return (
      <div className="kartu-status rail-kuning flex flex-col gap-1">
        <p className="status-teks" style={{ color: 'var(--kuning)' }}>Sinkron POS terakhir gagal</p>
        <p className="text-sm">
          {stempel(status.percobaanTerakhir!)}: {galatRingkas(status.percobaanGalat)}. Angka POS di bawah dari sinkron
          berhasil sebelumnya, data POS per <b>{stempel(status.dataPer!)}</b>.
        </p>
        {ekor}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-sm" style={{ color: 'var(--label)' }}>
        Data POS per <b style={{ color: 'var(--tinta)' }}>{stempel(status.dataPer!)}</b>
      </p>
      {ekor}
    </div>
  );
}

/** Hari yang dibandingkan + batas hari POS, ditulis JELAS (bukan diam-diam beda dengan tanggal kalender). */
function CatatanHari({ rows, tampilPos }: { rows: OmzetTigaSumberRow[]; tampilPos: boolean }) {
  if (!tampilPos) return null;
  const batas = Array.from(new Set(rows.map((r) => r.posBatasHari).filter((b): b is string => Boolean(b)))).sort();
  const belumKonfirmasi = rows.filter((r) => r.posBatasHari && r.posBatasTerkonfirmasi === false).map((r) => r.outlet);
  return (
    <p style={{ fontSize: 13, color: 'var(--label)', lineHeight: 1.4 }}>
      Yang dibandingkan: laporan tanggal ini dengan <b>hari bisnis POS</b> pada tanggal yang sama.{' '}
      {batas.length === 0
        ? 'Batas hari POS belum diketahui (belum ada sinkron).'
        : batas.length === 1
          ? `Hari bisnis POS berakhir pukul ${titik(batas[0])} — transaksi pukul 00.00–${menitSebelum(batas[0])} dihitung ke hari sebelumnya.`
          : `Batas hari POS berbeda antar outlet (${batas.map(titik).join(', ')}).`}
      {belumKonfirmasi.length > 0 && ` Batas hari belum dikonfirmasi di POS: ${belumKonfirmasi.join(', ')}.`}
    </p>
  );
}

function BlokTanggal({ tanggal, judul, tampilPos, tampilkanCatatan = true, datar = false }: { tanggal: string; judul: string | null; tampilPos: boolean; tampilkanCatatan?: boolean; datar?: boolean }) {
  const { data, isLoading, isError, refetch } = useOmzetTigaSumberUntukTanggal(tanggal);
  return (
    <div className="flex flex-col gap-2">
      <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--biru)' }}>
        {judul ? `${judul} · ` : ''}
        {tanggalIndonesiaDariYmd(tanggal)}
      </p>
      {isError ? (
        <KeadaanGagal pesan="Gagal memuat silang-cek omzet." onCoba={() => void refetch()} />
      ) : isLoading || !data ? (
        <p style={{ color: 'var(--kosong)' }}>Memuat…</p>
      ) : data.length === 0 ? (
        <p style={{ color: 'var(--kosong)' }}>Belum ada outlet aktif.</p>
      ) : (
        <>
          <div className={datar ? 'panel' : 'flex flex-col gap-2'}>
            {data.map((r) => (
              <KartuOutlet key={r.outletId} r={r} tampilPos={tampilPos} datar={datar} />
            ))}
          </div>
          {tampilkanCatatan && <CatatanHari rows={data} tampilPos={tampilPos} />}
        </>
      )}
    </div>
  );
}

function StatusBlok({ tampilPos }: { tampilPos: boolean }) {
  const { data, isError } = useStatusSinkronPos(tampilPos);
  if (!tampilPos) return null;
  if (isError) return <p className="text-sm" style={{ color: 'var(--kuning)' }}>Status sinkron POS tidak dapat dimuat.</p>;
  if (!data) return null;
  return <BannerSinkron status={data} />;
}

/** Beranda CEO: hari bisnis TERAKHIR YANG TUTUP (final) di atas, hari berjalan (sementara) di bawahnya. */
export function SilangCekOmzetBeranda({ tampilPos }: { tampilPos: boolean }) {
  const hariIni = tanggalWIB();
  return (
    <div className="flex flex-col gap-3">
      <p className="judul-seksi">Silang-Cek Omzet Resto</p>
      <StatusBlok tampilPos={tampilPos} />
      <div className="grid gap-5 lg:grid-cols-2 lg:gap-8 lg:items-start">
        <BlokTanggal tanggal={geserTanggalYmd(hariIni, -1)} judul="Kemarin" tampilPos={tampilPos} datar />
        <BlokTanggal tanggal={hariIni} judul="Hari ini" tampilPos={tampilPos} tampilkanCatatan={false} datar />
      </div>
    </div>
  );
}

/** Halaman Terpusat: satu tanggal pilihan pengguna. */
export function SilangCekOmzetTanggal({ tanggal, tampilPos }: { tanggal: string; tampilPos: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <p style={{ fontFamily: 'var(--display)', fontWeight: 500, color: 'var(--biru)' }}>Silang-cek omzet resto</p>
      <StatusBlok tampilPos={tampilPos} />
      <BlokTanggal tanggal={tanggal} judul={null} tampilPos={tampilPos} />
    </div>
  );
}
