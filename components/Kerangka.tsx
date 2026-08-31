'use client';

/**
 * Kerangka muat (skeleton loading) — DESIGN-MODERN.md §M5.
 *
 * Menggantikan SEMUA "Memuat…" dan lingkaran berputar dengan kerangka abu
 * berbentuk isi yang akan datang. CSS-nya sudah ada di globals.css
 * (`.kerangka`, `@keyframes kerangka-geser`).
 *
 * Tidak ada animasi saat halaman pertama dimuat (§M4) — kerangka shimmer
 * BUKAN animasi halaman, melainkan indikator proses jaringan yang sedang
 * berlangsung (sama seperti progress bar, DIIZINKAN). Animasi yang DILARANG
 * §M4 adalah: elemen bergerak masuk saat mount, ikon berputar, angka
 * counting up — kerangka shimmer bukan termasuk itu.
 */

/** Satu balok kerangka dengan ukuran tertentu. */
function Balok({ tinggi = 16, lebar = '100%', className = '' }: {
  tinggi?: number;
  lebar?: string | number;
  className?: string;
}) {
  return (
    <div
      className={`kerangka ${className}`}
      style={{ height: tinggi, width: lebar }}
      aria-hidden="true"
    />
  );
}

/**
 * Kerangka untuk Beranda — sapaan + daftar tugas (3 kartu).
 * Dipakai saat `loading` di Home, meniru layout DaftarTugas.
 */
export function KerangkaBeranda() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Memuat beranda">
      {/* Sapaan */}
      <Balok tinggi={28} lebar="60%" />

      {/* Judul bagian */}
      <Balok tinggi={20} lebar="55%" />

      {/* Ringkasan angka + progress bar */}
      <div className="flex items-baseline gap-2">
        <Balok tinggi={32} lebar={60} />
        <Balok tinggi={14} lebar="40%" />
      </div>
      <Balok tinggi={8} lebar="100%" />

      {/* 3 kartu tugas */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-2"
          style={{
            background: 'var(--permukaan)',
            boxShadow: 'var(--bayangan-kartu)',
            borderRadius: 'var(--radius-besar)',
            borderLeft: '4px solid var(--garis)',
            padding: '12px 16px',
          }}
        >
          <Balok tinggi={16} lebar="70%" />
          <Balok tinggi={13} lebar="40%" />
        </div>
      ))}
    </div>
  );
}

/**
 * Kerangka generik untuk halaman yang memuat satu daftar kartu.
 * Dipakai di Papan Kontrol, Keputusan, Riwayat, Cuti, dll.
 */
export function KerangkaDaftarKartu({ jumlah = 3 }: { jumlah?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Memuat daftar">
      {Array.from({ length: jumlah }, (_, i) => (
        <div
          key={i}
          className="flex flex-col gap-2"
          style={{
            background: 'var(--permukaan)',
            boxShadow: 'var(--bayangan-kartu)',
            borderRadius: 'var(--radius-besar)',
            borderLeft: '4px solid var(--garis)',
            padding: '12px 16px',
          }}
        >
          <Balok tinggi={16} lebar="65%" />
          <Balok tinggi={13} lebar="45%" />
          <Balok tinggi={13} lebar="30%" />
        </div>
      ))}
    </div>
  );
}

/**
 * Kerangka untuk Papan Kontrol — ringkasan + kartu per kelompok form.
 */
export function KerangkaPapan() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Memuat papan kontrol">
      {/* Ringkasan angka */}
      <div className="flex flex-col gap-3">
        <div>
          <Balok tinggi={14} lebar="30%" />
          <div className="flex items-baseline gap-2 mt-1">
            <Balok tinggi={32} lebar={60} />
            <Balok tinggi={14} lebar="35%" />
          </div>
          <div className="mt-2">
            <Balok tinggi={8} lebar="100%" />
          </div>
        </div>

        {/* Breakdown status */}
        <div className="flex gap-3">
          <div
            className="flex-1 flex flex-col gap-1"
            style={{
              background: 'var(--permukaan)',
              boxShadow: 'var(--bayangan-kartu)',
              borderRadius: 'var(--radius-besar)',
              borderLeft: '4px solid var(--garis)',
              padding: '12px 16px',
            }}
          >
            <Balok tinggi={20} lebar={40} />
            <Balok tinggi={13} lebar="60%" />
          </div>
          <div
            className="flex-1 flex flex-col gap-1"
            style={{
              background: 'var(--permukaan)',
              boxShadow: 'var(--bayangan-kartu)',
              borderRadius: 'var(--radius-besar)',
              borderLeft: '4px solid var(--garis)',
              padding: '12px 16px',
            }}
          >
            <Balok tinggi={20} lebar={40} />
            <Balok tinggi={13} lebar="60%" />
          </div>
        </div>
      </div>

      {/* 2 kelompok form, masing-masing 2 kartu */}
      {[1, 2].map((g) => (
        <div key={g} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <Balok tinggi={20} lebar="40%" />
            <Balok tinggi={14} lebar={40} />
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {[1, 2].map((c) => (
              <div
                key={c}
                className="flex flex-col gap-2"
                style={{
                  background: 'var(--permukaan)',
                  boxShadow: 'var(--bayangan-kartu)',
                  borderRadius: 'var(--radius-besar)',
                  borderLeft: '4px solid var(--garis)',
                  padding: '12px 16px',
                }}
              >
                <Balok tinggi={16} lebar="60%" />
                <Balok tinggi={13} lebar="35%" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Kerangka untuk halaman form (LaporForm) — meniru layout form dengan blok.
 */
export function KerangkaForm() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Memuat form">
      {/* Judul form */}
      <Balok tinggi={28} lebar="50%" />
      <Balok tinggi={14} lebar="30%" />

      {/* 2 blok form */}
      {[1, 2].map((b) => (
        <div
          key={b}
          className="flex flex-col gap-3"
          style={{
            background: 'var(--permukaan)',
            boxShadow: 'var(--bayangan-kartu)',
            borderRadius: 'var(--radius-besar)',
            padding: '16px',
          }}
        >
          <Balok tinggi={20} lebar="45%" />
          <div className="flex flex-col gap-3">
            <div>
              <Balok tinggi={14} lebar="30%" />
              <div className="mt-1"><Balok tinggi={44} lebar="100%" /></div>
            </div>
            <div>
              <Balok tinggi={14} lebar="25%" />
              <div className="mt-1"><Balok tinggi={44} lebar="100%" /></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Kerangka untuk detail laporan (riwayat/[id]).
 */
export function KerangkaDetailLaporan() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat laporan">
      <Balok tinggi={28} lebar="50%" />
      <Balok tinggi={14} lebar="40%" />

      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-2" style={{ marginTop: 8 }}>
          <Balok tinggi={14} lebar="25%" />
          <Balok tinggi={16} lebar="60%" />
        </div>
      ))}
    </div>
  );
}

/**
 * Kerangka untuk tabel (marketing dashboard).
 */
export function KerangkaTabel({ baris = 5, kolom = 4 }: { baris?: number; kolom?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Memuat tabel">
      {/* Header */}
      <div className="flex gap-2">
        {Array.from({ length: kolom }, (_, i) => (
          <Balok key={i} tinggi={14} lebar={`${100 / kolom - 2}%`} />
        ))}
      </div>
      {/* Baris */}
      {Array.from({ length: baris }, (_, r) => (
        <div key={r} className="flex gap-2">
          {Array.from({ length: kolom }, (_, c) => (
            <Balok key={c} tinggi={16} lebar={`${100 / kolom - 2}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Kerangka untuk halaman presensi/absen — kotak kamera + tombol.
 */
export function KerangkaAbsen() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat halaman absen">
      {/* Area kamera */}
      <Balok tinggi={200} lebar="100%" />
      {/* Tombol absen */}
      <Balok tinggi={48} lebar="100%" />
      {/* Status */}
      <div className="flex flex-col gap-2">
        <Balok tinggi={16} lebar="50%" />
        <Balok tinggi={14} lebar="35%" />
      </div>
    </div>
  );
}

/**
 * Kerangka kecil untuk daftar presensi di halaman akun.
 */
export function KerangkaPresensiRingkas() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Memuat presensi">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-1"
          style={{
            border: '1px solid var(--garis)',
            borderRadius: 'var(--radius-besar)',
            padding: '12px',
          }}
        >
          <Balok tinggi={16} lebar="45%" />
          <Balok tinggi={13} lebar="30%" />
          <Balok tinggi={13} lebar="55%" />
        </div>
      ))}
    </div>
  );
}

/**
 * Kerangka generik paling sederhana — baris-baris teks.
 * Fallback untuk halaman-halaman kecil (Terlindungi loading, dsb).
 */
export function KerangkaTeks({ baris = 3 }: { baris?: number }) {
  const lebarPola = ['70%', '50%', '60%', '45%', '55%'];
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Memuat">
      {Array.from({ length: baris }, (_, i) => (
        <Balok key={i} tinggi={16} lebar={lebarPola[i % lebarPola.length]} />
      ))}
    </div>
  );
}
