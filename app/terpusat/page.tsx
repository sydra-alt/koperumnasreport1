'use client';

import { useState, type ReactNode } from 'react';
import { Terlindungi } from '../../components/Terlindungi';
import { LaporForm } from '../../components/LaporForm';
import { AngkaGrid } from '../../components/AngkaGrid';
import { PemilihTanggal } from '../../components/PemilihTanggal';
import { useAuth } from '../../lib/auth/AuthProvider';
import { jamWIB, tanggalWIB } from '../../lib/tanggal';
import { formRegistry } from '../../forms';
import {
  useLaporanHariIni,
  useSecurityUntukTanggal,
  useStkUntukTanggal,
  useMarketingUntukTanggal,
  useKaryawanTertinggal,
  usePicLokasiUntukTanggal,
} from '../../lib/api/terpusat';
import { usePembangunanUntukTanggal, useKeuanganRekapUntukTanggal, useSelisihRestoUntukTanggal } from '../../lib/api/dashboard';
import { useLaporanAccountingHariIni, hitungRingkasanKeuanganCeo } from '../../lib/api/accounting';
import { useRekapPembangunanPerLokasi } from '../../lib/api/pembangunan';
import { usePapanUntukTanggal } from '../../lib/api/papan';
import { useAntreanKeputusan } from '../../lib/api/decision';
import { formatRupiah } from '../../lib/rupiah';

function Seksi({ nomor, judul, sumber, children }: { nomor: string; judul: string; sumber?: string; children: ReactNode }) {
  return (
    <div className="border p-4 print-seksi" style={{ borderColor: 'var(--garis)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
          {nomor} · {judul}
        </p>
        {sumber && (
          <span className="text-sm" style={{ color: 'var(--biru-3)' }}>
            {sumber}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-2 text-sm">{children}</div>
    </div>
  );
}

function Kosong({ nama }: { nama: string }) {
  return (
    <p style={{ color: 'var(--kosong)' }}>
      Belum ada laporan {nama} pada tanggal ini.
    </p>
  );
}

function sumberDari(formKey: string, submittedAt: string | null): string {
  const nama = formRegistry[formKey]?.nama ?? formKey;
  return submittedAt ? `dari ${nama} · ${jamWIB(new Date(submittedAt))}` : `dari ${nama}`;
}

function angka(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === 'number' ? String(v) : '0';
}

function teks(data: Record<string, unknown>, key: string): string | null {
  const v = data[key];
  return typeof v === 'string' && v.trim() ? v : null;
}

function Isi() {
  const { roles } = useAuth();
  const isCeo = roles.includes('ceo');
  const [tanggal, setTanggal] = useState(tanggalWIB());
  const tanggalHariIni = tanggal === tanggalWIB();

  const { data: it } = useLaporanHariIni('it', tanggal);
  const { data: cs } = useLaporanHariIni('cs', tanggal);
  const { data: ga } = useLaporanHariIni('ga', tanggal);
  const { data: hrd } = useLaporanHariIni('hrd', tanggal);
  const { data: perizinan } = useLaporanHariIni('perizinan', tanggal);
  const { data: pembangunanLaporan } = useLaporanHariIni('pembangunan', tanggal);
  const { data: dti } = useLaporanHariIni('dti', tanggal);
  const { data: kendaraan } = useLaporanHariIni('kendaraan', tanggal);

  const { data: security } = useSecurityUntukTanggal(tanggal);
  const { data: stk } = useStkUntukTanggal(tanggal);
  const { data: marketing } = useMarketingUntukTanggal(tanggal);
  const { data: tertinggal } = useKaryawanTertinggal();
  const { data: picLokasi } = usePicLokasiUntukTanggal(tanggal);
  const { data: pembangunanTotal } = usePembangunanUntukTanggal(tanggal);
  const { data: rekapPerLokasi } = useRekapPembangunanPerLokasi(true, tanggal);
  const { data: keuangan } = useKeuanganRekapUntukTanggal(tanggal);
  const { data: laporanAccounting } = useLaporanAccountingHariIni(isCeo, tanggal);
  const ringkasanKeuanganCeo = laporanAccounting ? hitungRingkasanKeuanganCeo(laporanAccounting) : null;
  const { data: selisihResto } = useSelisihRestoUntukTanggal(tanggal);
  const { data: papan } = usePapanUntukTanggal(tanggal);
  const { data: antrean } = useAntreanKeputusan();

  const targetTotal = (rekapPerLokasi ?? []).reduce((total, r) => total + (r.target ?? 0), 0);
  const statusPic = (papan ?? []).filter((p) => p.formKey === 'pic_lokasi');
  const picHijau = statusPic.filter((p) => p.reportId && p.warna === 'hijau').length;
  const picKuning = statusPic.filter((p) => p.reportId && p.warna === 'kuning').length;
  const picMerah = statusPic.filter((p) => p.reportId && p.warna === 'merah').length;
  const picBelumLapor = statusPic.filter((p) => !p.reportId);
  const totalLapor = (papan ?? []).filter((p) => p.reportId).length;
  const totalAssignment = (papan ?? []).length;

  return (
    <div className="flex flex-col gap-4">
      <PemilihTanggal tanggal={tanggal} onUbah={setTanggal} />

      <p className="text-sm" style={{ color: 'var(--kosong)' }}>
        Bagian 1-15 hanya baca -- terisi otomatis dari laporan divisi lain. Tidak ada satu pun angka di bagian ini yang bisa diketik manual.
      </p>

      <Seksi nomor="1" judul="Data Konsumen / Sistem" sumber={it ? sumberDari('it', it.submittedAt) : undefined}>
        {!it ? (
          <Kosong nama="IT" />
        ) : (
          <>
            <AngkaGrid
              butir={[
                { label: 'Konsumen aktif', nilai: angka(it.data, 'konsumen_aktif') },
                { label: 'Baru hari ini', nilai: angka(it.data, 'konsumen_baru_hari_ini') },
                { label: 'STK', nilai: angka(it.data, 'konsumen_stk') },
                { label: 'STKB', nilai: angka(it.data, 'konsumen_stkb') },
                { label: 'Suspend', nilai: angka(it.data, 'konsumen_suspend') },
                { label: 'Menunggak', nilai: angka(it.data, 'konsumen_menunggak') },
                { label: 'Refund', nilai: angka(it.data, 'konsumen_refund') },
                { label: 'Take over', nilai: angka(it.data, 'konsumen_take_over') },
              ]}
            />
            {teks(it.data, 'data_belum_sinkron_detail') && <p>Masalah data: {teks(it.data, 'data_belum_sinkron_detail')}</p>}
            {teks(it.data, 'perubahan_lainnya') && <p>Perubahan penting: {teks(it.data, 'perubahan_lainnya')}</p>}
          </>
        )}
      </Seksi>

      <Seksi nomor="2" judul="CS & Masalah Konsumen" sumber={cs ? sumberDari('cs', cs.submittedAt) : undefined}>
        {!cs ? (
          <Kosong nama="CS" />
        ) : (
          <>
            <AngkaGrid
              butir={[
                { label: 'Tiket masuk', nilai: angka(cs.data, 'tiket_masuk_total') },
                { label: 'Keluhan baru', nilai: angka(cs.data, 'keluhan_baru') },
                { label: 'Selesai', nilai: angka(cs.data, 'keluhan_selesai_hari_ini') },
                { label: 'Belum selesai', nilai: angka(cs.data, 'keluhan_belum_selesai') },
                { label: 'Video call', nilai: angka(cs.data, 'tiket_video_call') },
              ]}
            />
            {teks(cs.data, 'keluhan_urgent_masalah') && (
              <p>
                Masalah urgent: {teks(cs.data, 'keluhan_urgent_masalah')} -- PIC: {teks(cs.data, 'keluhan_urgent_pic') ?? '—'} -- target:{' '}
                {teks(cs.data, 'keluhan_urgent_target') ?? '—'}
              </p>
            )}
          </>
        )}
      </Seksi>

      <Seksi nomor="3" judul="Operasional Kantor" sumber={ga ? sumberDari('ga', ga.submittedAt) : undefined}>
        {!ga ? (
          <Kosong nama="GA" />
        ) : (
          <>
            <p>
              Kebersihan:{' '}
              {['kebersihan_ruang_kerja', 'kebersihan_ruang_tamu', 'kebersihan_toilet', 'kebersihan_halaman'].every((k) => ga.data[k] === 'ya')
                ? '✅'
                : '❌'}
            </p>
            {teks(ga.data, 'masalah_kebersihan_ga') && <p>Kendala: {teks(ga.data, 'masalah_kebersihan_ga')}</p>}
            {teks(ga.data, 'kebutuhan_ga') && <p>Kebutuhan: {teks(ga.data, 'kebutuhan_ga')}</p>}
          </>
        )}
      </Seksi>

      <Seksi nomor="4" judul="Security / Satpam" sumber="dari Laporan Security · seluruh lokasi &amp; shift">
        <AngkaGrid
          butir={[
            { label: 'Satpam hadir', nilai: String(security?.satpamHadir ?? 0) },
            { label: 'Tamu datang', nilai: String(security?.tamuDatang ?? 0) },
            { label: 'Konsumen datang', nilai: String(security?.konsumenDatang ?? 0) },
            {
              label: 'Kejadian keamanan',
              nilai: String(security?.jumlahKejadian ?? 0),
              warna: (security?.jumlahKejadian ?? 0) > 0 ? 'var(--merah)' : undefined,
            },
          ]}
        />
        <p style={{ color: 'var(--kosong)' }}>Rincian per lokasi/shift ada di laporan Security masing-masing.</p>
      </Seksi>

      <Seksi nomor="5" judul="HRD / Absensi" sumber={hrd ? sumberDari('hrd', hrd.submittedAt) : undefined}>
        {!hrd ? (
          <Kosong nama="HRD" />
        ) : (
          <>
            <AngkaGrid
              butir={[
                { label: 'Total pegawai', nilai: angka(hrd.data, 'pegawai_total') },
                { label: 'Hadir', nilai: angka(hrd.data, 'pegawai_hadir') },
                { label: 'Sakit', nilai: angka(hrd.data, 'pegawai_sakit') },
                { label: 'Izin', nilai: angka(hrd.data, 'pegawai_izin') },
                { label: 'Cuti', nilai: angka(hrd.data, 'pegawai_cuti') },
                { label: 'Terlambat', nilai: angka(hrd.data, 'pegawai_terlambat') },
                { label: 'Tanpa keterangan', nilai: angka(hrd.data, 'pegawai_tanpa_keterangan') },
              ]}
            />
            {teks(hrd.data, 'tanpa_keterangan_detail') && <p>Nama/keterangan: {teks(hrd.data, 'tanpa_keterangan_detail')}</p>}
          </>
        )}
      </Seksi>

      <Seksi nomor="6" judul="Perizinan" sumber={perizinan ? sumberDari('perizinan', perizinan.submittedAt) : undefined}>
        {!perizinan ? (
          <Kosong nama="Perizinan" />
        ) : (
          <>
            <AngkaGrid
              butir={[
                { label: 'Sedang diproses', nilai: String(((perizinan.data.perizinan_berjalan as unknown[]) ?? []).length) },
                { label: 'Selesai hari ini', nilai: String(((perizinan.data.izin_selesai_hari_ini as unknown[]) ?? []).length) },
                { label: 'Belum selesai', nilai: String(((perizinan.data.izin_belum_selesai as unknown[]) ?? []).length) },
              ]}
            />
            {teks(perizinan.data, 'izin_lewat_target') && <p>Kendala: {teks(perizinan.data, 'izin_lewat_target')}</p>}
          </>
        )}
      </Seksi>

      <Seksi nomor="7" judul="Pembangunan Seluruh Lokasi" sumber="dari rekap Laporan PIC Lokasi + Laporan Kepala Pembangunan">
        <AngkaGrid
          butir={[
            { label: 'Target', nilai: String(targetTotal) },
            { label: 'Sedang dibangun', nilai: String(pembangunanTotal?.sedangDibangun ?? 0) },
            { label: 'Finishing', nilai: String(pembangunanTotal?.finishing ?? 0) },
            { label: 'Selesai hari ini', nilai: String(pembangunanTotal?.selesaiHariIni ?? 0) },
            { label: 'Belum mulai', nilai: String(pembangunanTotal?.belumMulai ?? 0) },
          ]}
        />
        {pembangunanLaporan ? (
          <>
            {teks(pembangunanLaporan.data, 'kontraktor_bermasalah_masalah') && (
              <p>Kontraktor bermasalah: {teks(pembangunanLaporan.data, 'kontraktor_bermasalah_nama') ?? '—'} -- {teks(pembangunanLaporan.data, 'kontraktor_bermasalah_masalah')}</p>
            )}
            {teks(pembangunanLaporan.data, 'besok_lokasi_prioritas') && <p>Target besok: {teks(pembangunanLaporan.data, 'besok_lokasi_prioritas')}</p>}
          </>
        ) : (
          <Kosong nama="Kepala Pembangunan" />
        )}
      </Seksi>

      <Seksi nomor="8" judul="Kontrol Per Lokasi" sumber="dari Laporan PIC Lokasi, per lokasi">
        {!picLokasi || picLokasi.length === 0 ? (
          <Kosong nama="PIC Lokasi" />
        ) : (
          <div className="flex flex-col gap-3">
            {picLokasi.map((p) => (
              <div key={p.lokasi} className="border p-3" style={{ borderColor: 'var(--garis)' }}>
                <p style={{ fontFamily: 'var(--display)', fontWeight: 500 }}>
                  📍 {p.lokasi} -- PIC: {p.picNama}
                </p>
                <p>
                  Kavling tersedia: {angka(p.data, 'kavling_tersedia')} · belum laku: {angka(p.data, 'kavling_belum_laku')} · kebutuhan:{' '}
                  {angka(p.data, 'kavling_kebutuhan_tambahan')}
                </p>
                <p>
                  Pembangunan: {angka(p.data, 'unit_dibangun')} unit · Finishing: {angka(p.data, 'unit_finishing')} unit
                </p>
                <p>
                  Jalan: {teks(p.data, 'jalan_status') ?? '—'} · Listrik: {teks(p.data, 'listrik_status') ?? '—'} · Air:{' '}
                  {teks(p.data, 'air_status') ?? '—'}
                </p>
                <p>
                  Kebersihan: {p.data.kebersihan_baik === 'ya' ? '✅' : '❌'} · Keamanan (satpam bertugas): {p.data.ada_satpam === 'ya' ? '✅' : '❌'}
                </p>
                {teks(p.data, 'keputusan_ceo_judul') && <p style={{ color: 'var(--merah)' }}>Butuh keputusan CEO: {teks(p.data, 'keputusan_ceo_judul')}</p>}
              </div>
            ))}
          </div>
        )}
      </Seksi>

      <Seksi nomor="9" judul="STK & Rumah Tidak Ditempati" sumber="dari rekap Laporan PIC Lokasi">
        <AngkaGrid
          butir={[
            { label: 'Rumah STK', nilai: String(stk?.total ?? 0) },
            { label: 'Sudah ditempati', nilai: String(stk?.sudahDitempati ?? 0) },
            { label: 'Belum ditempati', nilai: String(stk?.belumDitempati ?? 0) },
            { label: 'Rumah kosong', nilai: String(stk?.rumahKosong ?? 0) },
            { label: 'Perlu maintenance', nilai: String(stk?.perluMaintenance ?? 0) },
          ]}
        />
      </Seksi>

      <Seksi nomor="10" judul="DTI / Precast / Perikas" sumber={dti ? sumberDari('dti', dti.submittedAt) : undefined}>
        {!dti ? (
          <Kosong nama="DTI" />
        ) : (
          <>
            <AngkaGrid
              butir={[
                { label: 'Target produksi', nilai: angka(dti.data, 'target_produksi') },
                { label: 'Realisasi', nilai: angka(dti.data, 'realisasi_produksi') },
                { label: 'Precast dibuat', nilai: angka(dti.data, 'precast_dibuat') },
                { label: 'Perikas dibuat', nilai: angka(dti.data, 'perikas_dibuat') },
              ]}
            />
            {teks(dti.data, 'material_habis') && <p>Material kurang: {teks(dti.data, 'material_habis')}</p>}
            <p>
              Kebersihan: {dti.data.kebersihan_area_produksi === 'ya' ? '✅' : '❌'} · Keamanan:{' '}
              {dti.data.keamanan_area_dti === 'ya' ? '✅' : '❌'}
            </p>
            {teks(dti.data, 'kendala_dti') && <p>Kendala: {teks(dti.data, 'kendala_dti')}</p>}
          </>
        )}
      </Seksi>

      <Seksi nomor="11" judul="Keuangan Umum" sumber="dari Laporan Accounting (rekap 4 angka)">
        {!keuangan ? (
          <Kosong nama="Accounting" />
        ) : (
          <AngkaGrid
            butir={[
              { label: 'Total masuk', nilai: formatRupiah(keuangan.totalMasuk) },
              { label: 'Total keluar', nilai: formatRupiah(keuangan.totalKeluar) },
              { label: 'Net hari ini', nilai: formatRupiah(keuangan.net), warna: keuangan.net < 0 ? 'var(--merah)' : undefined },
              ...(isCeo && ringkasanKeuanganCeo
                ? [
                    { label: 'Dana tersedia (CEO)', nilai: formatRupiah(ringkasanKeuanganCeo.danaTersedia) },
                    { label: 'Piutang (CEO)', nilai: formatRupiah(ringkasanKeuanganCeo.piutangTotal) },
                  ]
                : []),
            ]}
          />
        )}
        <p style={{ color: 'var(--kosong)' }}>
          {roles.includes('ceo') ? 'Anda melihat versi lengkap (CEO).' : 'Detail keuangan, saldo, dan hutang/piutang dilaporkan Accounting langsung ke CEO -- hanya 4 angka ini yang tampil di sini.'}
        </p>
        {(selisihResto ?? []).length > 0 && (
          <div>
            <p style={{ fontFamily: 'var(--display)', fontWeight: 500, color: 'var(--biru)' }}>Silang-cek omzet resto</p>
            {selisihResto!.map((r) => (
              <p key={r.outlet}>
                {r.outlet}: selisih {formatRupiah(r.selisih ?? 0)}
              </p>
            ))}
          </div>
        )}
      </Seksi>

      <Seksi nomor="12" judul="Kendaraan & Driver" sumber={kendaraan ? sumberDari('kendaraan', kendaraan.submittedAt) : undefined}>
        {!kendaraan ? (
          <Kosong nama="Kendaraan/GA" />
        ) : (
          <>
            <AngkaGrid
              butir={[
                { label: 'Mobil dicek', nilai: `${angka(kendaraan.data, 'mobil_dicek_jumlah')}/${angka(kendaraan.data, 'mobil_total')}` },
                { label: 'Truk dicek', nilai: `${angka(kendaraan.data, 'truk_dicek_jumlah')}/${angka(kendaraan.data, 'truk_total')}` },
                { label: 'BBM (Rp)', nilai: formatRupiah(Number(kendaraan.data.total_biaya_bbm ?? 0)) },
                { label: 'Kendaraan rusak', nilai: String(((kendaraan.data.kendaraan_rusak as unknown[]) ?? []).length) },
              ]}
            />
            <p>Estimasi biaya servis: {formatRupiah(Number(kendaraan.data.total_estimasi_biaya_servis ?? 0))}</p>
          </>
        )}
      </Seksi>

      <Seksi nomor="13" judul="Marketing -- Kontrol Pak Fauzi &amp; Pak Dea" sumber="dari rekap laporan marketing harian &amp; bulanan">
        <AngkaGrid
          butir={[
            { label: 'Melakukan marketing hari ini', nilai: String(marketing?.sudahLaporHariIni ?? 0) },
            {
              label: 'Tidak melakukan',
              nilai: String(Math.max((marketing?.totalKaryawan ?? 0) - (marketing?.sudahLaporHariIni ?? 0), 0)),
            },
            { label: 'Undangan hari ini', nilai: String(marketing?.undanganHariIni ?? 0) },
            { label: 'Closing hari ini', nilai: String(marketing?.closingHariIni ?? 0) },
          ]}
        />
        {(tertinggal ?? []).length > 0 && (
          <div>
            <p style={{ color: 'var(--merah)', fontFamily: 'var(--display)', fontWeight: 500 }}>Pegawai belum bergerak/tertinggal target:</p>
            <ul className="list-disc pl-5">
              {tertinggal!.map((k) => (
                <li key={k.nama}>
                  {k.nama} -- undangan {k.undangan}/20, closing {k.closing}/2
                </li>
              ))}
            </ul>
          </div>
        )}
      </Seksi>

      <Seksi nomor="14" judul="IT / Digital / Medsos" sumber={it ? sumberDari('it', it.submittedAt) : undefined}>
        {!it ? (
          <Kosong nama="IT" />
        ) : (
          <p>
            IG: {it.data.ig_koperumnas === 'ya' ? '✅' : '❌'} · TikTok: {it.data.tiktok_koperumnas === 'ya' ? '✅' : '❌'} · YouTube:{' '}
            {it.data.youtube_koperumnas === 'ya' ? '✅' : '❌'} · Threads: {it.data.threads_koperumnas === 'ya' ? '✅' : '❌'} · DTI:{' '}
            {it.data.ig_dti === 'ya' ? '✅' : '❌'} · Indokopi: {it.data.ig_indokopi === 'ya' ? '✅' : '❌'} · Indosteak:{' '}
            {it.data.ig_indosteak === 'ya' ? '✅' : '❌'}
          </p>
        )}
      </Seksi>

      <Seksi nomor="15" judul="Rekap Status PIC Lokasi" sumber="dari Papan Kontrol">
        <AngkaGrid
          butir={[
            { label: '🟢 Aman', nilai: String(picHijau) },
            { label: '🟡 Perlu perhatian', nilai: String(picKuning) },
            { label: '🔴 Urgent', nilai: String(picMerah) },
          ]}
        />
        <p>
          Status laporan seluruh divisi: {totalLapor} dari {totalAssignment} PIC sudah melapor.
        </p>
        {picBelumLapor.length > 0 && (
          <div>
            <p style={{ fontFamily: 'var(--display)', fontWeight: 500, color: 'var(--biru)' }}>PIC yang belum memberikan laporan:</p>
            <ul className="list-disc pl-5">
              {picBelumLapor.map((p) => (
                <li key={p.assignmentId}>
                  {p.scopeNama} ({p.picNama}) -- {formRegistry[p.formKey]?.nama ?? p.formKey}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Seksi>

      <Seksi nomor="17 (dari divisi lain)" judul="Keputusan yang Sudah Diajukan" sumber="dari Antrean Keputusan CEO">
        {(antrean ?? []).length === 0 ? (
          <p style={{ color: 'var(--kosong)' }}>Tidak ada keputusan yang sedang menunggu.</p>
        ) : (
          <ol className="list-decimal pl-5">
            {antrean!.map((k) => (
              <li key={k.id}>
                {k.judul} -- urgensi {k.urgensi} {k.deadline ? `· deadline ${k.deadline}` : ''}
              </li>
            ))}
          </ol>
        )}
      </Seksi>

      <div className="print-hide">
        <button
          type="button"
          onClick={() => window.print()}
          className="border px-4 py-2"
          style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44 }}
        >
          Cetak / Ekspor PDF
        </button>
      </div>

      {tanggalHariIni ? (
        <>
          <p className="text-sm" style={{ color: 'var(--kosong)' }}>
            Bagian 16 (Target Besok), 17 (Keputusan Tambahan dari Pusat), dan Kesimpulan bisa Anda isi di bawah.
          </p>
          <LaporForm formKey="pusat" />
        </>
      ) : (
        <p className="text-sm" style={{ color: 'var(--kosong)' }}>
          Target Besok dan Kesimpulan cuma bisa diisi untuk hari ini -- kembali ke &quot;Hari ini&quot; di atas untuk mengisinya.
        </p>
      )}
    </div>
  );
}

export default function TerpusatPage() {
  return (
    <Terlindungi peran={['pusat', 'ceo']}>
      <style>{`
        @media print {
          .print-hide { display: none !important; }
          header, nav { display: none !important; }
          .print-seksi { break-inside: avoid; }
          body { font-size: 11px; }
        }
      `}</style>
      <main className="flex flex-col gap-6 p-6">
        <h1 className="text-2xl" style={{ color: 'var(--biru)' }}>
          Laporan Terpusat
        </h1>
        <Isi />
      </main>
    </Terlindungi>
  );
}
