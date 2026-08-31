/**
 * Pola "keadaan gagal" -- ditambahkan 30 Agustus 2026 (koreksi eksplisit
 * user atas DESIGN.md §16, yang cuma membahas "kosong": memang tidak ada
 * data, bukan gagal DIMUAT). Dua keadaan itu TIDAK BOLEH terlihat sama --
 * §16 sendiri bilang keadaan kosong harus menjawab "apakah ini memang
 * kosong, atau sistem bermasalah?", tapi sebelumnya tidak ada jawaban
 * visual untuk sisi "sistem bermasalah"-nya. Beda dari pesan error field
 * (§17, ditempel dekat field) -- ini untuk SATU BAGIAN LAYAR yang gagal
 * dimuat (query gagal), dengan tombol coba lagi eksplisit.
 *
 * Redesign: memakai pola kartu-status rail-merah (DESIGN.md §4.2, §17)
 * supaya konsisten dengan bahasa visual status di seluruh app.
 */
export function KeadaanGagal({ pesan = 'Gagal memuat data.', onCoba }: { pesan?: string; onCoba: () => void }) {
  return (
    <div className="kartu-status rail-merah flex flex-col gap-2">
      <p style={{ color: 'var(--merah)', fontFamily: 'var(--display)', fontWeight: 600 }}>{pesan}</p>
      <button
        type="button"
        onClick={onCoba}
        className="tombol-sekunder"
        style={{ borderColor: 'var(--merah)', color: 'var(--merah)', alignSelf: 'flex-start' }}
      >
        Coba lagi
      </button>
    </div>
  );
}
