'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useAjukanCuti, useCutiSaya, useSignedUrlCuti, type CutiJenis } from '../../lib/api/cuti';
import { KerangkaDaftarKartu } from '../../components/Kerangka';
import { tanggalIndonesiaDariYmd, tanggalWIB } from '../../lib/tanggal';

const LABEL_JENIS: Record<CutiJenis, string> = { cuti: 'Cuti', sakit: 'Sakit', izin: 'Izin' };
const WARNA_STATUS: Record<string, string> = { diajukan: 'var(--kuning)', disetujui: 'var(--hijau)', ditolak: 'var(--merah)' };
const LABEL_STATUS: Record<string, string> = { diajukan: 'Menunggu persetujuan', disetujui: 'Disetujui', ditolak: 'Ditolak' };

export default function CutiPage() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: riwayat, isLoading } = useCutiSaya(userId);
  const ajukan = useAjukanCuti();
  const signedUrl = useSignedUrlCuti();

  const [jenis, setJenis] = useState<CutiJenis>('cuti');
  const [tanggalMulai, setTanggalMulai] = useState(tanggalWIB());
  const [tanggalSelesai, setTanggalSelesai] = useState(tanggalWIB());
  const [keterangan, setKeterangan] = useState('');
  const [suratFile, setSuratFile] = useState<File | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  async function tanganiKirim(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setPesan(null);
    if (tanggalSelesai < tanggalMulai) {
      setPesan('Tanggal selesai tidak boleh sebelum tanggal mulai.');
      return;
    }
    try {
      await ajukan.mutateAsync({
        userId,
        tanggalMulai,
        tanggalSelesai,
        jenis,
        keterangan: keterangan.trim() || null,
        suratFile,
      });
      setKeterangan('');
      setSuratFile(null);
      setPesan('Pengajuan terkirim, menunggu persetujuan HRD/CEO.');
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Gagal mengirim pengajuan.');
    }
  }

  async function lihatSurat(path: string) {
    const url = await signedUrl.mutateAsync({ path, umurDetik: 120 });
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 p-5 md:p-8">
      <div className="flex items-center gap-3">
        <Link href="/" className="tombol-lingkar text-lg font-bold" aria-label="Kembali ke Beranda">
          ‹
        </Link>
        <h1 className="sapaan">
          Ajukan Cuti / Sakit / Izin
        </h1>
      </div>

      <form onSubmit={tanganiKirim} className="neumo-kartu flex flex-col gap-4 p-6">
        <label className="flex flex-col gap-1 text-sm font-semibold text-[var(--label)]">
          Jenis
          <select
            value={jenis}
            onChange={(e) => setJenis(e.target.value as CutiJenis)}
            className="w-full text-base font-medium"
          >
            <option value="cuti">Cuti</option>
            <option value="sakit">Sakit</option>
            <option value="izin">Izin</option>
          </select>
        </label>

        {/* Di layar 360px dua isian tanggal bertumpuk */}
        <div className="flex flex-col gap-3 min-[400px]:flex-row">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold text-[var(--label)]">
            Tanggal mulai
            <input
              type="date"
              value={tanggalMulai}
              onChange={(e) => setTanggalMulai(e.target.value)}
              className="w-full min-w-0 text-base"
              required
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold text-[var(--label)]">
            Tanggal selesai
            <input
              type="date"
              value={tanggalSelesai}
              onChange={(e) => setTanggalSelesai(e.target.value)}
              className="w-full min-w-0 text-base"
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-semibold text-[var(--label)]">
          Alasan
          <textarea
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            className="w-full text-base"
            rows={3}
          />
        </label>

        <div className="flex flex-col gap-1.5 text-sm">
          <span className="font-semibold text-[var(--label)]">Surat (opsional -- foto/scan surat sakit atau izin)</span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label
              className="tombol-sekunder !rounded-full cursor-pointer px-4 py-2 text-xs font-bold"
            >
              {suratFile ? 'Ganti surat' : 'Lampirkan surat'}
              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                hidden
                onChange={(e) => setSuratFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <span className="min-w-0 break-all text-xs" style={{ color: 'var(--kosong)' }}>
              {suratFile ? suratFile.name : 'Belum ada surat'}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={ajukan.isPending}
          className="tombol-utama w-full mt-2"
        >
          {ajukan.isPending ? 'Mengirim…' : 'Ajukan Permohonan'}
        </button>

        {pesan && (
          <p className="text-sm font-medium mt-1 text-center" style={{ color: ajukan.isError ? 'var(--merah)' : 'var(--hijau)' }}>
            {pesan}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-3">
        <p className="judul-seksi">
          Pengajuan Saya
        </p>
        {isLoading && <KerangkaDaftarKartu jumlah={2} />}
        {!isLoading && (riwayat ?? []).length === 0 && <p style={{ color: 'var(--kosong)' }}>Belum ada pengajuan.</p>}
        {(riwayat ?? []).map((r) => (
          <div key={r.id} className="kartu-status flex flex-col gap-2 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15 }}>
                {LABEL_JENIS[r.jenis]} · {tanggalIndonesiaDariYmd(r.tanggalMulai)}
                {r.tanggalSelesai !== r.tanggalMulai ? ` – ${tanggalIndonesiaDariYmd(r.tanggalSelesai)}` : ''}
              </p>
              <span className="status-teks" style={{ color: WARNA_STATUS[r.status] }}>{LABEL_STATUS[r.status]}</span>
            </div>
            {r.keterangan && <p className="text-sm" style={{ color: 'var(--label)' }}>{r.keterangan}</p>}
            {r.catatanKeputusan && <p className="text-sm font-medium">Catatan: {r.catatanKeputusan}</p>}
            {r.suratPath && (
              <button
                type="button"
                onClick={() => void lihatSurat(r.suratPath as string)}
                className="tombol-sekunder self-start !py-1 !px-3 text-xs font-bold mt-1"
              >
                Lihat surat
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
