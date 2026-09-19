'use client';

import { useMemo, useState } from 'react';
import { Terlindungi } from '../../components/Terlindungi';
import { PapanKartu } from '../../components/PapanKartu';
import { PemilihTanggal } from '../../components/PemilihTanggal';
import { KerangkaPapan } from '../../components/Kerangka';
import { useAuth } from '../../lib/auth/AuthProvider';
import { usePolicy } from '../../lib/api/policy';
import { usePapanUntukTanggal, useTagihLaporan, type PapanRow } from '../../lib/api/papan';
import { hariIsoDariTanggal, tanggalIndonesiaDariYmd, tanggalWIB } from '../../lib/tanggal';
import { formRegistry } from '../../forms';

function PapanKontrolIsi() {
  const { roles } = useAuth();
  const { data: policy } = usePolicy();
  const [tanggal, setTanggal] = useState(tanggalWIB());
  const { data: baris, isLoading } = usePapanUntukTanggal(tanggal);
  const tagih = useTagihLaporan();
  const [sedangDitagih, setSedangDitagih] = useState<string | null>(null);
  // "Belum mulai" (0 dari semua) vs "sebagian tertinggal" (0 < sudah < semua)
  // SENGAJA dibedakan (instruksi eksplisit user, 31 Agustus 2026, DESIGN.md
  // baru §27) -- lihat gate `belumMulai` di bawah. Togel manual, direset
  // begitu tanggal dipilih ulang supaya tidak "nyangkut" terbuka di tanggal lain.
  const [tampilkanDaftar, setTampilkanDaftar] = useState(false);

  const bolehTagih = roles.includes('pusat') && tanggal === tanggalWIB();

  async function tanganiTagih(assignmentId: string) {
    setSedangDitagih(assignmentId);
    try {
      await tagih.mutateAsync(assignmentId);
    } finally {
      setSedangDitagih(null);
    }
  }

  // "Laporan yang ditunggu" DIHITUNG dari `assignment` lewat RPC
  // `papan_untuk_tanggal` (03-CALC-SPEC.md §4.1, migrasi 0020) -- bukan
  // daftar tetap. Menambah baris assignment baru (Task 23) langsung
  // menambah kartu di sini tanpa ubah kode, sama seperti tab "Lapor" dinamis
  // (lib/navLapor.ts).
  const kelompok = useMemo(() => {
    const peta = new Map<string, PapanRow[]>();
    for (const b of baris ?? []) {
      const daftar = peta.get(b.formKey) ?? [];
      daftar.push(b);
      peta.set(b.formKey, daftar);
    }
    return Array.from(peta.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [baris]);

  const totalSudah = (baris ?? []).filter((b) => b.reportId).length;
  const totalSemua = (baris ?? []).length;
  const totalBelum = totalSemua - totalSudah;
  const persen = totalSemua > 0 ? Math.round((totalSudah / totalSemua) * 100) : 0;

  // "Belum mulai" (nol dari semua) BUKAN "tertinggal" -- tidak ada
  // pembanding sama sekali (tidak ada yang sudah, jadi tidak ada yang bisa
  // dibilang "kalah" dari siapa). Merah cuma berarti sesuatu begitu ADA
  // sebagian yang sudah lapor -- lihat DESIGN.md §27 (baru).
  const belumMulai = totalSemua > 0 && totalSudah === 0;
  const jumlahOrang = useMemo(() => new Set((baris ?? []).map((b) => b.picNama)).size, [baris]);

  const workdays = (policy?.workdays as number[] | undefined) ?? [1, 2, 3, 4, 5, 6];
  const tanggalBukanHariKerja = !workdays.includes(hariIsoDariTanggal(tanggal));

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-6">
        <h1 className="sapaan">Papan Kontrol</h1>
        <PemilihTanggal
          tanggal={tanggal}
          onUbah={(t) => {
            setTanggal(t);
            setTampilkanDaftar(false);
          }}
        />
      </header>

      {!policy || isLoading ? (
        <KerangkaPapan />
      ) : tanggalBukanHariKerja ? (
        <div className="kartu-status rail-netral p-6 text-center">
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--kosong)' }}>Bukan hari kerja</p>
          <p className="text-sm mt-1" style={{ color: 'var(--kosong)' }}>
            {tanggalIndonesiaDariYmd(tanggal)} bukan hari wajib lapor, jadi tidak ada laporan yang ditunggu.
          </p>
        </div>
      ) : (
        <>
          {totalSemua === 0 && <p style={{ color: 'var(--kosong)' }}>Belum ada penugasan yang tercatat.</p>}

          {/* Belum mulai (0 dari semua) -- keadaan KOSONG yang jujur, BUKAN
              wall merah. Tidak ada laporan sama sekali BUKAN berarti semua
              orang tertinggal -- bisa juga berarti sistemnya belum dipakai
              siapa pun (mis. sebelum akun dibagikan). Instruksi eksplisit
              user, 31 Agustus 2026. */}
          {belumMulai && !tampilkanDaftar ? (
            <div className="kartu-status rail-netral flex flex-col gap-2">
              <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>
                Belum ada laporan {tanggal === tanggalWIB() ? 'hari ini' : `pada ${tanggalIndonesiaDariYmd(tanggal)}`}
              </p>
              <p className="text-sm" style={{ color: 'var(--label)' }}>
                {totalSemua} laporan ditunggu dari {jumlahOrang} orang.
              </p>
              <p className="text-sm" style={{ color: 'var(--label)' }}>
                Kartu akan berubah warna begitu laporan mulai masuk.
              </p>
              <button
                type="button"
                onClick={() => setTampilkanDaftar(true)}
                className="tombol-sekunder"
                style={{ alignSelf: 'flex-start' }}
              >
                Lihat daftar yang ditunggu
              </button>
            </div>
          ) : (
            totalSemua > 0 && (
              <>
                {/* Ringkasan (DESIGN.md §7.1, §14) -- CEO scanning. SATU panel datar:
                    angka utama + progres, lalu baris status ringkas (bukan dua kartu
                    besar yang mengulang informasi yang sama). */}
                <div className="panel">
                  <div className="panel-baris flex flex-col gap-2" style={{ padding: '16px' }}>
                    <p className="text-sm" style={{ color: 'var(--label)' }}>Laporan hari ini</p>
                    <div className="flex items-baseline gap-2">
                      <span className="angka-besar" style={{ color: 'var(--biru)' }}>{totalSudah}</span>
                      <span style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700, color: 'var(--label)' }}>/{totalSemua}</span>
                      <span className="text-sm" style={{ color: 'var(--label)' }}>sudah masuk</span>
                    </div>
                    <div className="progres-bar">
                      <div className="progres-bar-isi" style={{ width: `${persen}%` }} />
                    </div>
                  </div>

                  {/* Breakdown status -- merah & kuning boleh terlihat kuat (DESIGN.md §7.1).
                      TAPI kalau belumMulai (0 dari semua, ditampilkan lewat "Lihat daftar
                      yang ditunggu"), "belum lapor" TIDAK merah -- belum ada pembanding
                      (DESIGN.md §27). */}
                  <div className="panel-baris flex flex-wrap items-baseline gap-x-8 gap-y-1">
                    {totalBelum > 0 && (
                      <p className="flex items-baseline gap-2">
                        <span className="angka-kecil" style={{ color: belumMulai ? 'var(--tinta)' : 'var(--merah)' }}>{totalBelum}</span>
                        <span className="text-sm" style={{ color: belumMulai ? 'var(--label)' : 'var(--merah)' }}>belum lapor</span>
                      </p>
                    )}
                    {totalSudah > 0 && (
                      <p className="flex items-baseline gap-2">
                        <span className="angka-kecil" style={{ color: 'var(--hijau)' }}>{totalSudah}</span>
                        <span className="text-sm" style={{ color: 'var(--hijau)' }}>sudah masuk</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Kelompok: satu .panel per jenis laporan, baris tugas ringkas di dalamnya.
                    Desktop: dua kolom (multi-column CSS), panel tidak dipecah antar kolom. */}
                <div className="lg:columns-2 lg:gap-8">
                  {kelompok.map(([formKey, daftar]) => {
                    const formNama = formRegistry[formKey]?.nama ?? formKey;
                    const sudah = daftar.filter((b) => b.reportId).length;
                    const belum = daftar.length - sudah;
                    return (
                      <section key={formKey} className="mb-5 break-inside-avoid md:mb-6">
                        <div className="mb-2 flex items-baseline justify-between gap-2">
                          <h2 className="judul-seksi">{formNama}</h2>
                          <span
                            className="text-sm"
                            style={{ fontFamily: 'var(--mono)', color: belum === 0 ? 'var(--hijau)' : 'var(--label)' }}
                          >
                            {sudah}/{daftar.length}
                          </span>
                        </div>
                        <div className="panel">
                          {/* Belum lapor di atas, sudah lapor di bawah -- sorting visual */}
                          {[...daftar].sort((a, b) => (a.reportId ? 1 : 0) - (b.reportId ? 1 : 0)).map((b) => (
                            <PapanKartu
                              key={b.assignmentId}
                              baris={b}
                              bolehTagih={bolehTagih}
                              menagih={sedangDitagih === b.assignmentId}
                              onTagih={() => void tanganiTagih(b.assignmentId)}
                              netral={belumMulai}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            )
          )}
        </>
      )}
    </div>
  );
}

export default function PapanPage() {
  return (
    <Terlindungi peran={['ceo', 'pusat']}>
      <main className="mx-auto w-full max-w-[1120px] px-4 py-5 md:px-8 md:py-8">
        <PapanKontrolIsi />
      </main>
    </Terlindungi>
  );
}
