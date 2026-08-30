'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { useAjukanCuti, useCutiSaya, useSignedUrlCuti, type CutiJenis } from '../../lib/api/cuti';
import { tanggalIndonesiaDariYmd, tanggalWIB } from '../../lib/tanggal';

const LABEL_JENIS: Record<CutiJenis, string> = { cuti: 'Cuti', sakit: 'Sakit', izin: 'Izin' };
const WARNA_STATUS: Record<string, string> = { diajukan: 'var(--kuning)', disetujui: 'var(--hijau)', ditolak: 'var(--merah)' };
const LABEL_STATUS: Record<string, string> = { diajukan: 'Menunggu persetujuan', disetujui: 'Disetujui', ditolak: 'Ditolak' };

const gayaTombolUtama = { borderColor: 'var(--biru)', background: 'var(--biru)', color: 'var(--kertas-2)', minHeight: 48 } as const;

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
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
        Ajukan Cuti / Sakit / Izin
      </h1>

      <form onSubmit={tanganiKirim} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Jenis
          <select
            value={jenis}
            onChange={(e) => setJenis(e.target.value as CutiJenis)}
            className="border px-3"
            style={{ borderColor: 'var(--garis)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
          >
            <option value="cuti">Cuti</option>
            <option value="sakit">Sakit</option>
            <option value="izin">Izin</option>
          </select>
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Tanggal mulai
            <input
              type="date"
              value={tanggalMulai}
              onChange={(e) => setTanggalMulai(e.target.value)}
              className="border px-3"
              style={{ borderColor: 'var(--garis)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Tanggal selesai
            <input
              type="date"
              value={tanggalSelesai}
              onChange={(e) => setTanggalSelesai(e.target.value)}
              className="border px-3"
              style={{ borderColor: 'var(--garis)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          Alasan
          <textarea
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            className="border p-2"
            style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-kecil)' }}
            rows={3}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Lampirkan surat (opsional -- foto/scan surat sakit atau izin)
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(e) => setSuratFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
        </label>

        <button
          type="submit"
          disabled={ajukan.isPending}
          className="border px-4"
          style={{ ...gayaTombolUtama, borderRadius: 'var(--radius-pil)' }}
        >
          {ajukan.isPending ? 'Mengirim…' : 'Ajukan'}
        </button>

        {pesan && (
          <p className="text-sm" style={{ color: ajukan.isError ? 'var(--merah)' : 'var(--hijau)' }}>
            {pesan}
          </p>
        )}
      </form>

      <div className="flex flex-col gap-3">
        <p style={{ fontFamily: 'var(--display)', fontSize: 'var(--ukuran-judul)', fontWeight: 500, color: 'var(--biru)' }}>
          Pengajuan Saya
        </p>
        {isLoading && <p>Memuat…</p>}
        {!isLoading && (riwayat ?? []).length === 0 && <p style={{ color: 'var(--kosong)' }}>Belum ada pengajuan.</p>}
        {(riwayat ?? []).map((r) => (
          <div key={r.id} className="border p-3 text-sm" style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)' }}>
            <p style={{ fontFamily: 'var(--display)', fontWeight: 500 }}>
              {LABEL_JENIS[r.jenis]} · {tanggalIndonesiaDariYmd(r.tanggalMulai)}
              {r.tanggalSelesai !== r.tanggalMulai ? ` – ${tanggalIndonesiaDariYmd(r.tanggalSelesai)}` : ''}
            </p>
            <p style={{ color: WARNA_STATUS[r.status] }}>{LABEL_STATUS[r.status]}</p>
            {r.keterangan && <p style={{ color: 'var(--kosong)' }}>{r.keterangan}</p>}
            {r.catatanKeputusan && <p>Catatan: {r.catatanKeputusan}</p>}
            {r.suratPath && (
              <button
                type="button"
                onClick={() => void lihatSurat(r.suratPath as string)}
                className="mt-1 border px-3 py-1 text-sm"
                style={{ borderColor: 'var(--biru)', color: 'var(--biru)', minHeight: 44, borderRadius: 'var(--radius-kecil)' }}
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
