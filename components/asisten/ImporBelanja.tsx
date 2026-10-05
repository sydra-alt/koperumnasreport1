'use client';

import { useState, type FormEvent } from 'react';
import { GalatKirimAi, useImporBelanja, useOutletBelanja } from '../../lib/api/asisten';
import { kompresGambar } from '../../lib/gambar';
import { JENIS_FOTO, MAKS_BYTE_FOTO, MAKS_BYTE_FOTO_ASLI } from '../../lib/ai/imporBelanja';
import { tanggalWIB } from '../../lib/tanggal';

/**
 * Panel impor belanja dari foto nota di /asisten (3 Oktober 2026). AI cuma
 * MEMBACA foto; pencocokan ke bahan dan bendera dari aturan pasti di pos-fnb,
 * dan tidak pernah hijau. Tidak ada yang tercatat ke stok dari sini --
 * hasilnya draf di layar Pembelian POS yang dikonfirmasi manusia.
 */

// Foto nota dikecilkan di browser sebelum dikirim (batas badan permintaan
// server 4,5 MB); 2400 px sisi terpanjang masih cukup untuk tulisan tangan.
const SISI_MAKS = 2400;
const KUALITAS = 0.85;

export function ImporBelanja({
  habis,
  onSelesai,
  onGalat,
}: {
  habis: boolean;
  onSelesai: (hasil: { percakapanId: string; pesanUser: unknown; pesanModel: unknown }) => void;
  onGalat: (pesan: string, percakapanId: string | null) => void;
}) {
  const outlet = useOutletBelanja(true);
  const impor = useImporBelanja();
  const hariIni = tanggalWIB();
  const [outletId, setOutletId] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [pembelanja, setPembelanja] = useState('');
  const [tanggal, setTanggal] = useState(hariIni);
  const [galatFoto, setGalatFoto] = useState('');
  const [menyiapkan, setMenyiapkan] = useState(false);
  const sibuk = menyiapkan || impor.isPending;
  // Pusat (Rumah Ibu Putri) jadi bawaan: semua belanja masuk Pusat dulu (keputusan CEO, 8 Oktober 2026).
  const pusatId = outlet.data?.find((o) => o.isPusat)?.id ?? '';
  if (pusatId && outletId === '' && !sibuk) setOutletId(pusatId);

  function pilihFoto(f: File | null) {
    setGalatFoto('');
    if (f && !(JENIS_FOTO as readonly string[]).includes(f.type)) {
      setGalatFoto('Foto harus JPG, PNG, atau WEBP.');
      setFoto(null);
      return;
    }
    if (f && f.size > MAKS_BYTE_FOTO_ASLI) {
      setGalatFoto('Foto lebih dari 5 MB. Ambil ulang dengan resolusi lebih kecil.');
      setFoto(null);
      return;
    }
    setFoto(f);
  }

  async function kirim(e: FormEvent) {
    e.preventDefault();
    if (!outletId || !foto || sibuk) return;
    if (tanggal > hariIni) {
      setGalatFoto('Tanggal belanja tidak boleh di masa depan.');
      return;
    }
    setMenyiapkan(true);
    let kecil: Blob;
    try {
      kecil = await kompresGambar(foto, SISI_MAKS, KUALITAS);
    } catch {
      setMenyiapkan(false);
      setGalatFoto('Foto tidak bisa dibaca di perangkat ini. Coba foto lain.');
      return;
    }
    setMenyiapkan(false);
    if (kecil.size > MAKS_BYTE_FOTO) {
      setGalatFoto('Foto masih terlalu besar setelah dikecilkan. Ambil ulang dengan resolusi lebih kecil.');
      return;
    }
    try {
      onSelesai(await impor.mutateAsync({ outletId, foto: kecil, namaFoto: 'nota.jpg', pembelanja, tanggalBelanja: tanggal }));
    } catch (err) {
      onGalat(err instanceof GalatKirimAi ? err.message : 'Terjadi kesalahan. Coba lagi.', err instanceof GalatKirimAi ? err.percakapanId : null);
    }
  }

  const gayaIsian = {
    borderColor: 'var(--garis-tegas)',
    borderRadius: 'var(--radius-kecil)',
    background: 'var(--permukaan)',
    minHeight: 44,
  } as const;

  return (
    <form
      onSubmit={kirim}
      className="flex flex-col gap-3 border p-4"
      style={{ borderColor: 'var(--garis)', borderRadius: 'var(--radius-besar)', background: 'var(--permukaan)' }}
    >
      <div className="flex flex-col gap-1">
        <h2 style={{ fontWeight: 600 }}>Impor belanja dari foto nota</h2>
        <p className="text-sm" style={{ color: 'var(--label)' }}>
          AI membaca barang, jumlah, satuan, dan total dari foto; pencocokan ke daftar bahan memakai aturan pasti. Setiap baris wajib
          diperiksa. Hasilnya draf di layar Pembelian POS, belum ada yang tercatat ke stok sampai Anda konfirmasi di sana.
        </p>
      </div>

      {outlet.isError ? (
        <p className="text-sm" role="alert" style={{ color: 'var(--merah)' }}>
          {outlet.error instanceof Error ? outlet.error.message : 'Daftar outlet tidak bisa dibaca.'}
        </p>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Outlet (bawaan tiap baris; bisa diganti per baris di POS)
          <select
            id="belanja-outlet"
            value={outletId}
            onChange={(e) => setOutletId(e.target.value)}
            disabled={outlet.isLoading || sibuk}
            className="border px-3"
            style={gayaIsian}
          >
            <option value="">{outlet.isLoading ? 'Memuat outlet...' : 'Pilih outlet'}</option>
            {outlet.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.isPusat ? `${o.name} (Pusat)` : o.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1 text-sm">
        Foto nota (JPG, PNG, atau WEBP, maks 5 MB)
        <input
          id="belanja-foto"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => pilihFoto(e.target.files?.[0] ?? null)}
          disabled={sibuk}
          className="border p-2"
          style={gayaIsian}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Tanggal belanja
          <input
            id="belanja-tanggal"
            type="date"
            value={tanggal}
            max={hariIni}
            onChange={(e) => setTanggal(e.target.value)}
            disabled={sibuk}
            className="border px-3"
            style={gayaIsian}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Yang belanja (opsional)
          <input
            id="belanja-pembelanja"
            type="text"
            maxLength={80}
            value={pembelanja}
            onChange={(e) => setPembelanja(e.target.value)}
            disabled={sibuk}
            className="border px-3"
            style={gayaIsian}
          />
        </label>
      </div>

      {galatFoto ? (
        <p className="text-sm" role="alert" style={{ color: 'var(--merah)' }}>
          {galatFoto}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={habis || !outletId || !foto || sibuk}
          className="px-6 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'var(--biru)', color: 'var(--kertas-2)', borderRadius: 'var(--radius-kecil)', minHeight: 44 }}
        >
          {menyiapkan ? 'Menyiapkan foto...' : impor.isPending ? 'Membaca nota...' : 'Baca dan cocokkan'}
        </button>
        {habis ? (
          <span className="text-sm" style={{ color: 'var(--merah)' }}>
            Batas pesan hari ini sudah habis (satu impor = satu pesan).
          </span>
        ) : (
          <span className="text-sm" style={{ color: 'var(--label)' }}>Satu impor memakai satu pesan dari jatah harian.</span>
        )}
      </div>
    </form>
  );
}
