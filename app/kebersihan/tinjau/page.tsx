'use client';

import { useState } from 'react';
import { Terlindungi } from '../../../components/Terlindungi';
import { PemilihTanggal } from '../../../components/PemilihTanggal';
import { KerangkaDaftarKartu } from '../../../components/Kerangka';
import { useAuth } from '../../../lib/auth/AuthProvider';
import { useLaporanKebersihanUntukTanggal, SLOT_KEBERSIHAN, type LaporanKebersihanRow } from '../../../lib/api/kebersihan';
import { useSignedUrl } from '../../../lib/api/attachment';
import { jamWIB, tanggalWIB } from '../../../lib/tanggal';

/**
 * Tinjau Laporan Kebersihan (CEO, 6 September 2026) -- gerbang SAMA PERSIS
 * dengan Tinjau Absensi: ceo, pusat, is_hrd_kadiv(). Lima foto ditampilkan
 * berdampingan begitu satu outlet dibuka, supaya sekali lihat tahu kondisi
 * hari itu -- bukan satu per satu lewat tombol terpisah seperti Tinjau
 * Absensi (di sana cuma perlu lihat satu foto per kunjungan, di sini
 * justru perbandingan lima-lima yang dicari).
 */
function KartuOutlet({ laporan, tanggal }: { laporan: LaporanKebersihanRow; tanggal: string }) {
  const [terbuka, setTerbuka] = useState(false);
  const [urlPerSlot, setUrlPerSlot] = useState<Record<string, string>>({});
  const [memuat, setMemuat] = useState(false);
  const signedUrl = useSignedUrl();

  const jumlahTerisi = laporan.foto.length;
  const lengkap = jumlahTerisi === SLOT_KEBERSIHAN.length;
  const rail = lengkap ? 'rail-hijau' : jumlahTerisi > 0 ? 'rail-kuning' : 'rail-merah';

  async function buka() {
    const sudahDibuka = terbuka;
    setTerbuka(!sudahDibuka);
    if (sudahDibuka || Object.keys(urlPerSlot).length > 0) return;
    setMemuat(true);
    try {
      const hasil: Record<string, string> = {};
      for (const f of laporan.foto) {
        hasil[f.slot] = await signedUrl.mutateAsync({ path: f.path, umurDetik: 300 });
      }
      setUrlPerSlot(hasil);
    } finally {
      setMemuat(false);
    }
  }

  return (
    <div className={`kartu-status ${rail} flex flex-col gap-3`}>
      <button type="button" onClick={() => void buka()} className="flex items-center justify-between gap-2 text-left" style={{ minHeight: 44 }}>
        <div>
          <p style={{ fontFamily: 'var(--display)', fontWeight: 600 }}>{laporan.outletNama}</p>
          <p className="status-teks" style={{ color: lengkap ? 'var(--hijau)' : jumlahTerisi > 0 ? 'var(--kuning)' : 'var(--merah)' }}>
            {jumlahTerisi} dari {SLOT_KEBERSIHAN.length} foto
            {laporan.status === 'terlambat' ? ' · Terlambat' : ''}
          </p>
        </div>
        {laporan.submittedAt && (
          <span className="text-sm" style={{ fontFamily: 'var(--mono)', color: 'var(--label)' }}>
            {jamWIB(new Date(laporan.submittedAt))}
          </span>
        )}
      </button>

      {terbuka && (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
          {SLOT_KEBERSIHAN.map((slot) => {
            const foto = laporan.foto.find((f) => f.slot === slot.key);
            const url = urlPerSlot[slot.key];
            return (
              <div key={slot.key} className="flex flex-col gap-1">
                <p className="text-sm" style={{ color: 'var(--label)' }}>{slot.label}</p>
                {!foto ? (
                  <div
                    className="flex items-center justify-center text-sm"
                    style={{ aspectRatio: '1', background: 'var(--permukaan-2)', color: 'var(--kosong)', borderRadius: 'var(--radius-kecil)' }}
                  >
                    Belum ada
                  </div>
                ) : memuat ? (
                  <div style={{ aspectRatio: '1', background: 'var(--permukaan-2)', borderRadius: 'var(--radius-kecil)' }} className="kerangka" />
                ) : url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed URL sementara, bukan aset Next */}
                    <img
                      src={url}
                      alt={`Foto ${slot.label} — ${laporan.outletNama}, ${tanggal}`}
                      className="w-full cursor-pointer"
                      style={{ aspectRatio: '1', objectFit: 'cover', borderRadius: 'var(--radius-kecil)' }}
                      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                    />
                    {foto?.uploadedByNama && (
                      // Keterangan KECIL, bukan kolom besar (instruksi eksplisit CEO,
                      // 6 September 2026: "ini pertanggungjawaban, bukan papan
                      // penilaian") -- cuma dipakai kalau ternyata ada foto yang
                      // bukan kondisi hari itu, supaya jelas siapa yang mengambilnya.
                      <p className="text-xs" style={{ color: 'var(--kosong)' }}>
                        {foto.uploadedByNama} · {jamWIB(new Date(foto.createdAt))}
                      </p>
                    )}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TinjauKebersihanIsi() {
  const [tanggal, setTanggal] = useState(tanggalWIB());
  const { data: daftar, isLoading } = useLaporanKebersihanUntukTanggal(tanggal);

  return (
    <div className="flex flex-col gap-4">
      <PemilihTanggal tanggal={tanggal} onUbah={setTanggal} />

      {isLoading ? (
        <KerangkaDaftarKartu jumlah={3} />
      ) : !daftar || daftar.length === 0 ? (
        <p style={{ color: 'var(--kosong)' }}>Belum ada Laporan Kebersihan pada tanggal ini.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {daftar.map((laporan) => (
            <KartuOutlet key={laporan.outletId} laporan={laporan} tanggal={tanggal} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TinjauKebersihanPage() {
  const { roles, profile } = useAuth();
  const bolehHrdKadiv = roles.includes('kadiv') && profile?.divisi === 'HRD';

  return (
    <Terlindungi peran={['ceo', 'pusat']} boleh={bolehHrdKadiv}>
      <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
        <h1 className="text-2xl" style={{ fontFamily: 'var(--display)', color: 'var(--biru)' }}>
          Tinjau Kebersihan
        </h1>
        <TinjauKebersihanIsi />
      </main>
    </Terlindungi>
  );
}
